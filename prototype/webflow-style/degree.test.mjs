import assert from 'node:assert/strict';
import { test } from 'node:test';
import archive from './calendar-courses.json' with { type: 'json' };
import requirements from './degree-requirements.json' with { type: 'json' };
import { initialPlan, terms } from './calendar.mjs';
import { degreeCourseSets, evaluateDegree } from './degree.mjs';
import { indexPlan, placeCourse, readPlan, removeCourse } from './model.mjs';

const report = (plan) => evaluateDegree(requirements, archive, indexPlan(plan));
const check = (result, id) => result.rules.find((rule) => rule.id === id);
const add = (plan, codes, term) => codes.reduce((current, code) => placeCourse(current, code, term), plan);
const blank = () => Object.fromEntries(Object.keys(initialPlan()).map((term) => [term, []]));

test('the blank plan has zero rules met and the sample plan meets the core rule', () => {
  assert.equal(report(blank()).percent, 0);
  const sample = report(initialPlan());
  assert.equal(check(sample, 'core').current, 38);
  assert.equal(check(sample, 'core').met, true);
  assert.deepEqual(check(sample, 'interface').matched, ['CS 349']);
  assert.deepEqual(check(sample, 'mechanics').matched, ['ECE 105']);
  assert.equal(check(sample, 'technical-cs').met, true);
  assert.equal(sample.met, 4);
});

