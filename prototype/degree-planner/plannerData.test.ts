import {
  canPlace,
  courses,
  initialPlan,
  Plan,
  PlannerCourse,
  prerequisiteIssues,
  prerequisiteRoutes,
  prerequisiteSuggestions,
  sequences,
  termDate,
} from './plannerData';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

const course = (code: string) => {
  const found = courses.find((item) => item.code === code);
  if (!found) throw new Error(`Missing fixture ${code}`);
  return found;
};

test('fixed terms remain enforced but missing prerequisites do not block adding', () => {
  expect(canPlace(course('CS 135'), '1B', {}, sequences['Stream 8'])).toContain(
    'assigned to 1A',
  );
  expect(
    canPlace(course('CS 247'), '2A', initialPlan, sequences['Stream 8']),
  ).toBe('');
  expect(
    canPlace(course('CS 247'), '2B', initialPlan, sequences['Stream 8']),
  ).toBe('');
});

test('work terms allow two courses and off terms reject courses', () => {
  const plan = { 'ECON 101': 'WT1', 'PSYCH 101': 'WT1' };
  expect(canPlace(course('CS 145'), 'WT1', plan, sequences['Stream 8'])).toBe(
    'This term is full.',
  );
  expect(canPlace(course('ECON 101'), 'WT1', plan, sequences['Stream 8'])).toBe(
    '',
  );
  expect(canPlace(course('ECON 101'), 'OFF1', {}, sequences.Regular)).toBe(
    'This is a term off.',
  );
});

test('calendar advances from fall through winter and spring', () => {
  expect([0, 1, 2, 3].map(termDate)).toEqual([
    'Fall 2025',
    'Winter 2026',
    'Spring 2026',
    'Fall 2026',
  ]);
});

test('OR paths include all missing ancestors and schedule them before the target', () => {
  const options = prerequisiteSuggestions(
    course('CS 247'),
    '2B',
    {},
    sequences['Stream 8'],
  );
  expect(options.map((option) => option.missing)).toEqual([
    ['CS 135', 'CS 136', 'CS 246'],
    ['CS 135', 'CS 136', 'CS 251'],
  ]);
  expect(options[0].plan).toEqual({
    'CS 135': '1A',
    'CS 136': '1B',
    'CS 246': '2A',
  });
  expect(options[1].plan).toEqual({
    'CS 135': '1A',
    'CS 136': '1B',
    'CS 251': '2A',
  });
});

test('existing prerequisites are reused and missing ancestors still appear', () => {
  const plan = { ...initialPlan };
  delete plan['CS 135'];
  const options = prerequisiteSuggestions(
    course('CS 247'),
    '2B',
    plan,
    sequences['Stream 8'],
  );
  expect(options[0].missing).toEqual(['CS 135']);
  expect(options[0].plan).toEqual(initialPlan);
  expect(plan['CS 135']).toBeUndefined();
});

test('unavailable prerequisite placement returns no partial changes', () => {
  const options = prerequisiteSuggestions(
    course('CS 247'),
    '1B',
    {},
    sequences['Stream 8'],
  );
  expect(options.every((option) => option.plan === null)).toBe(true);
  expect(options[0].error).toContain('No space');
  expect(canPlace(course('CS 247'), '1B', {}, sequences['Stream 8'])).toBe('');
});

test('nested OR choices combine with AND requirements and shared ancestors once', () => {
  const fixture = (
    code: string,
    prerequisites: string[] = [],
    prerequisiteOptions?: string[][],
  ): PlannerCourse => ({
    code,
    title: code,
    group: 'test',
    required: true,
    prerequisites,
    prerequisiteOptions,
  });
  const catalog = [
    fixture('ROOT', ['A', 'B']),
    fixture('A', [], [['X'], ['Y']]),
    fixture('B', ['X']),
    fixture('X'),
    fixture('Y'),
  ];
  const options = prerequisiteSuggestions(
    catalog[0],
    '4B',
    {},
    sequences['Stream 8'],
    catalog,
  );
  expect(options.map((option) => option.codes)).toEqual([
    ['X', 'A', 'B'],
    ['Y', 'A', 'X', 'B'],
  ]);
  expect(options.every((option) => option.plan !== null)).toBe(true);
});

test('a course in the same or a later term needs an earlier placement', () => {
  const options = prerequisiteSuggestions(
    course('CS 247'),
    '2B',
    { ...initialPlan, 'CS 246': '3A' },
    sequences['Stream 8'],
  );
  expect(options[0].missing).toEqual(['CS 246']);
  expect(options[0].plan?.['CS 246']).toBe('2A');
});

test('planner warnings track missing ancestors, alternative paths, and term order', () => {
  const terms = sequences['Stream 8'];
  const plan = { ...initialPlan, 'CS 247': '2A' };
  expect(prerequisiteIssues(plan, terms).map((item) => item.code)).toEqual([
    'CS 247',
  ]);
  expect(prerequisiteIssues({ ...plan, 'CS 247': '2B' }, terms)).toEqual([]);
  const alternative: Plan = { ...plan, 'CS 247': '2B', 'CS 251': '2A' };
  delete alternative['CS 246'];
  expect(prerequisiteIssues(alternative, terms)).toEqual([]);
  delete alternative['CS 135'];
  expect(
    prerequisiteIssues(alternative, terms).map((item) => item.code),
  ).toEqual(['CS 136', 'CS 247', 'CS 251']);
  expect(prerequisiteIssues({ ...alternative, 'CS 135': '1A' }, terms)).toEqual(
    [],
  );
});

