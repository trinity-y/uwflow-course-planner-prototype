import { defaultYearRange, firstPlanYear, initialPlan, lastPlanYear, termLabel, termOrder, terms } from './calendar.mjs';

export const normalizeCode = (code) => code.trim().toUpperCase().replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
export const maxTermTarget = 20;
export const outcomeLabels = { enrolled: 'Enrolled', passed: 'Passed', failed: 'Failed' };
export const isPinned = (outcome) => outcome === 'passed' || outcome === 'failed';
export const isAcademicCourse = (code) => !/^(COOP|PD|WKRPT) /.test(code);

export function readYearRange(range) {
  const { start, end } = range ?? {};
  return Number.isInteger(start) && Number.isInteger(end) && start >= firstPlanYear && end <= lastPlanYear && start <= end
    ? { start, end }
    : { ...defaultYearRange };
}

export function readOutcomes(raw, scheduled) {
  return Object.fromEntries([...scheduled.keys()].flatMap((code) => {
    const outcome = raw?.[code];
    return Object.hasOwn(outcomeLabels, outcome) ? [[code, outcome]] : [];
  }));
}

export function readTermTargets(raw, timeline = terms) {
  return Object.fromEntries(timeline.map(({ id, target }) => {
    const saved = raw?.[id];
    const valid = Number.isInteger(saved) && saved >= 0 && saved <= maxTermTarget;
    return [id, valid ? saved : target];
  }));
}

export function readTermDetails(raw, timeline = terms) {
  const titles = {};
  const notes = {};
  for (const { id } of timeline) {
    if (typeof raw?.titles?.[id] === 'string') titles[id] = raw.titles[id].trim();
    if (Array.isArray(raw?.notes?.[id])) {
      notes[id] = raw.notes[id].flatMap((note) => {
        const title = typeof note?.title === 'string' ? note.title.trim() : '';
        const body = typeof note?.body === 'string' ? note.body.trim() : '';
        return title ? [{ title, body }] : [];
      });
    }
  }
  return { titles, notes };
}

export function readPlan(raw, timeline = terms) {
  const plan = initialPlan(timeline);
  if (!raw || typeof raw !== 'object') return plan;
  const seen = new Set();
  for (const term of timeline) {
    const codes = Array.isArray(raw[term.id]) ? raw[term.id] : plan[term.id];
    plan[term.id] = codes.filter((code) => {
      if (typeof code !== 'string' || !/^[A-Z]+ \d{1,4}[A-Z]*$/.test(code) || seen.has(code)) return false;
      seen.add(code);
      return true;
    });
  }
  return plan;
}

export function placeCourse(plan, code, target, outcomes = {}) {
  if (isPinned(outcomes[code]) || !Object.hasOwn(plan, target) || termOrder(target) === undefined || plan[target].includes(code)) {
    return plan;
  }
  return Object.fromEntries(Object.entries(plan).map(([id, courses]) => [
    id, id === target ? [...courses, code] : courses.filter((item) => item !== code),
  ]));
}

export function removeCourse(plan, code, outcomes = {}) {
  if (isPinned(outcomes[code])) return plan;
  const entry = Object.entries(plan).find(([, courses]) => courses.includes(code));
  if (!entry) return plan;
  const [term, courses] = entry;
  return { ...plan, [term]: courses.filter((item) => item !== code) };
}

export function indexPlan(plan) {
  return new Map(Object.entries(plan).flatMap(([id, codes]) => codes.map((code) => [code, id])));
}

export function countableSchedule(scheduled, outcomes) {
  return new Map([...scheduled].filter(([code]) => outcomes[code] !== 'failed'));
}

export function courseStatus(code, target, scheduled) {
  const term = scheduled.get(code);
  if (!term) return 'missing';
  if (target && termOrder(term) >= termOrder(target)) return 'late';
  return 'planned';
}

export function missingGroups(course, target, scheduled) {
  return (course?.groups ?? []).filter((group) => groupProgress(group, target, scheduled).remaining > 0);
}

