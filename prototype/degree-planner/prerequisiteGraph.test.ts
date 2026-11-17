import { courses } from './plannerData';
import {
  buildPrerequisiteGraph,
  orderPrerequisiteGraph,
  RequirementNode,
  traceCoursePath,
} from './prerequisiteGraph';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

const catalog: RequirementNode[] = [
  { code: 'ROOT', prerequisiteOptions: [] },
  { code: 'A', prerequisiteOptions: [['ROOT']] },
  { code: 'B', prerequisiteOptions: [['ROOT']] },
  { code: 'A1', prerequisiteOptions: [['A']] },
  { code: 'SHARED', prerequisiteOptions: [['A', 'B']] },
];

test('stacking strategies change order while preserving shared parents and dependency order', () => {
  const graph = buildPrerequisiteGraph(catalog, ['A1', 'SHARED']);
  expect(orderPrerequisiteGraph(graph, 'depth')).toEqual([
    'ROOT',
    'A',
    'B',
    'A1',
    'SHARED',
  ]);
  expect(orderPrerequisiteGraph(graph, 'branches')).toEqual([
    'ROOT',
    'A',
    'A1',
    'B',
    'SHARED',
  ]);
  for (const strategy of ['depth', 'branches'] as const) {
    const order = orderPrerequisiteGraph(graph, strategy);
    graph.edges.forEach((edge) =>
      expect(order.indexOf(edge.from)).toBeLessThan(order.indexOf(edge.to)),
    );
    expect(new Set(order).size).toBe(5);
  }
});

test('seed order does not change catalog tie-breaking', () => {
  expect(buildPrerequisiteGraph(catalog, ['A1', 'SHARED'])).toEqual(
    buildPrerequisiteGraph(catalog, ['SHARED', 'A1']),
  );
});

test('invalid references, duplicates, and cycles are reported', () => {
  expect(() =>
    buildPrerequisiteGraph(
      [{ code: 'A', prerequisiteOptions: [['MISSING']] }],
      ['A'],
    ),
  ).toThrow('Unknown prerequisite course: MISSING');
  expect(() =>
    buildPrerequisiteGraph([catalog[0], catalog[0]], ['ROOT']),
  ).toThrow('Duplicate course codes');
  expect(() =>
    buildPrerequisiteGraph(
      [
        { code: 'A', prerequisiteOptions: [['B']] },
        { code: 'B', prerequisiteOptions: [['A']] },
      ],
      ['A'],
    ),
  ).toThrow('Prerequisite cycle');
});

test('the JSON catalog forms a valid graph with every alternative ancestor', () => {
  const graph = buildPrerequisiteGraph(
    courses.map((course) => ({
      code: course.code,
      prerequisiteOptions: course.prerequisiteOptions ?? [],
    })),
    courses.map((course) => course.code),
  );
  expect(graph.nodes).toHaveLength(courses.length);
  expect(graph.edges).toContainEqual({
    from: 'CS 240',
    to: 'CS 350',
    alternative: true,
  });
  expect(graph.edges).toContainEqual({
    from: 'CS 251',
    to: 'CS 350',
    alternative: false,
  });
});

test('course highlighting follows only ancestors, excluding descendants and siblings', () => {
  const edges = [
    { from: 'CS 135', to: 'CS 136', alternative: false },
    { from: 'CS 136', to: 'CS 246', alternative: false },
    { from: 'CS 136', to: 'CS 251', alternative: false },
    { from: 'CS 246', to: 'CS 247', alternative: true },
    { from: 'CS 247', to: 'CS 400', alternative: false },
  ];
  const path = traceCoursePath(edges, 'CS 246');
  expect(Array.from(path.courses).sort()).toEqual([
    'CS 135',
    'CS 136',
    'CS 246',
  ]);
  expect(Array.from(path.connections).sort()).toEqual([
    'CS 135→CS 136',
    'CS 136→CS 246',
  ]);
  expect(traceCoursePath(edges, null).connections.size).toBe(0);
});

test('highlighting traverses alternative ancestors and handles shared paths once', () => {
  const graph = buildPrerequisiteGraph(catalog, ['SHARED']);
  const path = traceCoursePath(graph.edges, 'SHARED');
  expect(Array.from(path.courses).sort()).toEqual(['A', 'B', 'ROOT', 'SHARED']);
  expect(path.connections.size).toBe(4);
});
