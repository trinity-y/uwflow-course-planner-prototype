import assert from 'node:assert/strict';
import { test } from 'node:test';
import { solveAuto } from './auto-plan.mjs';
import { sampleCatalog, termOrder, terms } from './calendar.mjs';
import { evaluateDegree } from './degree.mjs';
import requirements from './degree-requirements.json' with { type: 'json' };
import archive from './calendar-courses.json' with { type: 'json' };

function inputs(overrides = {}) {
  return {
    plan: Object.fromEntries(terms.map(({ id }) => [id, []])),
    timeline: terms,
    activeTerms: terms.map(({ id }) => id),
    targets: Object.fromEntries(terms.map(({ id, target }) => [id, target])),
    groups: Object.fromEntries([...sampleCatalog].map(([code, course]) => [code, course.groups])),
    requirements,
    archive,
    ...overrides,
  };
}

test('a blank auto plan meets every enabled rule and fits the academic term targets', () => {
  const data = inputs();
  const progress = [];
  const result = solveAuto(data, (value) => progress.push(value));
  assert.equal(result.suggestions.length, 51);
  assert.deepEqual(result.issues, []);
  assert.equal(progress.at(-1), 1);
  const schedule = new Map(result.suggestions);
  assert.equal(evaluateDegree(requirements, archive, schedule).percent, 100);
  for (const { id, level, target } of terms) {
    assert.ok(result.suggestions.filter(([, term]) => term === id).length <= target);
    for (const code of requirements.coreByLevel[level] ?? []) assert.equal(schedule.get(code), id);
  }
});

test('must-take courses get prerequisites and banned alternatives stay out of the plan', () => {
  const result = solveAuto(inputs({ preferences: { 'CS 488': 'required', 'CS 371': 'banned', 'CS 370': 'interested' } }));
  const schedule = new Map(result.suggestions);
  assert.equal(result.met, result.total);
  assert.equal(schedule.has('CS 371'), false);
  assert.ok(termOrder(schedule.get('CS 370')) < termOrder(schedule.get('CS 488')));
  assert.deepEqual(result.unscheduled, {});
  assert.equal(result.suggestions.length, 51);
});

test('Auto uses a calendar exception when a study term cannot hold all six required courses', () => {
  const data = inputs();
  const result = solveAuto({ ...data, targets: { ...data.targets, '2026-fall': 5, '2027-spring': 8 } });
  const schedule = new Map(result.suggestions);
  const rule = evaluateDegree(requirements, archive, schedule).rules.find(({ id }) => id === 'core-3b');
  assert.equal(rule.met, true);
  const elsewhere = rule.matched.filter((code) => schedule.get(code) !== '2026-fall');
  assert.equal(elsewhere.length, 1);
  assert.ok(requirements.outOfSequence.includes(elsewhere[0]));
});

test('opinions break ties without adding courses and seeds can change the proposed plan', () => {
  const options = inputs({ preferences: { 'EARTH 121': 'interested', 'BIOL 110': 'dislike' } });
  const first = solveAuto(options);
  const second = solveAuto({ ...options, seed: 1 });
  for (const result of [first, second]) {
    const codes = new Set(result.suggestions.map(([code]) => code));
    assert.equal(result.suggestions.length, 51);
    assert.ok(codes.has('EARTH 121'));
    assert.ok(!codes.has('BIOL 110'));
  }
  assert.notDeepEqual(new Map(first.suggestions), new Map(second.suggestions));
});

test('impossible constraints keep pinned attempts and explain unplaced requests', () => {
  const plan = inputs().plan;
  plan['2023-fall'].push('CS 137');
  const data = inputs({
    plan,
    targets: Object.fromEntries(terms.map(({ id }) => [id, 0])),
    outcomes: { 'CS 137': 'failed' },
    preferences: { 'CS 137': 'required', 'CS 488': 'required' },
  });
  const result = solveAuto(data);
  assert.equal(result.fits, false);
  assert.deepEqual(plan['2023-fall'], ['CS 137']);
  assert.deepEqual(result.suggestions, []);
  assert.match(result.unscheduled['CS 137'], /failed attempt/);
  assert.ok(result.unscheduled['CS 488']);
  assert.match(result.issues[0], /pinned classes/);
});

test('an overloaded manual calendar fails atomically and suggests a verified single-target repair', () => {
  const data = inputs();
  data.plan['2023-fall'] = [...requirements.coreByLevel['1A']];
  data.targets['2023-fall'] = 5;
  const result = solveAuto(data);
  assert.equal(result.fits, false);
  assert.deepEqual(result.suggestions, []);
  assert.deepEqual(result.alternatives, [{ '2023-fall': 6 }]);
  assert.equal(solveAuto({ ...data, targets: { ...data.targets, ...result.alternatives[0] } }).fits, true);
  assert.equal(data.targets['2023-fall'], 5);
  assert.equal(data.plan['2023-fall'].length, 6);
});

