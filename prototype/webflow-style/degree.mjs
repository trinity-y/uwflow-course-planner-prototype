import { termOrder, terms } from './calendar.mjs';
import { isAcademicCourse } from './model.mjs';

const requiredCodes = (requirements, rule) => rule.codes ?? rule.levels.flatMap((level) => requirements.coreByLevel[level]);
const fixedCourses = (requirements) => requirements.rules.filter(({ type }) => type === 'required')
  .flatMap((rule) => requiredCodes(requirements, rule));
const creditForCode = (archive, code) => archive[code]?.[2] ?? code;
const academicUnits = (archive, code) => isAcademicCourse(code) ? archive[code]?.[1] ?? 0 : 0;
const isHalfCreditElective = (archive, code) => academicUnits(archive, code) === 0.5;

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
  if (rule.type === 'academicUnits') {
    return [{ options: Object.keys(archive).filter((code) => academicUnits(archive, code) > 0).map((code) => [code]) }];
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

export function degreeCourseSets(requirements, archive, rule, { remainingOnly = false, countedElsewhere = [] } = {}) {
  if (remainingOnly && (rule.met || rule.disabled)) return [];
  const sets = courseSets(requirements, archive, rule);
  if (!remainingOnly) return sets;

  const missing = rule.missing && new Set(rule.missing);
  const counted = new Set([...rule.matched, ...countedElsewhere].map((code) => creditForCode(archive, code)));
  return sets.map((set) => ({
    ...set,
    options: set.options.map((codes) => codes.filter((code) =>
      (!missing || missing.has(code)) && !counted.has(creditForCode(archive, code)),
    )).filter((codes) => codes.length),
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

export function evaluateDegree(requirements, archive, scheduled, { timeline = terms, equivalents = {}, disabledRules = new Set() } = {}) {
  const termsByLevel = new Map(timeline.filter(({ level }) => level).map(({ level, id }) => [level, id]));
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

  const coreChoices = new Map();
  for (const rule of requirements.rules.filter(({ core }) => core)) {
    const options = [...optionsFor(rule.list).entries()];
    for (const [credit] of options.slice(0, rule.count)) reserved.add(credit);
    coreChoices.set(rule.id, options.map(([, placement]) => placement));
  }

  const electiveCandidates = new Map(electiveRules.map((rule) => [
    rule.id, optionsFor(rule.list, (term) => {
      const order = termOrder(term);
      return (!rule.before || order < termOrder(termsByLevel.get(rule.before))) &&
        (!rule.fromLevel || order >= termOrder(termsByLevel.get(rule.fromLevel)));
    }),
  ]));
  const assignment = assignElectiveSlots(electiveRules.filter(({ id }) => !disabledRules.has(id)), electiveCandidates);
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
  const categoryCredits = new Set([...assignment.values()].flatMap((choices) => choices.map(({ code }) => creditFor(code))));
  const electiveChoices = [...electiveCredits.values()].sort((a, b) =>
    Number(categoryCredits.has(creditFor(b.code))) - Number(categoryCredits.has(creditFor(a.code))),
  );

  const evaluations = requirements.rules.map((rule) => {
    if (disabledRules.has(rule.id)) return { ...rule, disabled: true, matched: [], additional: [] };
    if (rule.type === 'required') {
      const codes = requiredCodes(requirements, rule);
      const matched = [];
      const missing = [];
      for (const code of codes) {
        const placement = placements.get(creditFor(code))?.[0];
        if (placement) matched.push(placement.code);
        else missing.push(code);
      }
      return { ...rule, current: matched.length, target: codes.length, matched, missing, additional: [] };
    }
    if (rule.type === 'academicUnits') {
      let current = 0;
      const matched = [];
      const additional = [];
      for (const choices of placements.values()) {
        const placement = choices.find(({ code }) => academicUnits(archive, code) > 0);
        if (!placement) continue;
        if (current >= rule.count) additional.push(placement.code);
        else {
          matched.push(placement.code);
          current += academicUnits(archive, placement.code);
        }
      }
      return { ...rule, current: Math.min(current, rule.count), target: rule.count, matched, additional };
    }

    const target = rule.count;
    let candidates = [];
    let selected = [];
    let current = 0;
    let counts;
    switch (rule.type) {
      case 'elective':
        candidates = [...electiveCandidates.get(rule.id).values()];
        selected = assignment.get(rule.id);
        current = selected.length;
        break;
      case 'electiveTotal':
        candidates = electiveChoices;
        selected = candidates.slice(0, target);
        current = selected.length;
        break;
      case 'electiveTiming': {
        const minimums = rule.levels.map((level) => rule.minimumByLevel?.[level] ?? 0);
        const byLevel = rule.levels.map((level) => electiveChoices.filter(({ term }) => term === termsByLevel.get(level)));
        counts = rule.levels.map((label, index) => ({ label, count: byLevel[index].length }));
        candidates = byLevel.flat();
        const perTerm = byLevel.flatMap((choices, index) => choices.slice(0, minimums[index]));
        const remaining = byLevel.flatMap((choices, index) => choices.slice(minimums[index]));
        const perTermShortfall = minimums.reduce((sum, minimum) => sum + minimum, 0) - perTerm.length;
        current = Math.min(target - perTermShortfall, candidates.length);
        selected = [...perTerm, ...remaining.slice(0, current - perTerm.length)];
        break;
      }
      case 'choose':
        candidates = coreChoices.get(rule.id) ?? [...optionsFor(rule.list).values()];
        selected = candidates.slice(0, target);
        current = selected.length;
        break;
      default:
        throw new Error(`Unsupported degree rule: ${rule.type}`);
    }
    const matched = selected.flatMap(({ codes }) => codes);
    const matchedCodes = new Set(matched);
    const additional = [...new Set(candidates.flatMap(({ codes }) => codes))].filter((code) => !matchedCodes.has(code));
    return { ...rule, current, target, matched, additional, available: candidates.length, counts };
  }).map((rule) => ({ ...rule, met: !rule.disabled && rule.current === rule.target }));
  const met = evaluations.filter((rule) => rule.met).length;
  const total = evaluations.filter((rule) => !rule.disabled).length;
  return { rules: evaluations, met, total, percent: total ? Math.round(met * 100 / total) : 0 };
}