test('an elective that appears in two lists only fills one slot', () => {
  const overlapping = add(blank(), ['STV 100'], '2026-winter');
  const result = report(overlapping);
  assert.equal(check(result, 'impact').current + check(result, 'humanities').current, 1);
  const widened = report(add(overlapping, ['CLAS 390'], '2026-winter'));
  assert.deepEqual(check(widened, 'impact').matched, ['STV 100']);
  assert.deepEqual(check(widened, 'humanities').matched, ['CLAS 390']);
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
  degree = report(removeCourse(add(initialPlan(), ['ENGL 109'], '2024-fall'), 'SE 102'));
  assert.deepEqual(remainingChoices('communication'), []);
  assert.deepEqual(remainingChoices('core'), [{ title: '1B', options: [['SE 102']] }]);
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

test('the sidebar omits counted courses and leaves the outstanding lab in a pair', () => {
  const plan = add(blank(), ['ECE 105', 'CHEM 123', 'EARTH 121'], '2024-winter');
  const degree = report(plan);
  const science = check(degree, 'science');
  const countedElsewhere = degree.rules.flatMap(({ matched }) => matched);
  const outstanding = degreeCourseSets(requirements, archive, science, { remainingOnly: true, countedElsewhere })
    .flatMap(({ options }) => options.flat());
  assert.deepEqual(science.matched, ['EARTH 121']);
  assert.ok(!outstanding.some((code) => ['EARTH 121', 'ECE 105', 'CHEM 123'].includes(code)));
  assert.ok(outstanding.includes('CHEM 123L'));
  assert.ok(degreeCourseSets(requirements, archive, science)[0].options.some((codes) => codes.includes('EARTH 121')));
});

test('2024–25 retains all seven seminars and permits science and interface alternatives', () => {
  const fixed = Object.values(requirements.coreByLevel).flat();
  assert.equal(requirements.calendar, '2024–25');
  assert.deepEqual(fixed.filter((code) => /^SE [1-4]0[12]$/.test(code) && code !== 'SE 101'), [
    'SE 102', 'SE 201', 'SE 202', 'SE 301', 'SE 302', 'SE 401', 'SE 402',
  ]);
  assert.ok(!fixed.includes('ECE 106'));
  let plan = add(blank(), ['PHYS 115', 'ECE 106', 'EARTH 270'], '2024-winter');
  plan = add(plan, ['CS 449'], '2026-winter');
  const result = report(plan);
  assert.deepEqual(check(result, 'mechanics').matched, ['PHYS 115']);
  assert.deepEqual(check(result, 'science').matched, ['EARTH 270', 'ECE 106']);
  assert.deepEqual(check(result, 'sustainability').matched, ['EARTH 270']);
  assert.deepEqual(check(result, 'interface').matched, ['CS 449']);
  assert.equal(check(result, 'technical-cs').current, 0);
  assert.equal(check(result, 'academic-units').current, 2);
});

test('degree rules expose additional eligible courses after applying quotas and timing', () => {
  let plan = add(blank(), ['COMMST 100', 'ENGL 109'], '2024-fall');
  plan = add(plan, ['ENGL 119'], '2026-winter');
  plan = add(plan, ['CS 360', 'CS 365', 'CS 444', 'MATH 237', 'FR 255'], '2027-spring');
  plan = add(plan, ['CS 448'], '2028-winter');
  const result = report(plan);

  const communication = check(result, 'communication');
  assert.equal(communication.available, 2);
  assert.deepEqual(communication.matched, ['COMMST 100']);
  assert.deepEqual(communication.additional, ['ENGL 109']);

  const fourth = check(result, 'fourth-year');
  assert.equal(fourth.current, 3);
  assert.equal(fourth.available, 6);
  assert.equal(fourth.matched.length, 3);
  assert.ok(fourth.matched.includes('CS 448'));
  assert.equal(fourth.additional.length, 3);
  assert.equal(fourth.met, false);
});

test('the total elective rule keeps the full list available above its target', () => {
  const plan = add(blank(), [
    'CS 360', 'CS 365', 'CS 370', 'CS 371', 'CS 442', 'CS 444',
    'CS 448', 'CS 449', 'CS 450', 'CS 451', 'CS 452', 'CS 453', 'CS 454', 'CS 457',
  ], '2026-winter');
  const total = check(report(plan), 'elective-total');
  assert.equal(total.current, 12);
  assert.equal(total.available, 13);
  assert.equal(total.matched.length, 12);
  assert.equal(total.additional.length, 1);
  assert.equal(new Set([...total.matched, ...total.additional]).size, 13);
});

test('a rule override releases its elective slot and removes the rule from progress', () => {
  const scheduled = new Map([['CS 488', '2027-spring']]);
  const original = evaluateDegree(requirements, archive, scheduled);
  assert.equal(check(original, 'demo-course').met, false);
  assert.equal(check(original, 'technical-additional').met, false);
  const disabledRules = new Set(['technical-cs', 'demo-course']);
  const overridden = evaluateDegree(requirements, archive, scheduled, { disabledRules });
  assert.equal(overridden.total, original.total - 2);
  assert.equal(check(overridden, 'demo-course').disabled, true);
  assert.deepEqual(check(overridden, 'technical-additional').matched, ['CS 488']);
  assert.deepEqual(degreeCourseSets(requirements, archive, check(overridden, 'demo-course'), { remainingOnly: true }), []);

  const off = evaluateDegree(requirements, archive, scheduled, {
    disabledRules: new Set(requirements.rules.map(({ id }) => id)),
  });
  assert.equal(off.total, 0);
  assert.equal(off.percent, 0);
});

test('co-op and PD records survive reload without affecting degree progress', () => {
  const plan = add(blank(), ['COOP 1', 'PD 19'], '2024-spring');
  assert.deepEqual(readPlan(plan)['2024-spring'], ['COOP 1', 'PD 19']);
  assert.deepEqual(report(readPlan(plan)), report(blank()));
});

test('a custom sequence and approved course equivalents apply to degree checks', () => {
  const scheduled = new Map([
    ['CS 241E', '2024-fall'],
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
  assert.deepEqual(check(result, 'fourth-year').matched, ['CS 454']);
});

test('a plan can pass all modeled rules and an uneven fourth year fails its distribution rule', () => {
  let plan = add(initialPlan(), ['ENGL 109'], '2024-fall');
  plan = add(plan, ['EARTH 121'], '2025-spring');
  plan = add(plan, ['CS 370'], '2026-winter');
  plan = add(plan, ['CS 100'], '2026-fall');
  plan = add(plan, ['ECE 459'], '2027-spring');
  plan = add(plan, ['STV 100', 'CLAS 390', 'MATH 237', 'FR 255', 'EARTH 122', 'EARTH 270'], '2028-winter');
  const complete = report(plan);
  assert.deepEqual(complete.rules.filter((rule) => !rule.met).map(({ id }) => id), []);
  assert.equal(complete.percent, 100);
  assert.equal(check(report(add(plan, ['ECE 459'], '2028-winter')), 'fourth-year').met, false);
});
