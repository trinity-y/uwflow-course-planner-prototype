import { terms } from './calendar.mjs';

const termOrder = new Map(terms.map(({ id }, index) => [id, index]));

const requiredCodes = (requirements, rule) => rule.codes ?? rule.levels.flatMap((level) => requirements.coreByLevel[level]);
const fixedCourses = (requirements) => requirements.rules.filter(({ type }) => type === 'required')
  .flatMap((rule) => requiredCodes(requirements, rule));
const creditForCode = (archive, code) => archive[code]?.[2] ?? code;
const isHalfCreditElective = (archive, code) => archive[code]?.[1] === 0.5 && !/^(COOP|PD|WKRPT) /.test(code);

function courseSets(requirements, archive, rule) {
  const { lists } = requirements;
  if (rule.type === 'required') {
    if (rule.levels) return rule.levels.map((level) => ({
      title: level, options: requirements.coreByLevel[level].map((code) => [code]),
    }));
    return [{ options: rule.codes.map((code) => [code]) }];
  }
  if (rule.id === 'technical-additional') {
    const primary = new Set([...lists['technical-cs'], ...lists['technical-ece']].map(([code]) => code));
    return [
      { title: 'CS list', options: lists['technical-cs'] },
      { title: 'ECE list', options: lists['technical-ece'] },
      { title: 'Extended list', options: lists[rule.list].filter(([code]) => !primary.has(code)) },
    ];
  }
  if (rule.list) return [{ options: lists[rule.list] }];

  const approved = new Map();
  const reserved = new Set(fixedCourses(requirements).map((code) => creditForCode(archive, code)));
  const known = new Set();
  for (const elective of requirements.rules.filter(({ type }) => type === 'elective')) {
    for (const choice of lists[elective.list]) {
      if (reserved.has(creditForCode(archive, choice[0]))) continue;
      approved.set(choice.join('|'), choice);
      choice.forEach((code) => known.add(creditForCode(archive, code)));
    }
  }
  const halfCredit = Object.keys(archive).filter((code) => {
    const credit = creditForCode(archive, code);
    return isHalfCreditElective(archive, code) && !reserved.has(credit) && !known.has(credit);
  }).map((code) => [code]);
  return [
    { title: 'Published elective lists', options: [...approved.values()] },
    { title: 'Other 0.50-unit courses', options: halfCredit },
  ];
}

export function degreeCourseSets(requirements, archive, rule, { remainingOnly = false } = {}) {
  if (remainingOnly && rule.met) return [];
  const sets = courseSets(requirements, archive, rule);
  if (!remainingOnly || !rule.missing) return sets;

  const missing = new Set(rule.missing);
  return sets.map((set) => ({
    ...set,
    options: set.options.filter((codes) => codes.some((code) => missing.has(code))),
  })).filter(({ options }) => options.length);
}

function assignElectiveSlots(rules, candidatesByRule) {
  const creditsToSlots = new Map();
  const slots = rules.flatMap((rule) =>
    Array.from({ length: rule.count }, () => rule.id),
  );

  function assign(slot, tried) {
    for (const credit of candidatesByRule.get(slots[slot]).keys()) {
      if (tried.has(credit)) continue;
      tried.add(credit);
      const owner = creditsToSlots.get(credit);
      // Move an earlier assignment to another valid choice before reusing its credit.
      if (owner === undefined || assign(owner, tried)) {
        creditsToSlots.set(credit, slot);
        return true;
      }
    }
    return false;
  }

  slots.forEach((_, index) => assign(index, new Set()));
  const byRule = new Map(rules.map(({ id }) => [id, []]));
  for (const [credit, slot] of creditsToSlots) {
    const rule = slots[slot];
    byRule.get(rule).push(candidatesByRule.get(rule).get(credit));
  }
  return byRule;
}