test('alternative highlight routes share ancestors but keep their branch edges separate', () => {
  const routes = prerequisiteRoutes(course('CS 247'));
  expect(routes).toHaveLength(2);
  expect(Array.from(routes[0].connections)).toEqual([
    'CS 246→CS 247',
    'CS 136→CS 246',
    'CS 135→CS 136',
  ]);
  expect(Array.from(routes[1].connections)).toEqual([
    'CS 251→CS 247',
    'CS 136→CS 251',
    'CS 135→CS 136',
  ]);
  expect(
    routes.every(
      (route) => route.codes.has('CS 135') && route.codes.has('CS 136'),
    ),
  ).toBe(true);
  expect(routes.every((route) => !route.codes.has('CS 350'))).toBe(true);
});

test('highlight routes expand nested alternatives without splitting AND requirements into separate choices', () => {
  const fixture = (
    code: string,
    prerequisiteOptions: string[][],
  ): PlannerCourse => ({
    code,
    title: code,
    group: 'test',
    required: true,
    prerequisites: [],
    prerequisiteOptions,
  });
  const catalog = [
    fixture('ROOT', [['A', 'B']]),
    fixture('A', [['X'], ['Y']]),
    fixture('B', [[]]),
    fixture('X', [[]]),
    fixture('Y', [[]]),
  ];
  const routes = prerequisiteRoutes(catalog[0], catalog);
  expect(routes).toHaveLength(2);
  expect(routes.map((route) => Array.from(route.codes).sort())).toEqual([
    ['A', 'B', 'ROOT', 'X'],
    ['A', 'B', 'ROOT', 'Y'],
  ]);
  expect(
    routes.every(
      (route) =>
        route.connections.has('A→ROOT') && route.connections.has('B→ROOT'),
    ),
  ).toBe(true);
});

test('removes duplicate and unnecessarily restrictive prerequisite paths', () => {
  const fixture = (code: string, options: string[][]): PlannerCourse => ({
    code,
    title: code,
    group: 'test',
    required: true,
    prerequisites: options[0] ?? [],
    prerequisiteOptions: options,
  });
  const catalog = [
    fixture('ROOT', [
      ['A', 'B'],
      ['B', 'A'],
    ]),
    fixture('A', [['X'], ['B']]),
    fixture('B', [['X']]),
    fixture('X', [[]]),
  ];
  const paths = prerequisiteSuggestions(
    catalog[0],
    '4B',
    {},
    sequences['Stream 8'],
    catalog,
  );
  expect(paths).toHaveLength(1);
  expect(paths[0].requirements.A).toEqual(['X']);
  expect(new Set(paths[0].codes)).toEqual(new Set(['X', 'A', 'B']));
});

test('keeps different ordering choices for the same courses and labels their nested decisions', () => {
  const fixture = (code: string, options: string[][]): PlannerCourse => ({
    code,
    title: code,
    group: 'test',
    required: true,
    prerequisites: options[0] ?? [],
    prerequisiteOptions: options,
  });
  const catalog = [
    fixture('ROOT', [['A', 'B']]),
    fixture('A', [['X'], ['Y']]),
    fixture('B', [['X'], ['Y']]),
    fixture('X', [[]]),
    fixture('Y', [[]]),
  ];
  const routes = prerequisiteRoutes(catalog[0], catalog);
  expect(routes).toHaveLength(4);
  expect(new Set(routes.map((route) => route.label)).size).toBe(4);
  expect(routes.map((route) => route.label)).toContain('A and B · A: X · B: Y');
  expect(routes.map((route) => route.label)).toContain('A and B · A: Y · B: X');
});

test('PD courses reject academic terms and respect work-term capacity', () => {
  const pd: PlannerCourse = {
    code: 'PD 10',
    title: 'PD',
    required: true,
    group: 'PD',
    prerequisites: [],
  };
  const terms = ['1A', 'WT1', '1B', 'WT2', 'OFF1'];
  expect(canPlace(pd, '1A', {}, terms)).toBe(
    'This course can only be assigned to a work term.',
  );
  expect(canPlace(pd, '1B', {}, terms)).toBe(
    'This course can only be assigned to a work term.',
  );
  expect(canPlace(pd, 'WT1', {}, terms)).toBe('');
  expect(canPlace(pd, 'WT1', { A: 'WT1', B: 'WT1' }, terms)).toBe(
    'This term is full.',
  );
  expect(canPlace(pd, 'OFF1', {}, terms)).toBe('This is a term off.');
});

test('automatic prerequisite placement schedules PD in work terms and repairs an academic PD placement', () => {
  const pd: PlannerCourse = {
    code: 'PD 10',
    title: 'PD',
    required: true,
    group: 'PD',
    prerequisites: [],
  };
  const root: PlannerCourse = {
    code: 'PROJECT',
    title: 'Project',
    required: true,
    group: 'test',
    prerequisites: ['PD 10'],
  };
  const terms = ['1A', 'WT1', '1B', 'WT2', '2A'];
  expect(
    prerequisiteSuggestions(root, '2A', {}, terms, [pd, root])[0].plan,
  ).toEqual({ 'PD 10': 'WT1' });
  const repair = prerequisiteSuggestions(root, '2A', { 'PD 10': '1A' }, terms, [
    pd,
    root,
  ])[0];
  expect(repair.missing).toEqual(['PD 10']);
  expect(repair.plan?.['PD 10']).toBe('WT1');
});
