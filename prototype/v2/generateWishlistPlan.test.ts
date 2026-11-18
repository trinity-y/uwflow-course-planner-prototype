import { generateWishlistPlan } from './generateWishlistPlan';
import { Plan, PlannerCourse } from './plannerData';
import { reorderWishlist } from './useWishlist';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

const course = (
  code: string,
  prerequisiteOptions: string[][] = [[]],
  fixedTerm?: string,
  required = false,
): PlannerCourse => ({
  code,
  title: code,
  group: 'test',
  required,
  prerequisites: prerequisiteOptions[0] ?? [],
  prerequisiteOptions,
  fixedTerm,
});
const full: Plan = { X: '1A', Y: '1A', Z: '1A', U: '1A', V: '1A' };

test('wishlist priority determines who gets the last space without changing existing placements', () => {
  const plan = { X: '1A', Y: '1A', Z: '1A', U: '1A' };
  const catalog = [course('A'), course('B')];
  const result = generateWishlistPlan(['B', 'A'], plan, ['1A'], false, catalog);
  expect(result.plan).toEqual({ ...plan, B: '1A' });
  expect(result.unplaced.map((item) => item.code)).toEqual(['A']);
  expect(
    generateWishlistPlan(['A', 'B'], plan, ['1A'], false, catalog).added,
  ).toEqual(['A']);
  expect(plan).toEqual({ X: '1A', Y: '1A', Z: '1A', U: '1A' });
});

test('adds a recursive prerequisite chain and prefers an already satisfied OR route', () => {
  const catalog = [
    course('ROOT', [['A'], ['B']]),
    course('A', [['P']]),
    course('P', [[]], '1A'),
    course('B'),
  ];
  const result = generateWishlistPlan(
    ['ROOT'],
    { B: '1A' },
    ['1A', '1B', '2A'],
    false,
    catalog,
  );
  expect(result.plan).toEqual({ B: '1A', ROOT: '1B' });
  expect(result.added).toEqual(['ROOT']);
  const chain = generateWishlistPlan(
    ['A'],
    {},
    ['1A', '1B', '2A'],
    false,
    catalog,
  );
  expect(chain.plan).toEqual({ P: '1A', A: '1B' });
});

test('failed paths do not leave orphan prerequisites and existing courses are never moved', () => {
  const catalog = [
    course('ROOT', [['P', 'Q']]),
    course('P', [[]], '1A'),
    course('Q', [[]], '1B'),
  ];
  const blocked = { ...full, A: '1B', B: '1B', C: '1B', D: '1B', E: '1B' };
  const result = generateWishlistPlan(
    ['ROOT'],
    blocked,
    ['1A', '1B', '2A'],
    false,
    catalog,
  );
  expect(result.plan).toEqual(blocked);
  expect(result.added).toEqual([]);
  expect(result.unplaced.map((item) => item.code)).toEqual(['ROOT']);
  expect(
    generateWishlistPlan(['P'], { P: '2A' }, ['1A', '1B', '2A'], false, catalog)
      .plan,
  ).toEqual({ P: '2A' });
});

test('includes optional remaining requirements, skips work and off terms, and reports unavailable courses', () => {
  const catalog = [course('A'), course('R', [[]], undefined, true)];
  const result = generateWishlistPlan(
    ['A', 'UNKNOWN'],
    full,
    ['1A', 'WT1', 'OFF1', '1B'],
    true,
    catalog,
  );
  expect(result.plan).toEqual({ ...full, A: '1B', R: '1B' });
  expect(result.unplaced).toEqual([
    { code: 'UNKNOWN', reason: 'This course is not in the sample catalog.' },
  ]);
  expect(
    generateWishlistPlan(['A'], full, ['1A', '1B'], false, catalog).plan.R,
  ).toBeUndefined();
  expect(
    generateWishlistPlan(
      ['A'],
      result.plan,
      ['1A', 'WT1', 'OFF1', '1B'],
      true,
      catalog,
    ).added,
  ).toEqual([]);
});

test('wishlist movement preserves course identity and clamps the destination', () => {
  expect(reorderWishlist(['A', 'B', 'C'], 'C', 0)).toEqual(['C', 'A', 'B']);
  expect(reorderWishlist(['A', 'B', 'C'], 'A', 99)).toEqual(['B', 'C', 'A']);
  expect(reorderWishlist(['A', 'B'], 'MISSING', 0)).toEqual(['A', 'B']);
});

test('wishlist generation assigns PD only to work terms and reports when none can fit', () => {
  const pd = course('PD 10');
  const catalog = [pd];
  expect(
    generateWishlistPlan(['PD 10'], {}, ['1A', 'WT1', '1B'], false, catalog)
      .plan,
  ).toEqual({ 'PD 10': 'WT1' });
  const unavailable = generateWishlistPlan(
    ['PD 10'],
    {},
    ['1A', '1B'],
    false,
    catalog,
  );
  expect(unavailable.added).toEqual([]);
  expect(unavailable.unplaced[0].reason).toContain('No work term');
});