export function groupProgress(group, target, scheduled) {
  const outstanding = group.options.filter((code) => courseStatus(code, target, scheduled) !== 'planned');
  const remaining = Math.max(0, group.count - (group.options.length - outstanding.length));
  return { outstanding, remaining };
}

export function groupLabel({ count, options }) {
  if (options.length === 1) return 'Required';
  return count === options.length ? `All ${count}` : `${count} of ${options.length}`;
}

export function explainMissing(groups, target, scheduled) {
  return groups.map((group) => {
    const { outstanding, remaining } = groupProgress(group, target, scheduled);
    const options = outstanding.map((code) => {
      if (courseStatus(code, target, scheduled) !== 'late') return code;
      return `${code} (in ${termLabel(scheduled.get(code))}, needs an earlier term)`;
    });
    if (options.length === 1) return `Needs ${options[0]}.`;
    return `Choose ${remaining} of ${options.length}: ${options.join(', ')}.`;
  }).join(' ');
}

const coursePattern = /\b[A-Z]{2,}\s*\d{3}[A-Z]?\b/g;
const fullCourseCode = /^[A-Z]{2,} \d{3}[A-Z]?$/;
const counts = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const stripParens = (value) => value.trim().replace(/^\(([^()]*)\)$/, '$1');
const countPattern = /^(?:at least\s+)?(one|two|three|four|five|\d+)\s+of(?:\s+the following)?[:\s]+(.+)$/i;

function parseGroup(clause) {
  const text = stripParens(clause);
  const counted = text.match(countPattern);
  const count = counted ? counts[counted[1].toLowerCase()] ?? Number(counted[1]) : 1;
  const source = counted ? stripParens(counted[2]) : text;
  const separator = counted ? /\s*,\s*(?:or\s+)?|\s+or\s+/i : /\s+or\s+|\s*\/\s*/i;
  const options = [...new Set(source.split(separator).map(normalizeCode))];
  return count >= 1 && count <= options.length && options.every((code) => fullCourseCode.test(code))
    ? { count, options }
    : null;
}

// Accept plain course-only AND / OR clauses. Calendar prose can contain
// conditional and non-course rules, so keep it verbatim when outside this subset.
export function parseLivePrerequisites(text) {
  if (!text?.trim()) return { groups: [], references: [] };
  const source = text.trim().replace(/^Prereq(?:uisites?)?:\s*/i, '').replace(/\.$/, '');
  const references = [...new Set((source.match(coursePattern) ?? []).map(normalizeCode))];
  const clauses = countPattern.test(stripParens(source))
    ? [source]
    : source.split(/(?:\s+and\s+|\s*,\s*)(?![^()]*\))/i);
  const groups = clauses.map(parseGroup);
  // A bare mix, such as A or B and C, is ambiguous without parentheses.
  const ambiguous = clauses.length > 1 && clauses.some((clause) =>
    /\bor\b/i.test(clause) && !/^\s*\([^()]*\)\s*$/.test(clause),
  );
  return { groups: !ambiguous && groups.every(Boolean) ? groups : null, references };
}

export function buildGraph(code, getCourse) {
  const depth = new Map();
  const edges = new Map();
  const visit = (target, level, path) => {
    if (path.has(target) || (depth.get(target) ?? -1) >= level) return;
    depth.set(target, level);
    const course = getCourse(target);
    const groups = course?.groups ?? course?.references?.map((reference) => ({ count: null, options: [reference] })) ?? [];
    const nextPath = new Set([...path, target]);
    const links = groups.map((group) => ({
      ...group, options: group.options.filter((item) => !nextPath.has(item)),
    })).filter((group) => group.options.length);
    edges.set(target, links);
    links.flatMap((group) => group.options).forEach((item) => visit(item, level + 1, nextPath));
  };
  visit(code, 0, new Set());
  return { depth, edges };
}
