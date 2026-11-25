import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openCalendars, recordSolve } from './calendars.mjs';

test('old saves become the original calendar and copied calendars edit independently', () => {
  const items = new Map([['plan', JSON.stringify({ autoSeed: 9 })]]);
  const storage = { getItem: (key) => items.get(key), setItem: (key, value) => items.set(key, value) };
  const open = () => openCalendars(storage, 'plan', 'Sample');
  const original = open();
  assert.equal(original.saved.autoSeed, 9);
  original.create('Alternative', original.saved);
  const copy = open();
  copy.save({ autoSeed: 2 });
  assert.equal(open().saved.autoSeed, 2);
  copy.select('original');
  assert.equal(open().saved.autoSeed, 9);
});

test('branching from an older solve preserves its other children and records moves in both terms', () => {
  const history = [];
  const input = { autoSeed: 0, plan: { '2030-fall': ['CS 135'] } };
  const solve = (term) => ({ fits: true, suggestions: [['CS 136', term]] });
  const root = recordSolve(history, -1, input, solve('2031-winter'));
  const next = recordSolve(history, root, { ...input, autoSeed: 1 }, solve('2031-spring'));
  const fork = recordSolve(history, root, { ...input, autoSeed: 2 }, solve('2031-fall'));
  assert.deepEqual(history.map((entry) => entry.parent), [-1, 0, 0]);
  assert.deepEqual(history[next].changes, [
    { code: 'CS 136', term: '2031-winter', added: false }, { code: 'CS 136', term: '2031-spring', added: true },
  ]);
  input.plan['2030-fall'].push('CS 246');
  assert.deepEqual(history[fork].inputs.plan['2030-fall'], ['CS 135']);
});
