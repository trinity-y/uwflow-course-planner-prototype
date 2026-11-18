import { unplannedPaletteGraph } from './paletteGraph';
import { PlannerCourse } from './plannerData';
import {
  remainingPaletteSeeds,
  searchPaletteSeeds,
} from './remainingPaletteSeeds';

const course = (
  code: string,
  required: boolean,
  prerequisites: string[] = [],
): PlannerCourse => ({
  code,
  title: code,
  group: 'Test',
  required,
  prerequisites,
});
const catalog = [
  course('A', true),
  course('B', true, ['A']),
  course('C', true),
  course('D', true, ['B']),
  course('E', true, ['B']),
  course('OPTION 1', false),
  course('OPTION 2', false),
  course('UNRELATED', false),
];

const visible = (plan: Record<string, string>) =>
  unplannedPaletteGraph(
    remainingPaletteSeeds(catalog, plan),
    catalog,
    plan,
  ).nodes.map((node) => node.course.code);

test('shows only unplanned courses leading to an unfulfilled requirement', () => {
  const plan = { A: '1A', B: '1B', C: '1B' };
  expect(remainingPaletteSeeds(catalog, plan).map((item) => item.code)).toEqual(
    ['D', 'E'],
  );
  expect(visible(plan)).toEqual(['D', 'E']);
  expect(visible({ ...plan, D: '2A' })).toEqual(['E']);
  expect(visible({ ...plan, D: '2A', E: '2B' })).toEqual([]);
  expect(visible(plan)).not.toContain('UNRELATED');
});

test('hides planned required courses even when a remaining course depends on them', () => {
  const dependent = [...catalog, course('F', true, ['D'])];
  const plan = { A: '1A', B: '1B', C: '1B', D: '2A', E: '2B' };
  const graph = unplannedPaletteGraph(
    remainingPaletteSeeds(dependent, plan),
    dependent,
    plan,
  );
  expect(graph.nodes.map((node) => node.course.code)).toEqual(['F']);
});

test('only unsatisfied choice groups contribute optional roots', () => {
  const choices = [{ courses: ['OPTION 1', 'OPTION 2'], count: 1 }];
  const plan = { A: '1A', B: '1B', C: '1B', D: '2A', E: '2B' };
  expect(
    remainingPaletteSeeds(catalog, plan, choices).map((item) => item.code),
  ).toEqual(['OPTION 1', 'OPTION 2']);
  expect(
    remainingPaletteSeeds(catalog, { ...plan, 'OPTION 1': '3A' }, choices),
  ).toEqual([]);
});

test('searching a planned ancestor preserves its remaining dependent paths', () => {
  const seeds = remainingPaletteSeeds(catalog, { A: '1A', B: '1B', C: '1B' });
  expect(
    searchPaletteSeeds(seeds, catalog, 'a').map((item) => item.code),
  ).toEqual(['D', 'E']);
  expect(searchPaletteSeeds(seeds, catalog, 'unrelated')).toEqual([]);
  expect(
    searchPaletteSeeds(seeds, catalog, ' D ').map((item) => item.code),
  ).toEqual(['D']);
});
