import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerms } from './calendar.mjs';
import { inferRange, inferSequence, pageLines, parseTranscript, readImportedPlan, sequenceTargets, startCalendar } from './transcript.mjs';

const degree = 'Program: Software Engineering, Honours, Co-operative Program';
const header = 'Course Description Attempted Earned Grade';
const record = [
  'Fall 2030', degree, 'Level: 1A Form Of Study: Enrolment', header,
  'CS 137 Computing 0.50 0.50 81', 'MATH 115 Algebra 0.50 0.00 42', 'SE 101 Seminar 0.00 0.00 CR',
  'Winter 2031', degree, 'Level: 1A Form Of Study: Co-op Work Term', header, 'COOP 1 Work 0.50 0.00 CR',
  'Spring 2031', degree, 'Level: 1B Form Of Study: Enrolment', header, 'CS 138 Computing II',
];
const range = { start: 2030, end: 2035 };
const entryYear = range.start;

test('PDF text positions reconstruct the reading order independently of drawing order', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  assert.deepEqual(pageLines([item('137', 75, 400), item('Fall 2030', 300, 500), item('CS', 30, 401)]),
    ['Fall 2030', 'CS 137']);
});

test('transcript import distinguishes earned credit, no credit, credit-only and in-progress rows', () => {
  const { records } = parseTranscript(record);
  assert.deepEqual(records.flatMap((term) => term.courses.map(({ code, outcome }) => [code, outcome])), [
    ['CS 137', 'passed'], ['MATH 115', 'failed'], ['SE 101', 'passed'], ['COOP 1', 'passed'], ['CS 138', 'enrolled'],
  ]);
  assert.equal(records[1].work, true);
  assert.equal(records.at(-1).level, '1B');
  assert.equal(records[0].courses[0].name, 'Computing');
});

test('the current transcript program gates import even after a previous SE enrolment', () => {
  assert.throws(() => parseTranscript([...record, 'Program: Computer Science, Honours']), /supports Honours Software Engineering/);
  assert.throws(() => parseTranscript(['Program: Software Engineering']), /supports Honours Software Engineering/);
  assert.throws(() => parseTranscript([degree]), /No course rows/);
});

test('new calendars distinguish recorded outcomes from expected courses across the confirmed sequence', () => {
  const { records } = parseTranscript(record);
  const sequence = inferSequence(range, entryYear, records);
  assert.equal(sequence['2031-spring'], '1B');
  assert.equal(sequence['2031-winter'], undefined);
  const terms = createTerms(range, { entryYear, levels: sequence });
  const targets = sequenceTargets(terms, records);
  targets['2031-spring'] = 4;
  const calendar = startCalendar({ range, entryYear, sequence, targets, records, currentTerm: '2031-spring' });
  assert.deepEqual(calendar.plan['2030-fall'], ['CS 137', 'MATH 115', 'SE 101', 'CHE 102', 'MATH 117', 'MATH 135']);
  assert.equal(calendar.outcomes['CHE 102'], undefined);
  assert.deepEqual(calendar.plan['2031-winter'], ['COOP 1']);
  assert.ok(calendar.plan['2031-spring'].includes('ECE 124'));
  assert.equal(calendar.outcomes['ECE 124'], undefined);
  assert.equal(calendar.outcomes['CS 138'], 'enrolled');
  assert.equal(calendar.targets['2031-spring'], 4);
  const blank = startCalendar({ range, entryYear, sequence, targets, currentTerm: '2030-fall' });
  assert.equal(Object.values(blank.plan).flat().length, 38);
  assert.ok(blank.plan['2031-spring'].includes('CS 138'));
  assert.deepEqual(blank.outcomes, {});
});

test('past repeat attempts remain visible when a later attempt earns the credit', () => {
  const { records } = parseTranscript([...record, 'MATH 115 Algebra 0.50 0.50 81']);
  const sequence = inferSequence(range, entryYear, records);
  const calendar = startCalendar({ range, entryYear, sequence, targets: {}, records, currentTerm: '2031-spring' });
  assert.equal(calendar.outcomes['MATH 115'], 'passed');
  assert.ok(calendar.plan['2031-spring'].includes('MATH 115'));
  assert.equal(calendar.termDetails.notes['2030-fall'][0].title, 'MATH 115 · failed');
});

test('import keeps the enriched course code and outcome without adding a second 2A course', () => {
  const { records } = parseTranscript(['Fall 2031', degree, 'Level: 2A Form Of Study: Enrolment', header,
    'CS 241E Foundations of Sequential Programs (Enriched) 0.50 0.50 CR']);
  const calendar = startCalendar({ range, entryYear, sequence: { '2031-fall': '2A' }, targets: {}, records, currentTerm: '2031-fall' });
  assert.deepEqual(calendar.courses, [{ code: 'CS 241E', name: 'Foundations of Sequential Programs (Enriched)' }]);
  assert.deepEqual(calendar.outcomes, { 'CS 241E': 'passed' });
  assert.deepEqual(calendar.plan['2031-fall'], ['CS 241E', 'ECE 222', 'SE 201', 'SE 212', 'STAT 206']);
});

test('older transcript plans and solve snapshots drop only an unrecorded default CS 241', () => {
  const setup = { imported: true, levels: { '2031-fall': '2A' } };
  const plan = { '2031-fall': ['CS 241E', 'CS 241', 'ECE 222'] };
  const old = { plan, outcomes: { 'CS 241E': 'passed' } };
  assert.deepEqual(readImportedPlan(old, setup), { '2031-fall': ['CS 241E', 'ECE 222'] });
  for (const inputs of [
    { ...old, outcomes: { 'CS 241E': 'passed', 'CS 241': 'failed' } },
    { ...old, preferences: { 'CS 241': 'required' } },
    { ...old, equivalents: { 'CS 241E': 'CS 241' } },
    { ...old, plan: { '2031-fall': ['CS 241E'], '2032-winter': ['CS 241'] } },
  ]) assert.equal(readImportedPlan(inputs, setup), inputs.plan);
  assert.equal(readImportedPlan(old, undefined), plan);
});

test('a partial transcript infers entry from the first known study level and extends for a delayed sequence', () => {
  assert.deepEqual(inferRange([{ id: '2031-winter', level: '3A' }, { id: '2033-fall', level: '3B' }]), {
    start: 2028, end: 2035,
  });
});
