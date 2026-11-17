import {
  paletteEdgeOnRoute,
  paletteGraph,
  unplannedPaletteGraph,
} from './paletteGraph';
import { courses, PlannerCourse } from './plannerData';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

test('connects actual parents to all children without duplicating shared prerequisites', () => {
  const graph = paletteGraph(
    courses.filter((course) => course.code === 'CS 350'),
    courses,
  );
  expect(
    graph.nodes.filter((node) => node.course.code === 'CS 136'),
  ).toHaveLength(1);
  const children = graph.edges
    .filter((edge) => edge.from.course.code === 'CS 136')
    .map((edge) => edge.to.course.code);
  expect(children.sort()).toEqual(['CS 240', 'CS 246', 'CS 251']);
  graph.edges.forEach((edge) => expect(edge.from.y).toBeLessThan(edge.to.y));
  expect(
    graph.edges.find(
      (edge) =>
        edge.from.course.code === 'CS 240' && edge.to.course.code === 'CS 350',
    )?.alternative,
  ).toBe(true);
  expect(
    graph.edges.find(
      (edge) =>
        edge.from.course.code === 'CS 251' && edge.to.course.code === 'CS 350',
    )?.alternative,
  ).toBe(false);
  expect(
    graph.nodes.find((node) => node.course.code === 'CS 240')?.course.required,
  ).toBe(false);
  expect(
    graph.nodes.find((node) => node.course.code === 'CS 246')?.course.required,
  ).toBe(true);
});

test('a filtered dependent retains its prerequisite context', () => {
  const graph = paletteGraph(
    courses.filter((course) => course.code === 'CS 247'),
    courses,
  );
  expect(graph.nodes.map((node) => node.course.code).sort()).toEqual([
    'CS 135',
    'CS 136',
    'CS 246',
    'CS 247',
    'CS 251',
  ]);
  expect(new Set(graph.nodes.map((node) => node.course.code)).size).toBe(
    graph.nodes.length,
  );
});

test('all courses use compact rows without gaps or detached connections', () => {
  const seeds = courses.filter((course) => course.code === 'CS 246');
  const graph = paletteGraph(seeds, courses);
  expect(
    graph.nodes.map((node) => [node.course.code, node.y, node.height]),
  ).toEqual([
    ['CS 135', 0, 40],
    ['CS 136', 52, 40],
    ['CS 246', 104, 40],
  ]);
  expect(graph.height).toBe(144);
  expect(graph.edges[0].from).toBe(graph.nodes[0]);
  expect(graph.edges[0].to).toBe(graph.nodes[1]);
});

test('row geometry is configurable independently from stacking and requirements', () => {
  const seeds = courses.filter((course) => course.code === 'CS 246');
  const graph = paletteGraph(seeds, courses, {
    rowHeight: 32,
    rowGap: 8,
    indent: 16,
    gutter: 12,
    stacking: 'branches',
  });
  expect(
    graph.nodes.map((node) => [node.course.code, node.x, node.y, node.height]),
  ).toEqual([
    ['CS 135', 12, 0, 32],
    ['CS 136', 28, 40, 32],
    ['CS 246', 44, 80, 32],
  ]);
  expect(graph.height).toBe(112);
});

test('default branch stacking keeps CS 247 ahead of the unrelated CS 240 branch', () => {
  const graph = paletteGraph(
    courses.filter((course) => course.group === 'Computer science'),
    courses,
  );
  expect(graph.nodes.map((node) => node.course.code)).toEqual([
    'CS 135',
    'CS 136',
    'CS 246',
    'CS 251',
    'CS 247',
    'CS 240',
    'CS 350',
  ]);
  graph.edges.forEach((edge) => expect(edge.from.y).toBeLessThan(edge.to.y));
});

test('hides planned intermediates and reconnects missing ancestors without changing course rules', () => {
  const fixture = (
    code: string,
    prerequisiteOptions: string[][],
  ): PlannerCourse => ({
    code,
    title: code,
    group: 'test',
    required: true,
    prerequisites: prerequisiteOptions[0],
    prerequisiteOptions,
  });
  const catalog = [
    fixture('ROOT', [['HIDDEN']]),
    fixture('HIDDEN', [['A'], ['B']]),
    fixture('A', [[]]),
    fixture('B', [[]]),
  ];
  const plan = { HIDDEN: '1B' };
  const graph = unplannedPaletteGraph([catalog[0]], catalog, plan);
  expect(graph.nodes.map((node) => node.course.code)).toEqual([
    'A',
    'B',
    'ROOT',
  ]);
  expect(
    graph.edges.map((edge) => [
      edge.from.course.code,
      edge.to.course.code,
      edge.alternative,
    ]),
  ).toEqual([
    ['A', 'ROOT', true],
    ['B', 'ROOT', true],
  ]);
  expect(graph.nodes.find((node) => node.course.code === 'ROOT')?.course).toBe(
    catalog[0],
  );
  expect(graph.nodes.map((node) => node.y)).toEqual([0, 52, 104]);
  expect(
    paletteEdgeOnRoute('A', 'ROOT', new Set(['A→HIDDEN', 'HIDDEN→ROOT']), plan),
  ).toBe(true);
  expect(
    paletteEdgeOnRoute('B', 'ROOT', new Set(['A→HIDDEN', 'HIDDEN→ROOT']), plan),
  ).toBe(false);
  expect(
    paletteEdgeOnRoute('A', 'ROOT', new Set(['A→HIDDEN', 'HIDDEN→ROOT']), {}),
  ).toBe(false);
  const satisfied = unplannedPaletteGraph([catalog[0]], catalog, {
    ...plan,
    A: '1A',
  });
  expect(satisfied.nodes.map((node) => node.course.code)).toEqual(['ROOT']);
});
