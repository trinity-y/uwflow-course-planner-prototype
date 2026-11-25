import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTerms, initialPlan, isTermLocked, sampleCatalog, solverLockCutoff, termOrder } from './calendar.mjs';
import {
  buildGraph, countableSchedule, explainMissing, groupProgress, indexPlan, missingGroups,
  isAcademicCourse, parseLivePrerequisites, placeCourse, planWithLockedSuggestions, profileThroughLevel, readOutcomes, readPlan, readTermDetails,
  readTermTargets, readYearRange, removeCourse,
} from './model.mjs';

const required = (plan, code) => {
  const scheduled = indexPlan(plan);
  return missingGroups(sampleCatalog.get(code), scheduled.get(code), scheduled);
};
const oneOf = (...options) => ({ count: 1, options });

test('initial term targets include calendar electives and preserve saved edits', () => {
  const targets = readTermTargets({ '2024-winter': 5, '2024-fall': -1 });
  assert.equal(targets['2024-winter'], 5);
  assert.equal(targets['2024-fall'], 6);
  assert.equal(targets['2025-spring'], 7);
  assert.equal(targets['2027-spring'] - initialPlan()['2027-spring'].length, 2);
  assert.equal(targets['2028-winter'] - initialPlan()['2028-winter'].length, 4);
  assert.equal(targets['2028-spring'], 0);
  assert.equal(targets['2028-fall'], 0);
});

test('expanded year ranges support saved courses, titles and notes in new terms', () => {
  const range = readYearRange({ start: 2028, end: 2029 });
  const terms = createTerms(range);
  const plan = placeCourse(readPlan(undefined, terms), 'CS 370', '2029-winter');
  assert.equal(indexPlan(readPlan(plan, terms)).get('CS 370'), '2029-winter');
  assert.match(explainMissing([oneOf('CS 370')], '2028-fall', indexPlan(plan)), /Winter 2029/);
  const details = readTermDetails({
    titles: { '2029-spring': ' Exchange ', '2029-fall': '', '2030-fall': 'Outside the timeline' },
    notes: { '2029-spring': [{ title: ' Project ', body: ' Hold this slot ' }, { title: '  ' }] },
  }, terms);
  assert.deepEqual(details, {
    titles: { '2029-spring': 'Exchange', '2029-fall': '' },
    notes: { '2029-spring': [{ title: 'Project', body: 'Hold this slot' }] },
  });
  assert.deepEqual(['CS 370', 'PD 19', 'COOP 1', 'WKRPT 200'].filter(isAcademicCourse), ['CS 370']);
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

test('a personal plan cutoff includes the selected study term and clears every later term', () => {
  const profile = {
    terms: { '2026-winter': { level: '', work: true }, '2026-spring': { level: '3A', work: false } },
    plan: {
      '2025-spring': ['SE 212'], '2026-winter': ['PD 10'], '2026-spring': ['SE 301'],
      '2026-fall': ['SE 302', 'CS 343'], '2027-winter': ['COOP 5'], '2027-spring': ['CS 488'],
      '2029-spring': ['ENGL 109'],
    },
    additions: { '2026-spring': ['SE 301'], '2026-fall': ['SE 390'], '2027-spring': ['SE 490'] },
    outcomes: { 'SE 212': 'passed', 'SE 301': 'enrolled', 'SE 302': 'enrolled', 'CS 343': 'passed' },
    favorites: [{ code: 'CS 488' }],
  };

  assert.equal(profileThroughLevel(profile, ''), profile);
  const cutoff = profileThroughLevel(profile, '3A');
  assert.deepEqual(cutoff.plan['2026-winter'], ['PD 10']);
  assert.deepEqual(cutoff.plan['2026-spring'], ['SE 301']);
  for (const id of ['2026-fall', '2027-winter', '2027-spring', '2028-winter', '2029-spring']) {
    assert.deepEqual(cutoff.plan[id], []);
  }
  assert.deepEqual(cutoff.additions, { '2026-spring': ['SE 301'] });
  assert.deepEqual(cutoff.outcomes, { 'SE 212': 'passed', 'SE 301': 'enrolled' });
  assert.deepEqual(cutoff.favorites, profile.favorites);
  assert.deepEqual(profile.plan['2026-fall'], ['SE 302', 'CS 343']);
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
  assert.equal(placeCourse(later, 'CS 370', '2022-winter'), later);
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

test('term locks follow local term boundaries, completed transcript terms and explicit overrides', () => {
  const cutoff = (year, month, day) => solverLockCutoff(undefined, new Date(year, month - 1, day));
  assert.equal(isTermLocked('2026-winter', {}, cutoff(2026, 4, 30)), false);
  assert.equal(isTermLocked('2026-winter', {}, cutoff(2026, 5, 1)), true);
  assert.equal(isTermLocked('2026-spring', {}, cutoff(2026, 9, 1)), true);
  assert.equal(isTermLocked('2026-fall', {}, cutoff(2027, 1, 1)), true);
  const imported = solverLockCutoff({ solveFrom: termOrder('2027-winter') }, new Date(2026, 10, 25));
  assert.equal(isTermLocked('2026-fall', {}, imported), true);
  assert.equal(isTermLocked('2026-fall', { '2026-fall': { locked: false } }, imported), false);
  assert.equal(isTermLocked('2027-spring', { '2027-spring': { locked: true } }, imported), true);
});

test('locked suggestions stay with their term until unlocked and respect a later manual placement', () => {
  const plan = { '2026-fall': ['CS 137'], '2027-winter': ['EARTH 121'] };
  const lock = { '2026-fall': { locked: true, suggestions: ['PHYS 121', 'EARTH 121'] } };
  const pinned = planWithLockedSuggestions(plan, lock);
  assert.deepEqual(pinned['2026-fall'], ['CS 137', 'PHYS 121']);
  assert.deepEqual(pinned['2027-winter'], ['EARTH 121']);
  assert.deepEqual(planWithLockedSuggestions(plan, { '2026-fall': { locked: false } })['2026-fall'], ['CS 137']);
  assert.deepEqual(plan['2026-fall'], ['CS 137']);
});
