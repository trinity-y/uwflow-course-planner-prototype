import { termOrder } from './calendar.mjs';
import { degreeCourseSets, evaluateDegree } from './degree.mjs';
import { isAcademicCourse } from './model.mjs';

export const autoTermLimit = 8;
export const opinions = {
  required: { symbol: '✓', label: 'Must take', score: 0 },
  interested: { symbol: '+', label: 'Interested', score: 1 },
  neutral: { symbol: '=', label: 'Neutral', score: 0 },
  dislike: { symbol: '−', label: 'Prefer to avoid', score: -1 },
  banned: { symbol: '×', label: 'Ban', score: 0 },
};

function variety(code, seed) {
  let hash = seed ^ 0x9e3779b9;
  for (const char of code) hash = Math.imul(hash ^ char.charCodeAt(0), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function solveAuto({
  plan, timeline, activeTerms, targets, notes = {}, outcomes = {}, preferences = {},
  requirements, archive, groups = {}, disabled = [], equivalents = {}, seed = 0,
}, progress = () => {}) {
  const active = new Set(activeTerms);
  const disabledRules = new Set(disabled);
  const rules = requirements.rules.filter(({ id }) => !disabledRules.has(id));
  const outOfSequence = new Set(requirements.outOfSequence);
  const coreByCode = new Map(rules.filter(({ type, level }) => type === 'required' && level).flatMap(({ level }) =>
    requirements.coreByLevel[level].map((code) => [code, level]),
  ));
  const coreInPlacementOrder = [...coreByCode].sort(([a], [b]) => Number(outOfSequence.has(a)) - Number(outOfSequence.has(b)));
  const termByLevel = new Map(timeline.filter((term) => term.level).map((term) => [term.level, term.id]));
  const pins = new Map(Object.entries(plan).flatMap(([term, codes]) => codes.map((code) => [code, term])));
  const capacities = new Map(timeline.map(({ id }) => {
    const limit = Math.min(autoTermLimit, targets[id] ?? 0);
    return [id, Math.max(0, limit - (limit ? notes[id] ?? 0 : 0))];
  }));
  const openTerms = timeline.map(({ id }) => id).filter((id) => active.has(id) && capacities.get(id) > 0);
  const requested = Object.keys(preferences).filter((code) => preferences[code] === 'required');
  const score = (code) => opinions[preferences[code]]?.score ?? 0;
  const credit = (code) => archive[equivalents[code] ?? code]?.[2] ?? equivalents[code] ?? code;
  const aliases = new Map(Object.entries(equivalents).map(([code, canonical]) => [canonical, code]));
  const banned = (code) => preferences[code] === 'banned' || preferences[equivalents[code]] === 'banned';
  const canonical = (code) => equivalents[code] ?? code;
  const ruleOptions = new Map(rules.filter(({ type }) => type !== 'required').map((rule) => [
    rule.id, degreeCourseSets(requirements, archive, rule).flatMap((set) => set.options),
  ]));
  const evaluated = (state) => evaluateDegree(requirements, archive,
    new Map([...state].filter(([code]) => outcomes[code] !== 'failed')), { timeline, equivalents, disabledRules });
  const count = (state, term) => [...state].filter(([code, id]) => id === term && isAcademicCourse(code)).length;
  const getCode = (state, code) => state.has(code) ? code : aliases.get(code);
  const position = (state, code) => {
    const found = getCode(state, code);
    return outcomes[found] === 'failed' ? undefined : state.get(found);
  };
  const fulfilled = (state, code, term) => termOrder(position(state, code)) < termOrder(term);
  const courseGroups = (code) => groups[code] ?? groups[canonical(code)] ?? [];
  const warnings = (state) => [...state].filter(([code, term]) =>
    outcomes[code] !== 'passed' && outcomes[code] !== 'failed' && courseGroups(code).some(({ options, count }) =>
      options.filter((option) => fulfilled(state, option, term)).length < count,
    ),
  );
  const misses = (state) => requested.filter((code) => !position(state, code));
  const planScore = (state) => [...state.keys()].reduce((sum, code) => sum + score(code), 0);
  const totalProgress = (report) => report.rules.reduce((sum, rule) => sum + (rule.disabled ? 0 : rule.current / rule.target), 0);
  const isBetter = (left, right) => {
    if (!right) return true;
    for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return left[i] > right[i];
    return false;
  };
  let best;
  let bestRank;

  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const attemptSeed = seed + attempt * 131;
    let budget = 50000;
    let state = new Map(pins);
    const tie = (a, b) => variety(a, attemptSeed) - variety(b, attemptSeed);
    const byPreference = (a, b) => score(b) - score(a) || tie(a, b);

    function withPrerequisites(base, code, term, trail) {
      let result = base;
      for (const group of courseGroups(code)) {
        let remaining = group.count - group.options.filter((option) => fulfilled(result, option, term)).length;
        if (remaining <= 0) continue;
        const choices = group.options.filter((option) => !fulfilled(result, option, term)).sort(byPreference);
        while (remaining > 0) {
          let bestChoice;
          let choiceRank;
          for (const option of choices) {
            if (fulfilled(result, option, term)) continue;
            const candidate = place(result, option, undefined, termOrder(term), trail);
            if (!candidate) continue;
            const rank = [result.size - candidate.size, planScore(candidate)];
            if (isBetter(rank, choiceRank)) {
              bestChoice = candidate;
              choiceRank = rank;
            }
          }
          if (!bestChoice) return null;
          result = bestChoice;
          remaining -= 1;
        }
      }
      return result;
    }

    function place(base, code, allowed, before = Infinity, trail = new Set()) {
      if (--budget < 0 || trail.has(canonical(code))) return null;
      const existing = position(base, code);
      if (existing) return termOrder(existing) < before ? base : null;
      if (base.has(code) || banned(code) || !isAcademicCourse(code)) return null;
      if ([...base].some(([chosen]) => outcomes[chosen] !== 'failed' && credit(chosen) === credit(code))) return null;
      const course = canonical(code);
      const requiredLevel = coreByCode.get(course);
      const requiredTerm = termByLevel.get(requiredLevel);
      const nextTrail = new Set([...trail, course]);
      const available = (allowed ?? openTerms).filter((term) => active.has(term) && termOrder(term) < before
        && (!requiredLevel || term === requiredTerm || outOfSequence.has(course)) && count(base, term) < capacities.get(term));
      if (!allowed) available.sort((a, b) => {
        if (a === requiredTerm || b === requiredTerm) return a === requiredTerm ? -1 : 1;
        if (before !== Infinity) return termOrder(b) - termOrder(a);
        return Math.max(0, count(base, a) - 4) - Math.max(0, count(base, b) - 4) || tie(a, b);
      });
      let bestPlacement;
      let placementRank;
      for (const term of available) {
        const result = withPrerequisites(new Map(base).set(code, term), code, term, nextTrail);
        if (!result) continue;
        const rank = [base.size - result.size, planScore(result)];
        if (isBetter(rank, placementRank)) {
          bestPlacement = result;
          placementRank = rank;
        }
        if (!courseGroups(code).length || result.size === base.size + 1) break;
      }
      return bestPlacement ?? null;
    }

    // Place core courses in their calendar levels. Existing pins are authoritative.
    for (const { id, level } of timeline) {
      for (const [code, requiredLevel] of coreInPlacementOrder) {
        if (level === requiredLevel) state = place(state, code, [id]) ?? state;
      }
    }
    for (const code of coreByCode.keys()) {
      if (outOfSequence.has(code) && !position(state, code)) state = place(state, code) ?? state;
    }
    for (const rule of rules.filter(({ type, level }) => type === 'required' && !level)) {
      for (const code of rule.codes) state = place(state, code) ?? state;
    }

    // A pinned course can still need prerequisites. Passed and failed attempts are historical.
    for (const [code, term] of pins) {
      if (outcomes[code] === 'passed' || outcomes[code] === 'failed') continue;
      state = withPrerequisites(state, code, term, new Set([canonical(code)])) ?? state;
    }

    let report = evaluated(state);
    function pick(rule, choices, termsForChoice, priority) {
      const before = report.rules.find(({ id }) => id === rule.id);
      if (before.met || !termsForChoice.length) return false;
      const ranked = choices.filter((codes) => codes.some((code) => !position(state, code))
        && codes.every((code) => position(state, code) || !banned(code)))
        .sort((a, b) => {
          const needed = (codes) => codes.filter((code) => !position(state, code)).length;
          const knownWork = (codes) => codes.reduce((sum, code) =>
            sum + courseGroups(code).filter((group) => group.options.every((option) => !position(state, option))).length, 0);
          return needed(a) - needed(b) || knownWork(a) - knownWork(b)
            || score(b[0]) - score(a[0]) || tie(a[0], b[0]);
        });
      let winner;
      let winnerReport;
      let winnerRank;
      let tried = 0;
      let evaluatedChoices = 0;
      for (const codes of ranked) {
        for (const term of termsForChoice.slice(0, 5)) {
          let proposal = state;
          for (const code of codes) {
            proposal = place(proposal, code, [term]);
            if (!proposal) break;
          }
          if (!proposal || proposal === state) continue;
          evaluatedChoices += 1;
          const nextReport = evaluated(proposal);
          const next = nextReport.rules.find(({ id }) => id === rule.id);
          if (next.current <= before.current || nextReport.met < report.met) continue;
          const rank = [state.size - proposal.size, totalProgress(nextReport), planScore(proposal),
            -Math.max(0, count(proposal, term) - 5), priority(term)];
          if (isBetter(rank, winnerRank)) {
            winner = proposal;
            winnerReport = nextReport;
            winnerRank = rank;
          }
          tried += 1;
        }
        if ((winner && tried >= 14) || evaluatedChoices >= 70 || budget < 0) break;
      }
      if (!winner) return false;
      state = winner;
      report = winnerReport;
      return true;
    }

    const byId = new Map(rules.map((rule) => [rule.id, rule]));
    function gap(term) {
      return report.rules.reduce((sum, rule) => {
        const half = rule.counts?.find(({ label }) => termByLevel.get(label) === term);
        return sum + (half ? Math.max(0, (rule.minimumByLevel?.[half.label] ?? 0) - half.count) : 0);
      }, 0);
    }
    const applyRule = (rule) => {
      const prescribed = termByLevel.get(rule.level);
      const location = openTerms.filter((term) => count(state, term) < capacities.get(term)
        && (!rule.before || termOrder(term) < termOrder(termByLevel.get(rule.before)))
        && (!rule.fromLevel || termOrder(term) >= termOrder(termByLevel.get(rule.fromLevel)))
        && (rule.type !== 'electiveTiming' || rule.levels.some((level) => termByLevel.get(level) === term)));
      location.sort((a, b) => gap(b) - gap(a)
        || Math.max(0, count(state, a) - 4) - Math.max(0, count(state, b) - 4) || tie(a, b));
      const choices = ruleOptions.get(rule.id);
      if (!rule.core) return pick(rule, choices, location, gap);
      return pick(rule, choices, location.filter((term) => term === prescribed), gap)
        || pick(rule, choices.filter((codes) => codes.every((code) => outOfSequence.has(code))),
          location.filter((term) => term !== prescribed), gap);
    };

    for (const rule of rules.filter(({ core }) => core)) applyRule(rule);
    // Requested courses get first use of the capacity that remains after core placements.
    for (const code of requested.sort(tie)) {
      if (position(state, code)) continue;
      const ordered = [...openTerms].sort((a, b) => gap(b) - gap(a)
        || Math.max(0, count(state, a) - 4) - Math.max(0, count(state, b) - 4) || tie(a, b));
      const next = place(state, code, ordered);
      if (next) {
        state = next;
        report = evaluated(state);
      }
    }

    const orderedIds = ['communication', 'mechanics', 'sustainability', 'science', 'impact', 'humanities',
      'technical-cs', 'technical-ece', 'technical-additional', 'demo-course', 'electives-1b', 'electives-2a',
      'electives-4a', 'electives-4b', 'elective-total', 'academic-units'];
    const remainingRules = [...new Set([...orderedIds, ...byId.keys()])]
      .map((id) => byId.get(id)).filter((rule) => rule && rule.type !== 'required' && !rule.core);
    for (let round = 0; round < 2; round += 1) {
      for (const rule of remainingRules) {
        let additions = 0;
        while (additions < 15 && budget > 0 && applyRule(rule)) additions += 1;
      }
    }

    // A course can become redundant after another choice fills overlapping requirements.
    const baselineWarnings = new Set(warnings(state).map(([code]) => code));
    for (const code of [...state.keys()].filter((code) => !pins.has(code)).sort((a, b) => score(a) - score(b))) {
      const shorter = new Map(state);
      shorter.delete(code);
      if (misses(shorter).length > misses(state).length
        || warnings(shorter).some(([warning]) => !baselineWarnings.has(warning))) continue;
      const nextReport = evaluated(shorter);
      if (nextReport.rules.some((rule, i) => rule.current < report.rules[i].current)) continue;
      state = shorter;
      report = nextReport;
    }
    const rank = [-misses(state).length, report.met, totalProgress(report), -warnings(state).length, -state.size, planScore(state)];
    if (isBetter(rank, bestRank)) {
      best = { state, report };
      bestRank = rank;
    }
    progress((attempt + 1) / attempts);
  }

  const issues = [];
  for (const { id, label } of timeline) {
    if (count(pins, id) > capacities.get(id)) issues.push(`${label} has more pinned classes than its available slots.`);
  }
  for (const [code] of pins) if (banned(code)) issues.push(`${code} is both pinned and banned.`);
  for (const [code, term] of warnings(best.state)) {
    const label = timeline.find(({ id }) => id === term)?.label ?? term;
    issues.push(`${code} needs an earlier prerequisite before ${label}.`);
  }
  const unscheduled = Object.fromEntries(misses(best.state).map((code) => [code, outcomes[code] === 'failed'
    ? 'A failed attempt is pinned. The planner supports one placement per course.'
    : 'No placement fits the available slots and known prerequisites.']));
  const suggestions = [...best.state].filter(([code]) => !pins.has(code));
  return { suggestions, unscheduled, issues, met: best.report.met, total: best.report.total };
}
