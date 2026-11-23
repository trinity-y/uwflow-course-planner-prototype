import requirements from './degree-requirements.json' with { type: 'json' };

export const calendarUrl = requirements.sources.program;

const studyLevels = {
  '2023-fall': '1A',
  '2024-winter': '1B',
  '2024-fall': '2A',
  '2025-spring': '2B',
  '2026-winter': '3A',
  '2026-fall': '3B',
  '2027-spring': '4A',
  '2028-winter': '4B',
};

const sampleElectives = { '2024-winter': ['ECE 105'], '2027-spring': ['CS 488'] };

export const seasons = ['Winter', 'Spring', 'Fall'];
const seasonOrder = seasons.map((season) => season.toLowerCase());
export const firstPlanYear = 1900;
export const lastPlanYear = 2100;
export const defaultYearRange = { start: 2023, end: 2028 };
const termIdPattern = /^(\d{4})-(winter|spring|fall)$/;

export function termYear(id) {
  const year = Number(termIdPattern.exec(id)?.[1]);
  return year >= firstPlanYear && year <= lastPlanYear ? year : undefined;
}

export function termOrder(id) {
  const year = termYear(id);
  return year === undefined ? undefined : year * seasons.length + seasonOrder.indexOf(id.slice(5));
}

export function termLabel(id) {
  const [year, season] = id.split('-');
  return `${seasons[seasonOrder.indexOf(season)]} ${year}`;
}

export function createTerms({ start, end }) {
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset).flatMap((year) => seasons.map((season) => {
    const id = `${year}-${season.toLowerCase()}`;
    const level = studyLevels[id];
    const coreCourses = requirements.coreByLevel[level] ?? [];
    const coreChoices = requirements.rules.filter((rule) => rule.core && rule.level === level)
      .flatMap((rule) => requirements.lists[rule.list].slice(0, rule.count).flat());
    const [minimum, maximum] = requirements.termElectives[level] ?? [0, 0];
    const target = coreCourses.length + coreChoices.length + (level === '2A' ? minimum : maximum);
    const courses = [...coreCourses, ...coreChoices, ...(sampleElectives[id] ?? [])];
    return {
      id, year, season, level, courses, target,
      work: !level && id !== '2023-winter' && id !== '2023-spring' &&
        year >= defaultYearRange.start && year < defaultYearRange.end,
      label: `${season} ${year}`,
    };
  }));
}

export const terms = createTerms(defaultYearRange);

export const initialPlan = (timeline = terms) => Object.fromEntries(
  timeline.map(({ id, courses }) => [id, [...courses]]),
);