export function evaluateDegree(requirements, archive, scheduled, { timeline = terms, equivalents = {} } = {}) {
  const termsByLevel = new Map(timeline.filter(({ level }) => level).map(({ level, id }) => [level, id]));
  const workTerms = new Set(timeline.filter(({ work }) => work).map(({ id }) => id));
  const creditFor = (code) => creditForCode(archive, equivalents[code] ?? code);
  const placements = new Map();
  for (const [code, term] of scheduled) {
    const credit = creditFor(code);
    if (!placements.has(credit)) placements.set(credit, []);
    placements.get(credit).push({ code, term });
  }

  const reserved = new Set(fixedCourses(requirements).map(creditFor));
  const electiveRules = requirements.rules.filter(({ type }) => type === 'elective');

  function optionsFor(list, eligible = () => true) {
    const candidates = new Map();
    for (const [lead, ...associated] of requirements.lists[list]) {
      const credit = creditFor(lead);
      if (reserved.has(credit) || candidates.has(credit)) continue;
      const primary = placements.get(credit)?.find(({ term }) => eligible(term));
      if (!primary) continue;
      const supporting = associated.map((code) => placements.get(creditFor(code))?.[0]?.code);
      if (supporting.every(Boolean)) {
        candidates.set(credit, { ...primary, codes: [primary.code, ...supporting] });
      }
    }
    return candidates;
  }

  const electiveCandidates = new Map(electiveRules.map((rule) => [
    rule.id, optionsFor(rule.list, (term) => {
      const order = termOrder.get(term);
      return (!rule.before || order < termOrder.get(termsByLevel.get(rule.before))) &&
        (!rule.fromLevel || order >= termOrder.get(termsByLevel.get(rule.fromLevel)));
    }),
  ]));
  const assignment = assignElectiveSlots(electiveRules, electiveCandidates);
  const electiveCredits = new Map();
  const associatedCredits = new Set();
  for (const rule of electiveRules) {
    for (const row of requirements.lists[rule.list]) {
      if (row.length > 1) row.forEach((code) => associatedCredits.add(creditFor(code)));
    }
    for (const [credit, placement] of optionsFor(rule.list)) electiveCredits.set(credit, placement);
  }
  for (const [credit, choices] of placements) {
    const elective = choices.find(({ code }) => isHalfCreditElective(archive, code));
    if (elective && !reserved.has(credit) && !associatedCredits.has(credit) && !electiveCredits.has(credit)) {
      electiveCredits.set(credit, { ...elective, codes: [elective.code] });
    }
  }

  const evaluations = requirements.rules.map((rule) => {
    if (rule.type === 'required') {
      const codes = requiredCodes(requirements, rule);
      const matched = [];
      const missing = [];
      for (const code of codes) {
        const placement = placements.get(creditFor(code))?.[0];
        if (placement) matched.push(placement.code);
        else missing.push(code);
      }
      return { ...rule, current: matched.length, target: codes.length, matched, missing };
    }

    const target = rule.count;
    let matched = [];
    let current = 0;
    let counts;
    switch (rule.type) {
      case 'elective':
        current = assignment.get(rule.id).length;
        matched = assignment.get(rule.id).flatMap(({ codes }) => codes);
        break;
      case 'electiveTotal':
        matched = [...electiveCredits.values()].flatMap(({ codes }) => codes);
        current = electiveCredits.size;
        break;
      case 'electiveTiming': {
        counts = rule.levels.map((level) => {
          const term = termsByLevel.get(level);
          const choices = [...electiveCredits.values()].filter((placement) => placement.term === term);
          matched.push(...choices.flatMap(({ codes }) => codes));
          return { label: level, count: choices.length };
        });
        const perTermShortfall = counts.reduce((sum, { count }) => sum + Math.max(0, (rule.minimumPerTerm ?? 0) - count), 0);
        current = Math.min(target - perTermShortfall, counts.reduce((sum, { count }) => sum + count, 0));
        break;
      }
      case 'choose':
        matched = [...optionsFor(rule.list).values()].slice(0, target).flatMap(({ codes }) => codes);
        current = matched.length;
        break;
      case 'workTerms': {
        const counted = new Map();
        for (const placement of optionsFor(rule.list, (term) => workTerms.has(term)).values()) {
          counted.set(placement.term, placement.code);
        }
        matched = [...counted.values()];
        current = counted.size;
        break;
      }
      default:
        throw new Error(`Unsupported degree rule: ${rule.type}`);
    }
    return { ...rule, current: Math.min(current, target), target, matched, counts };
  }).map((rule) => ({ ...rule, met: rule.current === rule.target }));
  const met = evaluations.filter((rule) => rule.met).length;
  return { rules: evaluations, met, total: evaluations.length, percent: Math.round(met * 100 / evaluations.length) };
}
