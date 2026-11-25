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

test('calendar views survive reopening, copy independently and leave existing plan saves untouched', () => {
  const items = new Map([['plan', '{"autoSeed":9}']]);
  const storage = { getItem: (key) => items.get(key), setItem: (key, value) => items.set(key, value), removeItem: (key) => items.delete(key) };
  const open = () => openCalendars(storage, 'plan', 'Sample');
  const first = open();
  assert.deepEqual(first.view, {});
  first.saveView({ search: 'CS', boardLeft: 900 });
  first.create('Second', first.saved, open().view);
  const second = open();
  assert.deepEqual(second.view, { search: 'CS', boardLeft: 900 });
  second.saveView({ search: 'ECE' });
  second.select(first.active);
  assert.deepEqual(open().view, { search: 'CS', boardLeft: 900 });
  assert.deepEqual(open().saved, { autoSeed: 9 });
  assert.equal(items.get('plan'), '{"autoSeed":9}');
});

test('freezing a visible solver placement keeps it out of the course diff', () => {
  const history = [];
  const term = '2026-fall';
  const input = { plan: { [term]: [] }, autoSeed: 0 };
  const first = recordSolve(history, -1, input, { fits: true, suggestions: [['EARTH 121', term]] });
  const locked = { [term]: { locked: true, suggestions: ['EARTH 121'] } };
  const second = recordSolve(history, first, { ...input, termLocks: locked }, { fits: true, suggestions: [] });
  assert.deepEqual(history[second].changes, []);
  assert.deepEqual(history[second].inputs.termLocks, locked);
});

test('a full storage quota during copy preserves the original calendar and its setup draft', () => {
  const items = new Map();
  const storage = {
    getItem: (key) => items.get(key),
    setItem(key, value) {
      if (key === 'plan-calendars') throw new Error('Quota exceeded');
      items.set(key, value);
    },
    removeItem: (key) => items.delete(key),
  };
  const calendar = openCalendars(storage, 'plan', 'Sample');
  calendar.save({ autoSeed: 3 });
  calendar.saveView({ onboarding: { name: 'Fall plan' } });
  const before = new Map(items);
  assert.throws(() => calendar.create('Second', { autoSeed: 4 }, { search: 'CS' }), /Quota exceeded/);
  assert.deepEqual(items, before);
});