// Each group is required. Array entries are groups that need one course.
// The curated paths cover a subset of published course requisites.
const courseRows = [
  ['CS 488', 'Introduction to Computer Graphics', [['CS 341'], ['CS 350', 'SE 350'], ['CS 370', 'CS 371']]],
  ['CS 370', 'Numerical Computation', [['MATH 119', 'MATH 138'], ['MATH 115', 'MATH 136'], ['CS 241', 'CS 246']]],
  ['CS 371', 'Introduction to Computational Mathematics', [['CS 136', 'CS 138'], ['MATH 235'], ['MATH 237']]],
  ['CS 480', 'Introduction to Machine Learning', [['CS 341'], ['STAT 206', 'STAT 231']]],
  ['CS 449', 'Human-Computer Interaction', [['CS 349']]],
  ['CS 458', 'Computer Security and Privacy', [['CS 350', 'SE 350']]],
  ['CS 486', 'Introduction to Artificial Intelligence', [['CS 341']]],
  ['CS 137', 'Programming Principles', []],
  ['ECE 105', 'Classical Mechanics', []],
  ['MATH 115', 'Linear Algebra for Engineering', []],
  ['MATH 117', 'Calculus 1 for Engineering', []],
  ['MATH 135', 'Algebra for Honours Mathematics', []],
  ['SE 101', 'Introduction to Methods of Software Engineering', []],
  ['CS 138', 'Introduction to Data Abstraction and Implementation', [['CS 137']]],
  ['ECE 106', 'Electricity and Magnetism', [['ECE 105']]],
  ['ECE 124', 'Digital Circuits and Systems', []],
  ['ECE 140', 'Linear Circuits', []],
  ['MATH 119', 'Calculus 2 for Engineering', [['MATH 117']]],
  ['SE 102', 'Seminar', []],
  ['CHE 102', 'Chemistry for Engineers', []],
  ['CS 241', 'Foundations of Sequential Programs', [['CS 136', 'CS 138']]],
  ['ECE 222', 'Digital Computers', [['ECE 124']]],
  ['SE 201', 'Seminar', []],
  ['SE 212', 'Logic and Computation', [['MATH 135']]],
  ['STAT 206', 'Statistics for Software Engineering', [['MATH 119']]],
  ['CS 240', 'Data Structures and Data Management', [['CS 136', 'CS 138']]],
  ['CS 247', 'Software Engineering Principles', [['CS 138']]],
  ['CS 348', 'Introduction to Database Management', [['CS 241']]],
  ['ECE 192', 'Engineering Economics and Impact on Society', []],
  ['MATH 239', 'Introduction to Combinatorics', [['MATH 135']]],
  ['SE 202', 'Seminar', []],
  ['CS 341', 'Algorithms', [['CS 240'], ['CS 241'], ['MATH 239']]],
  ['CS 349', 'User Interfaces', [['CS 241'], ['MATH 115', 'MATH 136']]],
  ['MATH 213', 'Signals, Systems, and Differential Equations', [['MATH 119']]],
  ['SE 301', 'Seminar', []],
  ['SE 350', 'Operating Systems', [['CS 240'], ['CS 241'], ['CS 247'], ['ECE 222']]],
  ['SE 465', 'Software Testing and Quality Assurance', [['CS 247']]],
  ['CS 343', 'Concurrent and Parallel Programming', [['CS 240'], ['CS 246', 'CS 247']]],
  ['ECE 358', 'Computer Networks', [['SE 350', 'CS 350']]],
  ['SE 302', 'Seminar', []],
  ['SE 380', 'Introduction to Feedback Control', [['MATH 213']]],
  ['SE 390', 'Design Project Planning', []],
  ['SE 464', 'Software Design and Architectures', [['CS 247']]],
  ['SE 401', 'Seminar', []],
  ['SE 463', 'Software Requirements Specification and Analysis', [['SE 464']]],
  ['SE 490', 'Design Project 1', [['SE 390']]],
  ['SE 402', 'Seminar', []],
  ['SE 491', 'Design Project 2', [['SE 490']]],
  ['CS 136', 'Elementary Algorithm Design and Data Abstraction', [['CS 135']]],
  ['CS 135', 'Designing Functional Programs', []],
  ['CS 246', 'Object-Oriented Software Development', [['CS 136', 'CS 138']]],
  ['CS 350', 'Operating Systems', [['CS 240'], ['CS 241'], ['CS 246'], ['ECE 222']]],
  ['MATH 136', 'Linear Algebra 1 for Honours Mathematics', [['MATH 135']]],
  ['MATH 138', 'Calculus 2 for Honours Mathematics', [['MATH 137']]],
  ['MATH 137', 'Calculus 1 for Honours Mathematics', []],
  ['MATH 235', 'Linear Algebra 2 for Honours Mathematics', [['MATH 115', 'MATH 136']]],
  ['MATH 237', 'Calculus 3 for Honours Mathematics', [['MATH 119', 'MATH 138']]],
  ['STAT 231', 'Statistics', [['STAT 230']]],
  ['STAT 230', 'Probability', [['MATH 119', 'MATH 138']]],
  ['ENGL 109', 'Introduction to Academic Writing', []],
  ['EARTH 121', 'Introductory Earth Sciences', []],
  ['PD 19', 'Tactics for Workplace Success', []],
  ['FR 255', 'Business French 1', [{ count: 2, options: ['FR 192A', 'FR 192B', 'FR 296'] }]],
  ['FR 192A', 'French Language 1: Module 1', []],
  ['FR 192B', 'French Language 1: Module 2', []],
  ['FR 296', 'French Culture & Literature: Origins to 1715', [['FR 192A', 'FR 192B']]],
];

export const sampleCatalog = new Map(courseRows.map(([code, name, groups]) => [
  code, { code, name, groups: groups.map((group) => Array.isArray(group) ? { count: 1, options: group } : group) },
]));
