import { PlannerCourse } from './plannerData';
import {
  choiceKey,
  initialPrerequisiteSelections,
  missingPrerequisiteRows,
  prerequisiteChoices,
  selectedPrerequisiteTree,
} from './prerequisiteChoices';

const course = (
  code: string,
  prerequisiteOptions: string[][] = [[]],
): PlannerCourse => ({
  code,
  title: code,
  required: true,
  group: 'Test',
  prerequisites: prerequisiteOptions[0],
  prerequisiteOptions,
});

test('factors mandatory courses and independent alternatives without enumerating full paths', () => {
  const root = course('ROOT', [
    ['M', 'A', 'X'],
    ['M', 'A', 'Y'],
    ['M', 'B', 'X'],
    ['M', 'B', 'Y'],
  ]);
  expect(prerequisiteChoices(root)).toEqual({
    mandatory: ['M'],
    groups: [
      [['A'], ['B']],
      [['X'], ['Y']],
    ],
  });
});

test('keeps coupled alternatives together instead of inventing combinations', () => {
  const root = course('ROOT', [
    ['M', 'A', 'B'],
    ['M', 'C', 'D'],
  ]);
  expect(prerequisiteChoices(root)).toEqual({
    mandatory: ['M'],
    groups: [
      [
        ['A', 'B'],
        ['C', 'D'],
      ],
    ],
  });
});

test('reveals only chosen branches, resolves nested choices, and shares prerequisite nodes', () => {
  const catalog = [
    course('ROOT', [
      ['A', 'B'],
      ['A', 'C'],
    ]),
    course('A', [['X'], ['Y']]),
    course('B', [['X']]),
    course('C'),
    course('X'),
    course('Y'),
  ];
  const selections = { [choiceKey('ROOT', 0)]: 0, [choiceKey('A', 0)]: 0 };
  const tree = selectedPrerequisiteTree(catalog[0], catalog, selections);
  expect(tree.unresolved).toEqual([]);
  expect(tree.rows.map((row) => row.course.code)).toEqual([
    'ROOT',
    'A',
    'X',
    'B',
  ]);
  expect(tree.rows.find((row) => row.course.code === 'X')?.requiredBy).toEqual([
    'A',
    'B',
  ]);
  expect(tree.catalog[0].prerequisiteOptions).toEqual([['A', 'B']]);
  const changed = selectedPrerequisiteTree(catalog[0], catalog, {
    ...selections,
    [choiceKey('ROOT', 0)]: 1,
  });
  expect(changed.rows.map((row) => row.course.code)).toEqual([
    'ROOT',
    'A',
    'X',
    'C',
  ]);
  const unresolved = selectedPrerequisiteTree(catalog[0], catalog, {});
  expect(unresolved.unresolved).toHaveLength(2);
  expect(unresolved.rows.map((row) => row.course.code)).toEqual(['ROOT', 'A']);
});

test('preselects only planned alternatives that precede their dependent', () => {
  const catalog = [course('ROOT', [['A'], ['B']]), course('A'), course('B')];
  expect(
    initialPrerequisiteSelections(catalog, { A: '1A' }, ['1A', '1B'], '1B'),
  ).toEqual({ 'ROOT:0': 0 });
  expect(
    initialPrerequisiteSelections(catalog, { A: '1B' }, ['1A', '1B'], '1B'),
  ).toEqual({});
});

test('hides satisfied planned nodes but preserves missing ancestors and validation rules', () => {
  const catalog = [course('ROOT', [['A']]), course('A', [['X']]), course('X')];
  const tree = selectedPrerequisiteTree(catalog[0], catalog, {});
  const rows = missingPrerequisiteRows(
    tree,
    { A: '1B' },
    ['1A', '1B', '2A'],
    '2A',
  );
  expect(rows.map((row) => row.course.code)).toEqual(['ROOT', 'X']);
  expect(rows[1].requiredBy).toEqual(['ROOT']);
  expect(rows[1].depth).toBe(1);
  expect(tree.catalog.find((item) => item.code === 'A')?.prerequisites).toEqual(
    ['X'],
  );
  expect(
    missingPrerequisiteRows(
      tree,
      { A: '1B', X: '1A' },
      ['1A', '1B', '2A'],
      '2A',
    ).map((row) => row.course.code),
  ).toEqual(['ROOT']);
});

test('keeps planned courses that need moving or an unresolved prerequisite choice', () => {
  const catalog = [
    course('ROOT', [['A']]),
    course('A', [['X'], ['Y']]),
    course('X'),
    course('Y'),
  ];
  const tree = selectedPrerequisiteTree(catalog[0], catalog, {});
  expect(
    missingPrerequisiteRows(tree, { A: '1B' }, ['1A', '1B', '2A'], '2A').map(
      (row) => row.course.code,
    ),
  ).toEqual(['ROOT', 'A']);
  const resolved = selectedPrerequisiteTree(catalog[0], catalog, { 'A:0': 0 });
  expect(
    missingPrerequisiteRows(
      resolved,
      { A: '2A', X: '1A' },
      ['1A', '1B', '2A'],
      '1B',
    ).map((row) => row.course.code),
  ).toEqual(['ROOT', 'A']);
});
