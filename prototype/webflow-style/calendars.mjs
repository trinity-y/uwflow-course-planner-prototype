import { termLabel, termOrder } from './calendar.mjs';
import { element } from './graph.mjs';
import { indexPlan, planWithLockedSuggestions } from './model.mjs';

export function openCalendars(storage, originalKey, originalName) {
  const key = originalKey + '-calendars';
  const read = (id) => {
    try { return JSON.parse(storage.getItem(id)); } catch { return null; }
  };
  const index = () => read(key) ?? { active: 'original', names: { original: originalName } };
  const dataKey = (id) => id === 'original' ? originalKey : originalKey + '-' + id;
  const viewKey = (id) => dataKey(id) + '-view';
  const active = index().active;
  return {
    active, names: index().names, saved: read(dataKey(active)), view: read(viewKey(active)) ?? {},
    save(data) { storage.setItem(dataKey(active), JSON.stringify(data)); },
    saveView(view) { storage.setItem(viewKey(active), JSON.stringify(view)); },
    select(id) {
      const state = index();
      if (!Object.hasOwn(state.names, id)) throw new Error('Calendar unavailable');
      storage.setItem(key, JSON.stringify({ ...state, active: id }));
    },
    create(name, data, view) {
      const state = index();
      const id = crypto.randomUUID();
      storage.setItem(dataKey(id), JSON.stringify(data));
      try {
        if (view) storage.setItem(viewKey(id), JSON.stringify(view));
        storage.setItem(key, JSON.stringify({ active: id, names: { ...state.names, [id]: name } }));
      } catch (error) {
        storage.removeItem(dataKey(id));
        storage.removeItem(viewKey(id));
        throw error;
      }
    },
  };
}

export function solveDiff(before, after) {
  const changes = [];
  for (const [code, term] of before) {
    if (term !== after.get(code)) changes.push({ code, term, added: false });
  }
  for (const [code, term] of after) {
    if (term !== before.get(code)) changes.push({ code, term, added: true });
  }
  return changes.sort((a, b) => termOrder(a.term) - termOrder(b.term) || Number(a.added) - Number(b.added) || a.code.localeCompare(b.code));
}

export function recordSolve(history, parent, inputs, result) {
  const previous = history[parent];
  const signature = JSON.stringify(inputs);
  if (previous && signature === JSON.stringify(previous.inputs) && JSON.stringify(result) === JSON.stringify(previous.result)) return parent;
  const placements = (inputs, suggestions = []) =>
    new Map([...indexPlan(planWithLockedSuggestions(inputs.plan, inputs.termLocks)), ...suggestions]);
  const before = previous ? placements(previous.inputs, previous.result.suggestions) : placements(inputs);
  const after = placements(inputs, result.suggestions);
  history.push({ parent, inputs: structuredClone(inputs), result, changes: solveDiff(before, after) });
  return history.length - 1;
}

// Saved solves store a move as two term edits. Pair them by course in either order.
export function courseChanges(changes) {
  const byCourse = new Map();
  for (const { code, term, added } of changes) {
    if (!byCourse.has(code)) byCourse.set(code, { code });
    const change = byCourse.get(code);
    if (added) change.to = term;
    else change.from = term;
  }
  return [...byCourse.values()];
}

function changeRow({ code, from, to }) {
  if (from && to) {
    const row = element('div', 'diff-moved');
    const origin = termLabel(from);
    const destination = termLabel(to);
    const text = element('span', '', `↪ ${code} · ${origin} → ${destination}`);
    text.setAttribute('aria-hidden', 'true');
    row.append(text, element('span', 'sr-only', `${code} moved from ${origin} to ${destination}`));
    return row;
  }
  return element('div', to ? 'diff-added' : 'diff-removed', `${to ? '+' : '−'} ${code} · ${termLabel(to ?? from)}`);
}

export function renderHistory(container, history, selected, restore) {
  if (!history.length) {
    container.replaceChildren(element('p', 'quiet-message', 'Turn on Auto plan to compare solves here.'));
    return;
  }
  const entries = history.map(({ inputs, parent, changes, result }, index) => {
    const item = element('section', 'history-item');
    const button = element('button', 'history-point', `Solve ${index + 1} · Seed ${inputs.autoSeed}`);
    button.type = 'button';
    button.setAttribute('aria-current', index === selected ? 'true' : 'false');
    button.addEventListener('click', () => restore(index));
    item.append(button);
    const courses = courseChanges(changes);
    const status = !result.fits ? "Can't fit within target" : courses.length
      ? `${courses.length} placement change${courses.length === 1 ? '' : 's'}` : 'No course changes';
    item.append(element('small', '', parent >= 0 ? `${status} · from solve ${parent + 1}` : status));
    if (index === selected) item.append(...courses.map(changeRow));
    return item;
  });
  container.replaceChildren(...entries.reverse());
}
