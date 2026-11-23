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

test('opinions break ties without adding courses and Shuffle can change the proposed plan', () => {
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
  assert.deepEqual(plan['2023-fall'], ['CS 137']);
  assert.deepEqual(result.suggestions, []);
  assert.match(result.unscheduled['CS 137'], /failed attempt/);
  assert.ok(result.unscheduled['CS 488']);
  assert.match(result.issues[0], /pinned classes/);
});
