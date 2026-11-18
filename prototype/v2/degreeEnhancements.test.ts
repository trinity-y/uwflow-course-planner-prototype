import {
  activeCurriculum,
  degreeEnhancements,
  enhancementProgress,
} from './degreeEnhancements';
import { generateWishlistPlan } from './generateWishlistPlan';
import { paletteGraph } from './paletteGraph';
import {
  courses,
  initialPlan,
  Plan,
  requirements,
  sequences,
} from './plannerData';
import { remainingPaletteSeeds } from './remainingPaletteSeeds';
import { readEnhancementIds } from './useDegreeEnhancements';

const enhancement = (id: string) => {
  const item = degreeEnhancements.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing ${id}`);
  return item;
};
const planned = (...codes: string[]): Plan =>
  Object.fromEntries(codes.map((code) => [code, '4A']));

test('uses the five selected calendar plans and reuses SE math courses toward the minor', () => {
  expect(degreeEnhancements.map((item) => item.id)).toEqual([
    'ai',
    'business',
    'fine-art',
    'hci',
    'co-minor',
  ]);
  expect(
    degreeEnhancements.map((item) => enhancementProgress(item, {}).total),
  ).toEqual([7, 7, 6, 7, 8]);
  expect(
    enhancementProgress(enhancement('co-minor'), initialPlan).planned,
  ).toBe(3);
  expect(() => paletteGraph(courses, courses)).not.toThrow();
});

test('allocates courses once per specialization and enforces AI faculty minimums', () => {
  const ai = enhancement('ai');
  expect(enhancementProgress(ai, planned('CS 480')).planned).toBe(1);
  const mathOnly = planned(
    'CS 486',
    'CS 492',
    'CS 480',
    'CO 367',
    'CO 456',
    'CS 484',
    'STAT 441',
  );
  expect(enhancementProgress(ai, mathOnly).planned).toBe(6);
  expect(enhancementProgress(ai, { ...mathOnly, 'SE 380': '3B' }).planned).toBe(
    7,
  );
  expect(enhancementProgress(ai, planned('AMATH 449', 'CS 479')).planned).toBe(
    1,
  );
});

test('enforces business course-level minimums and HCI equivalent-course limits', () => {
  const business = enhancement('business');
  const lower = planned(
    'CS 348',
    'CS 490',
    'AFM 101',
    'AFM 102',
    'ECON 101',
    'ECON 102',
    'COMM 101',
  );
  expect(enhancementProgress(business, lower).planned).toBe(5);
  expect(
    enhancementProgress(business, {
      ...lower,
      'MSE 311': '3B',
      'ACTSC 231': '3A',
    }).planned,
  ).toBe(7);
  expect(
    enhancementProgress(
      enhancement('hci'),
      planned('CS 445', 'ECE 451', 'SE 463'),
    ).planned,
  ).toBe(1);
});

test('selection changes active requirements without mutating the catalog or scheduled courses', () => {
  const plan = { ...initialPlan, 'CS 486': '4A' };
  const snapshot = { ...plan };
  const active = activeCurriculum(
    courses,
    requirements.groups,
    requirements.choiceRequirements,
    ['ai', 'co-minor'],
    plan,
  );
  expect(active.courses.find((item) => item.code === 'CS 486')?.required).toBe(
    true,
  );
  expect(active.courses.find((item) => item.code === 'CS 348')?.group).toBe(
    'Core courses',
  );
  expect(active.groups).toContain('Artificial Intelligence Specialization');
  const seeds = remainingPaletteSeeds(active.courses, plan, active.choices);
  expect(seeds.some((item) => item.code === 'CS 486')).toBe(false);
  expect(seeds.some((item) => item.code === 'CS 492')).toBe(true);
  expect(seeds.some((item) => item.code === 'CO 250')).toBe(true);
  const removed = activeCurriculum(
    courses,
    requirements.groups,
    requirements.choiceRequirements,
    [],
    plan,
  );
  expect(removed.courses.find((item) => item.code === 'CS 486')?.required).toBe(
    false,
  );
  expect(plan).toEqual(snapshot);
  expect(courses.find((item) => item.code === 'CS 486')?.required).toBe(false);
});

test('generator includes selected enhancement requirements and preserves existing terms', () => {
  const active = activeCurriculum(
    courses,
    requirements.groups,
    requirements.choiceRequirements,
    ['co-minor'],
    initialPlan,
  );
  const result = generateWishlistPlan(
    [],
    initialPlan,
    sequences['Stream 8X'],
    true,
    active.courses,
    active.choices,
  );
  Object.entries(initialPlan).forEach(([code, term]) =>
    expect(result.plan[code]).toBe(term),
  );
  expect(result.plan['CO 250'] || result.plan['CO 255']).toBeTruthy();
  expect(
    enhancementProgress(enhancement('co-minor'), result.plan).planned,
  ).toBe(8);
});

test('persisted selections reject unknown plans, duplicates and malformed input', () => {
  expect(readEnhancementIds('["ai","ai","unknown","co-minor"]')).toEqual([
    'ai',
    'co-minor',
  ]);
  expect(readEnhancementIds('oops')).toEqual([]);
  expect(readEnhancementIds('{"ai":true}')).toEqual([]);
});

test.each(['ai', 'business', 'fine-art', 'hci', 'co-minor'])(
  'auto-fill covers %s without losing named degree requirements',
  (id) => {
    const active = activeCurriculum(
      courses,
      requirements.groups,
      requirements.choiceRequirements,
      [id],
      initialPlan,
    );
    const result = generateWishlistPlan(
      [],
      initialPlan,
      sequences['Stream 8X'],
      true,
      active.courses,
      active.choices,
    );
    expect(result.unplaced).toEqual([]);
    const progress = enhancementProgress(enhancement(id), result.plan);
    expect(progress.planned).toBe(progress.total);
    active.courses
      .filter((course) => course.required)
      .forEach((course) => expect(result.plan[course.code]).toBeTruthy());
  },
);

test('auto-fill does not consume a new requirement slot with an already planned overlapping course', () => {
  const plan = { ...initialPlan, 'CS 480': '4A' };
  const active = activeCurriculum(
    courses,
    requirements.groups,
    requirements.choiceRequirements,
    ['ai'],
    plan,
  );
  const result = generateWishlistPlan(
    [],
    plan,
    sequences['Stream 8X'],
    true,
    active.courses,
    active.choices,
  );
  expect(result.plan['CS 480']).toBe('4A');
  expect(enhancementProgress(enhancement('ai'), result.plan).planned).toBe(7);
});
