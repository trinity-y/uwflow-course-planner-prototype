import assert from 'node:assert/strict';
import { test } from 'node:test';

import { initialPlan, sampleCatalog } from './calendar.mjs';
import {
  buildGraph, countableSchedule, explainMissing, groupProgress, indexPlan, missingGroups,
  parseLivePrerequisites, placeCourse, readOutcomes, readTermTargets, removeCourse,
} from './model.mjs';

const required = (plan, code) => {
  const scheduled = indexPlan(plan);
  return missingGroups(sampleCatalog.get(code), scheduled.get(code), scheduled);
};
const oneOf = (...options) => ({ count: 1, options });

test('initial term targets include calendar electives and preserve saved edits', () => {
  const targets = readTermTargets({ '2024-winter': 5, '2024-fall': -1 });
  assert.equal(targets['2024-winter'], 5);
  assert.equal(targets['2024-fall'], 7);
  assert.equal(targets['2025-spring'], 7);
  assert.equal(targets['2027-spring'] - initialPlan()['2027-spring'].length, 2);
  assert.equal(targets['2028-winter'] - initialPlan()['2028-winter'].length, 4);
});

test('passed and failed placements are locked and failed courses do not satisfy prerequisites', () => {
  const plan = initialPlan();
  const scheduled = indexPlan(plan);
  const outcomes = readOutcomes({
    'CS 137': 'failed', 'CS 138': 'enrolled', 'SE 101': 'passed',
    'CS 999': 'passed', 'ECE 105': 'unrecognized',
  }, scheduled);
  assert.deepEqual(outcomes, { 'CS 137': 'failed', 'SE 101': 'passed', 'CS 138': 'enrolled' });
  assert.equal(placeCourse(plan, 'CS 137', '2024-fall', outcomes), plan);
  assert.equal(removeCourse(plan, 'SE 101', outcomes), plan);
  assert.notEqual(placeCourse(plan, 'CS 138', '2024-fall', outcomes), plan);
  assert.deepEqual(
    missingGroups(sampleCatalog.get('CS 138'), '2024-winter', countableSchedule(scheduled, outcomes)),
    [oneOf('CS 137')],
  );
});

test('adding either alternative replaces the original bucket with only that course’s direct prerequisites', () => {
  const sample = initialPlan();
  assert.deepEqual(required(sample, 'CS 488'), [oneOf('CS 370', 'CS 371')]);

  const computation = placeCourse(sample, 'CS 370', '2026-spring');
  assert.deepEqual(required(computation, 'CS 488'), []);
  assert.deepEqual(required(computation, 'CS 370'), []);

  const computationalMath = placeCourse(sample, 'CS 371', '2026-spring');
  assert.deepEqual(required(computationalMath, 'CS 488'), []);
  assert.deepEqual(required(computationalMath, 'CS 371'), [oneOf('MATH 235'), oneOf('MATH 237')]);
});

test('a two-of bucket keeps only the outstanding options as earlier courses meet the count', () => {
  const plan = placeCourse(initialPlan(), 'FR 255', '2026-spring');
  const first = placeCourse(plan, 'FR 192A', '2025-spring');
  const [group] = required(first, 'FR 255');
  assert.deepEqual(groupProgress(group, '2026-spring', indexPlan(first)), {
    outstanding: ['FR 192B', 'FR 296'],
    remaining: 1,
  });
  const second = placeCourse(first, 'FR 192B', '2025-fall');
  assert.deepEqual(required(second, 'FR 255'), []);
});

test('same-term or later alternatives still need an earlier term', () => {
  const sample = initialPlan();
  const same = placeCourse(sample, 'CS 370', '2027-spring');
  assert.deepEqual(required(same, 'CS 488'), [oneOf('CS 370', 'CS 371')]);

  const later = placeCourse(same, 'CS 370', '2027-fall');
  assert.equal(later['2027-spring'].includes('CS 370'), false);
  assert.match(
    explainMissing(required(later, 'CS 488'), '2027-spring', indexPlan(later)),
    /CS 370 \(in Fall 2027, needs an earlier term\)/,
  );
  assert.equal(placeCourse(later, 'CS 370', '2023-winter'), later);
});

test('the graph includes earlier steps beyond the first-level buckets', () => {
  const { depth, edges } = buildGraph('CS 488', (code) => sampleCatalog.get(code));
  assert.deepEqual(edges.get('CS 488'), [oneOf('CS 341'), oneOf('CS 350', 'SE 350'), oneOf('CS 370', 'CS 371')]);
  assert.equal(depth.get('CS 137') > depth.get('CS 138'), true);
  assert.equal(depth.get('CS 138') > depth.get('CS 371'), true);
});

test('live course-only prerequisites keep AND and OR groups separate', () => {
  assert.deepEqual(parseLivePrerequisites('CS 341 and (CS 350 or SE 350)').groups, [
    oneOf('CS 341'), oneOf('CS 350', 'SE 350'),
  ]);
  assert.deepEqual(parseLivePrerequisites('Two of FR 192A, FR 192B, FR 296').groups, [
    { count: 2, options: ['FR 192A', 'FR 192B', 'FR 296'] },
  ]);
  assert.equal(parseLivePrerequisites('CS 341 or CS 350 and SE 350').groups, null);
  assert.deepEqual(parseLivePrerequisites('CS 341; Honours BCS only'), {
    groups: null, references: ['CS 341'],
  });
});
