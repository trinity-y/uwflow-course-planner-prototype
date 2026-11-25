import { courseCredit, termOrder } from './calendar.mjs';
import { degreeCourseSets, evaluateDegree } from './degree.mjs';
import { allowsOffering, byRatings, offeringWarning, offerings, ratings } from './ratings.mjs';
import { isAcademicCourse, maxTermTarget } from './model.mjs';

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

function searchPlan({
  plan, timeline, activeTerms, targets, notes = {}, outcomes = {}, preferences = {},
  requirements, archive, groups = {}, disabled = [], equivalents = requirements.equivalents ?? {}, seed = 0, lockedTerms = [],
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
    const limit = targets[id] ?? 0;
    return [id, Math.max(0, limit - (limit ? notes[id] ?? 0 : 0))];
  }));
  const openTerms = timeline.map(({ id }) => id).filter((id) => active.has(id) && capacities.get(id) > 0);
  const requested = Object.keys(preferences).filter((code) => preferences[code] === 'required');
  const score = (code) => opinions[preferences[code]]?.score ?? 0;
  const credit = (code) => courseCredit(archive, code, equivalents);
  const aliases = new Map(Object.entries(equivalents).map(([code, canonical]) => [canonical, code]));
  const banned = (code) => preferences[code] === 'banned' || preferences[equivalents[code]] === 'banned';
  const canonical = (code) => equivalents[code] ?? code;
  const ruleOptions = new Map(rules.filter(({ type }) => type !== 'required').map((rule) => [
    rule.id, degreeCourseSets(requirements, archive, rule, { equivalents }).flatMap((set) => set.options),
  ]));
  const evaluated = (state) => evaluateDegree(requirements, archive,
    new Map([...state].filter(([code]) => outcomes[code] !== 'failed')), { timeline, equivalents, disabledRules });
  const count = (state, term) => [...state].filter(([code, id]) => id === term && isAcademicCourse(code)).length;
  const position = (state, code) => {
    const regular = outcomes[code] === 'failed' ? undefined : state.get(code);
    const alias = aliases.get(code);
    const substitute = outcomes[alias] === 'failed' ? undefined : state.get(alias);
    return substitute && (!regular || termOrder(substitute) < termOrder(regular)) ? substitute : regular;
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
        && allowsOffering(code, term) && (!requiredLevel || term === requiredTerm || outOfSequence.has(course))
        && count(base, term) < capacities.get(term));
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
            || score(b[0]) - score(a[0]) || byRatings(a[0], b[0]) || tie(a[0], b[0]);
        });
      let winner;
      let winnerReport;
      let winnerRank;
      let tried = 0;
      let evaluatedChoices = 0;
      for (const codes of ranked) {
        const missing = codes.filter((code) => !position(state, code));
        const eligible = termsForChoice.filter((term) => missing.every((code) => allowsOffering(code, term)));
        for (const term of eligible.slice(0, 5)) {
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
            ratings[codes[0]]?.filled_count ?? 0, ratings[codes[0]]?.liked ?? 0,
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
    const target = targets[id] ?? 0;
    if (count(pins, id) + (target ? notes[id] ?? 0 : 0) > target) {
      issues.push(lockedTerms.includes(id) ? `${label} is locked and already exceeds its target.`
        : `${label} has more pinned classes or reserved slots than its target.`);
    }
  }
  for (const [code, term] of pins) {
    if (banned(code)) issues.push(`${code} is both pinned and banned.`);
    const warning = !outcomes[code] && offeringWarning(code, term);
    if (warning) issues.push(`${code} is pinned. ${warning}`);
  }
  for (const [code, term] of warnings(best.state)) {
    const label = timeline.find(({ id }) => id === term)?.label ?? term;
    issues.push(`${code} needs an earlier prerequisite before ${label}.`);
  }
  const unscheduled = {};
  for (const code of misses(best.state)) {
    if (outcomes[code] === 'failed') {
      unscheduled[code] = 'A failed attempt is pinned. The planner supports one placement per course.';
    } else if (offerings.has(code) && !openTerms.some((term) => allowsOffering(code, term))) {
      const { expected, year } = offerings.get(code);
      unscheduled[code] = `No open target term matches its offerings. Projected seasons: ${expected.join(', ')} (from ${year}).`;
    } else {
      unscheduled[code] = 'No placement fits the available slots and known prerequisites.';
    }
  }
  for (const rule of best.report.rules.filter((rule) => !rule.disabled)) {
    for (const { required, scheduled } of rule.elsewhere ?? []) {
      issues.push(`${required} is required in ${rule.level}. ${scheduled} is pinned in a different term.`);
    }
  }
  const suggestions = [...best.state].filter(([code]) => !pins.has(code));
  const unmet = best.report.rules.filter((rule) => !rule.disabled && !rule.met).map((rule) => rule.title);
  const fits = !issues.length && !unmet.length && !Object.keys(unscheduled).length;
  return { fits, suggestions: fits ? suggestions : [], unscheduled, issues, unmet, met: best.report.met, total: best.report.total };
}