test('no partial electives appear if a must-take cannot fit even with every degree rule disabled', () => {
  const data = inputs({ preferences: { 'CS 488': 'required' }, disabled: requirements.rules.map((rule) => rule.id) });
  data.activeTerms = ['2023-fall'];
  data.targets = { '2023-fall': 1 };
  const result = solveAuto(data);
  assert.equal(result.fits, false);
  assert.deepEqual(result.suggestions, []);
  assert.ok(result.unscheduled['CS 488']);
});

test('electives prefer the most rated eligible option, with reproducible placements for a seed', () => {
  const data = inputs({ disabled: requirements.rules.filter(({ id }) => id !== 'mechanics').map(({ id }) => id) });
  const first = solveAuto(data);
  assert.equal(first.fits, true);
  assert.deepEqual(first.suggestions.map(([code]) => code), ['PHYS 121']);
  assert.deepEqual(solveAuto(data).suggestions, first.suggestions);
});

test('notes alone cannot exceed a positive term target during a solve', () => {
  const data = inputs({ disabled: requirements.rules.map((rule) => rule.id), notes: { '2023-fall': 3 } });
  data.targets['2023-fall'] = 2;
  const result = solveAuto(data);
  assert.equal(result.fits, false);
  assert.deepEqual(result.alternatives, [{ '2023-fall': 3 }]);
});

test('a verified alternative can open an additional term while leaving its target at zero', () => {
  const timeline = terms.filter(({ id }) => ['2023-fall', '2024-spring'].includes(id))
    .map((term, i) => ({ ...term, level: undefined, target: i ? 0 : 1, work: false }));
  const data = inputs({
    plan: { '2023-fall': ['CS 100'], '2024-spring': [] },
    timeline, activeTerms: timeline.map(({ id }) => id),
    targets: { '2023-fall': 1, '2024-spring': 0 },
    preferences: { 'EARTH 121': 'required' }, disabled: requirements.rules.map((rule) => rule.id),
  });
  const result = solveAuto(data);
  assert.equal(result.fits, false);
  assert.deepEqual(result.suggestions, []);
  assert.deepEqual(result.alternatives, [{ '2024-spring': 1 }]);
  assert.equal(data.targets['2024-spring'], 0);
});

test('capacity advice for a recorded term preserves attempts and only places new courses in active terms', () => {
  const data = inputs({
    plan: { '2023-fall': ['CS 100', 'CS 137'], '2024-winter': [] },
    activeTerms: ['2024-winter'], visibleTerms: ['2023-fall', '2024-winter'],
    targets: { '2023-fall': 1, '2024-winter': 1 },
    outcomes: { 'CS 100': 'passed', 'CS 137': 'passed' }, preferences: { 'EARTH 121': 'required' },
    disabled: requirements.rules.map((rule) => rule.id),
  });
  const result = solveAuto(data);
  assert.equal(result.fits, false);
  assert.deepEqual(result.alternatives, [{ '2023-fall': 2 }]);
  const verified = solveAuto({ ...data, targets: { ...data.targets, ...result.alternatives[0] } });
  assert.deepEqual(verified.suggestions, [['EARTH 121', '2024-winter']]);
});

test('a locked term can supply earned prerequisites but cannot receive a missing prerequisite', () => {
  const past = '2023-fall';
  const future = '2024-winter';
  const data = inputs({
    activeTerms: [past, future], lockedTerms: [past],
    targets: { [past]: 2, [future]: 1 }, plan: { [past]: [], [future]: ['CS 138'] },
    disabled: requirements.rules.map(({ id }) => id),
  });
  assert.equal(solveAuto(data).fits, false);
  assert.deepEqual(solveAuto({ ...data, lockedTerms: [] }).suggestions, [['CS 137', past]]);
  data.plan[past] = ['CS 137'];
  data.outcomes = { 'CS 137': 'passed' };
  const result = solveAuto(data);
  assert.equal(result.fits, true);
  assert.deepEqual(result.suggestions, []);
});

test('capacity trials leave a locked term fixed, including when a zero-target term could otherwise open', () => {
  const past = '2023-fall';
  const future = '2024-winter';
  const data = inputs({
    activeTerms: [past, future], visibleTerms: [past, future], lockedTerms: [future],
    targets: { [past]: 1, [future]: 0 }, plan: { [past]: ['CS 137'], [future]: [] },
    preferences: { 'EARTH 121': 'required' }, disabled: requirements.rules.map(({ id }) => id),
  });
  const result = solveAuto(data);
  assert.equal(result.fits, false);
  assert.deepEqual(result.alternatives, [{ [past]: 2 }]);
  const overloaded = solveAuto({ ...data, plan: { [past]: [], [future]: ['CS 137'] } });
  assert.equal(overloaded.fits, false);
  assert.deepEqual(overloaded.alternatives, []);
  assert.match(overloaded.issues.join(' '), /Winter 2024 is locked/);
});
