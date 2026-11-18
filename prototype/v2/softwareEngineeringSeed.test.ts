import { generateWishlistPlan } from './generateWishlistPlan';
import { paletteGraph } from './paletteGraph';
import {
  canPlace,
  courses,
  initialPlan,
  prerequisiteIssues,
  prerequisitePaths,
  prerequisiteRoutes,
  requirements,
  sequences,
  termCapacity,
} from './plannerData';
import { prerequisiteChoices } from './prerequisiteChoices';
import { sampleCourseDetails } from './sampleCourseClient';

const find = (code: string) => {
  const course = courses.find((item) => item.code === code);
  if (!course) throw new Error(`Missing course: ${code}`);
  return course;
};

test('SE core, term loads, credits and choices match the 2025–2026 calendar', () => {
  expect(Object.keys(initialPlan)).toEqual([
    'CS 137',
    'CHE 102',
    'MATH 115',
    'MATH 117',
    'MATH 135',
    'SE 101',
    'CS 138',
    'ECE 124',
    'ECE 140',
    'ECE 192',
    'MATH 119',
    'SE 102',
  ]);
  expect(find('SE 101').units).toBe(0.25);
  expect(find('SE 102').units).toBe(0);
  expect(find('ECE 192').units).toBe(0.25);
  expect(find('SE 350').required).toBe(true);
  expect(find('CS 350').required).toBe(false);
  expect(find('CS 246').required).toBe(false);
  expect(find('CS 240').required).toBe(true);
  expect(find('ENGL 109').required).toBe(false);
  expect(
    requirements.choiceRequirements.map((choice) => choice.courses),
  ).toEqual([
    ['ECE 105', 'PHYS 115', 'PHYS 121'],
    ['CS 349', 'CS 449', 'MSE 343'],
    ['GENE 403', 'SE 490'],
    ['GENE 404', 'SE 491'],
  ]);
  expect(termCapacity('1A')).toBe(6);
  expect(
    canPlace(find('SE 101'), '1A', initialPlan, sequences['Stream 8X']),
  ).toBe('');
  expect(prerequisiteIssues(initialPlan, sequences['Stream 8X'])).toEqual([]);
});

test('published sequences include six work terms and the 8X/8Y final-year difference', () => {
  expect(Object.keys(sequences)).toEqual(['Stream 8X', 'Stream 8Y']);
  expect(sequences['Stream 8X'].slice(-5)).toEqual([
    '3B',
    'WT5',
    'WT6',
    '4A',
    '4B',
  ]);
  expect(sequences['Stream 8Y'].slice(-5)).toEqual([
    '3B',
    '4A',
    'WT5',
    'WT6',
    '4B',
  ]);
});

test('real prerequisite graph resolves every reference and preserves valid alternatives', () => {
  expect(() => paletteGraph(courses, courses)).not.toThrow();
  expect(find('CS 247').prerequisiteOptions).toEqual([['CS 241'], ['CS 241E']]);
  expect(find('SE 212').prerequisiteOptions).toEqual([['CS 138', 'MATH 135']]);
  expect(find('SE 350').prerequisiteOptions).toContainEqual([
    'ECE 222',
    'CS 240',
    'CS 247',
  ]);
  const path = prerequisitePaths(find('CS 247'))[0];
  expect(path.codes).toEqual(['CS 137', 'CS 138', 'CS 241']);
  expect(sampleCourseDetails.cs247.course[0].antireqs).toContain('CS246');
  expect(sampleCourseDetails.cs241e.course[0].prereqs).toContain('85%');
  expect(sampleCourseDetails.se102.course[0].description).toBe(
    'General seminar.',
  );
  expect(
    Object.values(sampleCourseDetails).every(
      (response) => response.course[0].sections.length === 0,
    ),
  ).toBe(true);
});

test('generation preserves the cohort example and includes just one option per required choice', () => {
  const result = generateWishlistPlan([], initialPlan, sequences['Stream 8X']);
  Object.entries(initialPlan).forEach(([code, term]) =>
    expect(result.plan[code]).toBe(term),
  );
  requirements.choiceRequirements.forEach((choice) => {
    expect(choice.courses.filter((code) => result.plan[code])).toHaveLength(1);
  });
  expect(result.plan['PD 19']).toBe('WT1');
  expect(result.plan['PD 20']).toBe('WT2');
  expect(prerequisiteIssues(result.plan, sequences['Stream 8X'])).toEqual([]);
});

test('SE 350 has distinct, non-redundant paths with identifiable nested choices', () => {
  const paths = prerequisitePaths(find('SE 350'));
  const routes = prerequisiteRoutes(find('SE 350'));
  expect(paths).toHaveLength(15);
  expect(new Set(routes.map((route) => route.label)).size).toBe(15);
  expect(
    routes.some(
      (route) =>
        route.label.includes('CS 240: CS 241') &&
        route.label.includes('CS 247: CS 241E'),
    ),
  ).toBe(true);
  expect(
    paths.some((path) => path.requirements['CS 240']?.includes('CS 247')),
  ).toBe(false);
});

test('SE 350 presents two independent choices alongside its mandatory ECE course', () => {
  expect(prerequisiteChoices(find('SE 350'))).toEqual({
    mandatory: ['ECE 222'],
    groups: [
      [['CS 240'], ['CS 240E']],
      [['CS 247'], ['CS 246']],
    ],
  });
});