// Try small changes first. Use a separate search for each counterfactual, so
// the editor and the failed solve never receive a relaxed target or placement.
export function solveAuto(inputs, progress = () => {}) {
  const locked = new Set(inputs.lockedTerms ?? []);
  const data = {
    ...inputs,
    activeTerms: inputs.activeTerms.filter((id) => !locked.has(id)),
    visibleTerms: (inputs.visibleTerms ?? inputs.activeTerms).filter((id) => !locked.has(id)),
  };
  const result = searchPlan(data, progress);
  result.lockedTerms = [...locked];
  result.alternatives = [];
  if (result.fits) return result;

  const active = new Set(data.activeTerms);
  const visible = new Set(data.visibleTerms ?? data.activeTerms);
  const used = (id) => (data.plan[id] ?? []).filter(isAcademicCourse).length;
  const notes = (id) => data.notes?.[id] ?? 0;
  const blocked = data.timeline.some(({ id }) => !visible.has(id) && used(id) > (data.targets[id] ?? 0))
    || Object.keys(result.unscheduled).some((code) => data.outcomes?.[code] === 'failed')
    || Object.entries(data.plan).some(([term, courses]) => courses.some((code) => data.preferences?.[code] === 'banned'
      || (!data.outcomes?.[code] && !allowsOffering(code, term))));
  if (blocked) return result;

  const candidates = data.timeline.filter(({ id }) => visible.has(id));
  const open = candidates.filter(({ id, level }) => (active.has(id) && level) || data.targets[id] > 0 || used(id) > 0);
  const extra = candidates.find(({ id, work }) => active.has(id) && !work && !data.targets[id] && !used(id)
    && termOrder(id) > (termOrder(open.at(-1)?.id) ?? -Infinity));

  const minimum = { ...data.targets };
  const program = { ...data.targets };
  const roomier = { ...data.targets };
  for (const { id, target } of open) {
    minimum[id] = Math.max(data.targets[id] ?? 0, used(id) + notes(id));
    program[id] = active.has(id) ? Math.max(minimum[id], target) : minimum[id];
    roomier[id] = active.has(id) ? Math.min(maxTermTarget, program[id] + 2) : minimum[id];
  }
  const trials = [minimum, program];
  if (extra) trials.push({ ...minimum, [extra.id]: 5 });
  trials.push(roomier);
  if (extra) trials.push({ ...roomier, [extra.id]: 5 });

  const tried = new Set([JSON.stringify(data.targets)]);
  for (const targets of trials) {
    const key = JSON.stringify(targets);
    if (tried.has(key) || Object.values(targets).some((value) => value > maxTermTarget)) continue;
    tried.add(key);
    const trial = searchPlan({ ...data, targets });
    if (!trial.fits) continue;

    const changes = {};
    for (const { id } of candidates) {
      const load = used(id) + notes(id) + trial.suggestions.filter(([, term]) => term === id).length;
      if (load > (data.targets[id] ?? 0) && targets[id] > (data.targets[id] ?? 0)) changes[id] = load;
    }
    if (!Object.keys(changes).length) continue;
    const trimmed = { ...data.targets, ...changes };
    if (JSON.stringify(trimmed) === key || searchPlan({ ...data, targets: trimmed }).fits) {
      result.alternatives.push(changes);
    } else {
      result.alternatives.push(Object.fromEntries(Object.entries(targets).filter(([id, value]) => value !== data.targets[id])));
    }
    break;
  }
  return result;
}
