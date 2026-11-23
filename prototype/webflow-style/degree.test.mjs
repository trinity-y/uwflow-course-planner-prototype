import assert from 'node:assert/strict';
import { test } from 'node:test';
import archive from './calendar-courses.json' with { type: 'json' };
import requirements from './degree-requirements.json' with { type: 'json' };
import { initialPlan, terms } from './calendar.mjs';
import { degreeCourseSets, evaluateDegree } from './degree.mjs';
import { indexPlan, placeCourse, readPlan } from './model.mjs';

const report = (plan) => evaluateDegree(requirements, archive, indexPlan(plan));
const check = (result, id) => result.rules.find((rule) => rule.id === id);
const add = (plan, codes, term) => codes.reduce((current, code) => placeCourse(current, code, term), plan);
const blank = () => Object.fromEntries(Object.keys(initialPlan()).map((term) => [term, []]));

test('the blank plan has zero rules met and the sample plan meets the core rule', () => {
  assert.equal(report(blank()).percent, 0);
  const sample = report(initialPlan());
  assert.equal(check(sample, 'core').current, 41);
  assert.equal(check(sample, 'core').met, true);
  assert.equal(check(sample, 'pd-core').current, 0);
  assert.equal(check(sample, 'technical-cs').met, true);
  assert.equal(sample.met, 2);
});

test('an elective that appears in two lists only fills one slot', () => {
  const overlapping = add(blank(), ['STV 100'], '2026-winter');
  const result = report(overlapping);
  assert.equal(check(result, 'impact').current + check(result, 'humanities').current, 1);
  const widened = report(add(overlapping, ['CLAS 104'], '2026-winter'));
  assert.deepEqual(check(widened, 'impact').matched, ['STV 100']);
  assert.deepEqual(check(widened, 'humanities').matched, ['CLAS 104']);
});

test('cross-listed courses and science pairs each count as a single elective', () => {
  const plan = add(blank(), ['CS 467', 'PHYS 467', 'CHEM 123'], '2026-winter');
  const incomplete = report(plan);
  assert.equal(check(incomplete, 'science').current, 0);
  assert.equal(check(incomplete, 'elective-total').current, 1);
  const withLab = report(add(plan, ['CHEM 123L'], '2026-winter'));
  assert.deepEqual(check(withLab, 'science').matched, ['CHEM 123', 'CHEM 123L']);
  assert.equal(check(withLab, 'science').current, 1);
  assert.equal(check(withLab, 'elective-total').current, 2);
});

test('degree choices preserve published lists and paired lab requirements', () => {
  const degree = report(blank());
  const setsFor = (id) => degreeCourseSets(requirements, archive, check(degree, id));
  const science = setsFor('science').flatMap(({ options }) => options);
  assert.deepEqual(science.find(([code]) => code === 'CHEM 123'), ['CHEM 123', 'CHEM 123L']);
  assert.deepEqual(setsFor('technical-additional').map(({ title }) => title), ['CS list', 'ECE list', 'Extended list']);
  const [published, other] = setsFor('elective-total');
  assert.ok(published.options.some(([code]) => code === 'CS 448'));
  assert.ok(other.options.some(([code]) => code === 'FR 255'));
  assert.equal(other.options.some(([code]) => ['CS 137', 'CHEM 123L', 'PD 3', 'COOP 1'].includes(code)), false);
});

test('the sidebar shows eligible communication choices and only missing fixed courses', () => {
  let degree = report(initialPlan());
  const remainingChoices = (id) => degreeCourseSets(requirements, archive, check(degree, id), { remainingOnly: true });
  assert.deepEqual(remainingChoices('core'), []);
  assert.deepEqual(remainingChoices('communication'), [{ options: requirements.lists.communication }]);
  degree = report(add(add(initialPlan(), ['ENGL 109'], '2024-fall'), ['PD 19'], '2024-spring'));
  assert.deepEqual(remainingChoices('communication'), []);
  assert.deepEqual(remainingChoices('pd-core'), [{ options: [['PD 10'], ['PD 11'], ['PD 20']] }]);
});

test('communication and technical electives use the calendar timing boundaries', () => {
  let plan = add(blank(), ['CS 488'], '2025-spring');
  plan = add(plan, ['ENGL 109'], '2026-winter');
  assert.equal(check(report(plan), 'technical-cs').met, false);
  assert.equal(check(report(plan), 'communication').met, false);
  plan = add(plan, ['ENGL 109'], '2024-fall');
  plan = add(plan, ['CS 488'], '2026-winter');
  assert.equal(check(report(plan), 'communication').met, true);
  assert.equal(check(report(plan), 'technical-cs').met, true);
});

test('co-op credit counts once per work term and course codes survive reload', () => {
  let plan = add(blank(), ['COOP 1', 'COOP 2'], '2024-spring');
  plan = add(plan, ['COOP 3'], '2024-fall');
  plan = add(plan, ['COOP 4'], '2025-winter');
  assert.equal(check(report(readPlan(plan)), 'coop').current, 2);
});

test('a custom sequence and approved course equivalents apply to degree checks', () => {
  const scheduled = new Map([
    ['CS 241E', '2024-fall'], ['COOP 1', '2027-spring'],
    ['CS 370', '2027-spring'], ['CS 454', '2027-fall'],
  ]);
  const timeline = terms.map((term) => {
    if (term.id === '2027-spring') return { ...term, level: null, work: true };
    if (term.id === '2027-fall') return { ...term, level: '4A', work: false };
    return term;
  });
  const result = evaluateDegree(requirements, archive, scheduled, {
    timeline, equivalents: { 'CS 241E': 'CS 241' },
  });
  assert.deepEqual(check(result, 'core').matched, ['CS 241E']);
  assert.equal(check(result, 'coop').current, 1);
  assert.deepEqual(check(result, 'fourth-year').matched, ['CS 454']);
});

test('a plan can pass all modeled rules and an uneven fourth year fails its distribution rule', () => {
  let plan = add(initialPlan(), ['ENGL 109'], '2024-fall');
  plan = add(plan, ['EARTH 121'], '2025-spring');
  plan = add(plan, ['CS 370'], '2026-winter');
  plan = add(plan, ['ECE 459', 'EARTH 122'], '2027-spring');
  plan = add(plan, ['STV 100', 'CLAS 104', 'MATH 237', 'FR 255'], '2028-winter');
  for (const [term, courses] of [
    ['2024-spring', ['COOP 1', 'PD 19']],
    ['2025-winter', ['COOP 2', 'PD 20']],
    ['2025-fall', ['COOP 3', 'PD 10']],
    ['2026-spring', ['COOP 4', 'PD 11']],
    ['2027-winter', ['COOP 5', 'PD 3']],
  ]) plan = add(plan, courses, term);

  const complete = report(plan);
  assert.deepEqual(complete.rules.filter((rule) => !rule.met).map(({ id }) => id), []);
  assert.equal(complete.percent, 100);
  assert.equal(check(report(add(plan, ['ECE 459'], '2028-winter')), 'fourth-year').met, false);
});
