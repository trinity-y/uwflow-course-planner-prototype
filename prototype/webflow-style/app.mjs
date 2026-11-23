import { calendarUrl, initialPlan, sampleCatalog, seasons, terms, years } from './calendar.mjs';
import {
  courseStatus, explainMissing, groupProgress, indexPlan, maxTermTarget, missingGroups,
  normalizeCode, parseLivePrerequisites, placeCourse, readPlan, readTermTargets,
} from './model.mjs';
import { element, renderGraph, termOptions } from './graph.mjs';

const storageKey = 'uwflow-webflow-planner-v1';
const pageSize = 30;
const byId = (id) => document.getElementById(id);
const dialog = byId('course-dialog');
const search = byId('course-search');
const courseList = byId('catalog-list');
const board = byId('term-board');
const termsById = new Map(terms.map((term) => [term.id, term]));
const statusText = { planned: 'In plan', missing: 'Unscheduled', late: 'Needs an earlier term' };
const catalog = new Map(sampleCatalog);
const liveDetails = new Map();
const inFlight = new Map();
let saved;
try {
  saved = JSON.parse(localStorage.getItem(storageKey));
} catch {
  saved = null;
}
for (const course of Array.isArray(saved?.courses) ? saved.courses : []) {
  if (typeof course?.code === 'string' && typeof course.name === 'string' && !catalog.has(course.code)) {
    catalog.set(course.code, { code: course.code, name: course.name });
  }
}

let plan = readPlan(saved?.plan);
let targets = readTermTargets(saved?.targets);
let scheduled = indexPlan(plan);
let warningList = [];
let selectedCode;
let graphView;
let dialogTrigger;
let graphCleanup = () => {};
let resultLimit = pageSize;
let liveCatalog = false;
let drag;
let suppressClick;
let hoveredCourse;

const getCourse = (code) => catalog.get(code) ?? { code, name: code };
const flowCode = (code) => code.toLowerCase().replace(/\s/g, '');
const request = async (path) => {
  const response = await fetch(new URL(path, import.meta.url), {
    credentials: 'omit',
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error('UW Flow is unavailable');
  return response.json();
};
const announce = (message) => { byId('announcement').textContent = message; };

function savePlan() {
  const courses = [...scheduled.keys()].filter((code) => !sampleCatalog.has(code)).map((code) => {
    const { name } = getCourse(code);
    return { code, name };
  });
  try {
    localStorage.setItem(storageKey, JSON.stringify({ plan, targets, courses }));
  } catch {
    // A browser can deny storage while still allowing the current plan to be edited.
  }
}

function makeDraggable(card, code) {
  card.dataset.course = code;
  card.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary || event.target.closest('.catalog-add, .warning-trigger')) return;
    suppressClick = null;
    const { pointerId, clientX, clientY } = event;
    drag = { pointerId, code, card, startX: clientX, startY: clientY, x: clientX, y: clientY };
  });
  card.addEventListener('click', (event) => {
    if (suppressClick === card && event.detail) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = null;
    }
  }, true);
}

function updateDropTarget(active) {
  const cell = document.elementFromPoint(active.x, active.y)?.closest('.term-card:not(.before-entry)');
  if (active.target === cell) return;
  active.target?.classList.remove('drop-active');
  active.target = cell;
  active.target?.classList.add('drop-active');
}

function scrollDuringDrag(active) {
  if (drag !== active) return;
  const vertical = active.y < 52 ? -8 : active.y > window.innerHeight - 52 ? 8 : 0;
  if (vertical) window.scrollBy(0, vertical);

  const viewport = board.parentElement;
  const { left, right, top, bottom } = viewport.getBoundingClientRect();
  if (active.y > top && active.y < bottom && active.x > left && active.x < right) {
    const horizontal = active.x < left + 34 ? -7 : active.x > right - 34 ? 7 : 0;
    if (horizontal) viewport.scrollLeft += horizontal;
  }
  updateDropTarget(active);
  active.frame = requestAnimationFrame(() => scrollDuringDrag(active));
}

window.addEventListener('pointermove', (event) => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.x = event.clientX;
  drag.y = event.clientY;
  if (!drag.ghost) {
    const distance = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
    if (distance < 6) return;
    drag.ghost = element('div', 'drag-preview', drag.code);
    drag.ghost.setAttribute('aria-hidden', 'true');
    if (drag.card.isConnected) drag.card.setPointerCapture(event.pointerId);
    drag.card.classList.add('dragging');
    document.body.append(drag.ghost);
    hoveredCourse = undefined;
    updateScheduleHighlight();
    drag.width = drag.ghost.offsetWidth;
    drag.height = drag.ghost.offsetHeight;
    scrollDuringDrag(drag);
  }
  event.preventDefault();
  const x = Math.min(drag.x + 12, window.innerWidth - drag.width - 4);
  const y = Math.min(drag.y + 12, window.innerHeight - drag.height - 4);
  drag.ghost.style.transform = `translate(${x}px, ${y}px)`;
}, { passive: false });

function finishDrag(event) {
  if (!drag || (event && drag.pointerId !== event.pointerId)) return;
  const active = drag;
  drag = null;
  if (!active.ghost) return;
  cancelAnimationFrame(active.frame);
  active.ghost.remove();
  active.card.classList.remove('dragging');
  suppressClick = active.card;
  if (event?.type === 'pointerup') {
    active.x = event.clientX;
    active.y = event.clientY;
    updateDropTarget(active);
  }
  active.target?.classList.remove('drop-active');
  if (event?.type === 'pointerup' && active.target) addOrMove(active.code, active.target.dataset.term);
  updateScheduleHighlight();
}

window.addEventListener('pointerup', finishDrag);
window.addEventListener('pointercancel', finishDrag);
window.addEventListener('blur', () => finishDrag());

function makeButton(className, label, content) {
  const node = element('button', className, content);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  return node;
}

function showCourse(code, trigger, focusPlacement = false) {
  selectedCode = code;
  graphView = { course: code, slot: null };
  dialogTrigger = trigger;
  const currentTerm = scheduled.get(code);
  const select = byId('target-term');
  select.replaceChildren(...termOptions('Choose a term', true));
  select.value = currentTerm ?? '';
  byId('flow-link').href = `https://uwflow.com/course/${flowCode(code)}`;
  dialog.showModal();
  setHoveredCourse(undefined);
  loadDetails([code]);
  updateDetails(focusPlacement ? code : undefined);
}

function updateDetails(focusCourse = document.activeElement.dataset.graphTerm) {
  const code = selectedCode;
  if (!dialog.open || !code) return;
  const course = getCourse(code);
  const atTerm = scheduled.get(code);
  byId('remove-course').hidden = !atTerm;
  byId('place-course').textContent = atTerm ? 'Move course' : 'Add course';
  const groups = missingGroups(course, atTerm, scheduled);
  const status = byId('detail-status');
  byId('detail-code').textContent = code;
  byId('detail-title').textContent = course.name;
  status.classList.toggle('needs-attention', groups.length > 0);
  if (groups.length) {
    const timing = atTerm ? `Before ${termsById.get(atTerm).label}: ` : '';
    status.textContent = timing + explainMissing(groups, atTerm, scheduled);
  } else if (course.groups?.length) {
    status.textContent = atTerm
      ? 'Every direct prerequisite group has a course in an earlier term.'
      : 'Every direct prerequisite group has a course in your plan.';
  } else if (course.groups) {
    status.textContent = 'This graph has no course prerequisites for this course.';
  } else {
    status.textContent = 'Course prerequisites need a manual check.';
  }

  const raw = liveDetails.get(code);
  const note = byId('live-detail');
  note.replaceChildren();
  if (!course.groups && course.references?.length) {
    note.append(element('span', '', 'The graph shows courses mentioned in the UW Flow text. Check the text for how they apply.'));
  }
  if (raw?.prereqs) {
    note.append(element('span', '', `UW Flow prerequisites: ${raw.prereqs}`));
  } else if (raw) {
    note.append(element('span', '', 'UW Flow lists no prerequisites.'));
  } else if (inFlight.has(code)) {
    note.append(element('span', '', 'Looking up prerequisites on UW Flow…'));
  } else {
    note.append(element('span', '', 'Live prerequisites are unavailable.'));
  }
  if (sampleCatalog.has(code)) {
    note.append(element('span', '', 'The sample graph shows selected course paths.'));
  }
  const graph = byId('detail-graph');
  const previous = graph.querySelector('.graph-scroll');
  const graphControl = document.activeElement.dataset.graphControl;
  const scroll = graph.dataset.course === code && previous
    ? { left: previous.scrollLeft, top: previous.scrollTop }
    : null;
  graphCleanup();
  graphCleanup = renderGraph(graph, code, getCourse, scheduled, changeGraphTerm, graphView);
  graph.dataset.course = code;
  const viewport = graph.querySelector('.graph-scroll');
  byId('placement-form').hidden = Boolean(viewport);
  if (viewport) viewport.scrollTo(scroll ?? { left: viewport.scrollWidth });
  if (focusCourse) {
    const select = graph.querySelector(`[data-graph-term="${CSS.escape(focusCourse)}"]`);
    if (select) select.focus();
    else if (!viewport) byId('target-term').focus();
  } else if (graphControl) {
    graph.querySelector(`[data-graph-control="${CSS.escape(graphControl)}"]`)?.focus({ preventScroll: true });
  }
}

function loadDetails(codes) {
  const pending = codes.filter((code) => !liveDetails.has(code) && !inFlight.has(code));
  if (!pending.length) return;
  const params = new URLSearchParams(pending.map((code) => ['code', flowCode(code)]));
  let graphChanged = false;
  const loading = request(`./api/prerequisites?${params}`).then((rows) => {
    if (!Array.isArray(rows)) return;
    const byCode = new Map(rows.map((row) => [normalizeCode(row.code), row]));
    for (const code of pending) {
      const row = byCode.get(code);
      if (!row) continue;
      liveDetails.set(code, row);
      if (sampleCatalog.has(code)) continue;
      const parsed = parseLivePrerequisites(row.prereqs);
      catalog.set(code, { ...getCourse(code), name: row.name, ...parsed });
      graphChanged = true;
    }
    if (graphChanged) renderPlan();
  }).catch(() => {}).finally(() => {
    pending.forEach((code) => inFlight.delete(code));
    if (graphChanged || pending.includes(selectedCode)) updateDetails();
  });
  pending.forEach((code) => inFlight.set(code, loading));
}

function addOrMove(code, target) {
  const next = placeCourse(plan, code, target);
  if (next === plan) return;
  const moved = scheduled.has(code);
  plan = next;
  renderPlan();
  savePlan();
  announce(`${code} ${moved ? 'moved' : 'added'} to ${termsById.get(target).label}.`);
  if (!sampleCatalog.has(code)) loadDetails([code]);
}

function removeFromPlan(code) {
  const term = scheduled.get(code);
  if (!term) return;
  plan = { ...plan, [term]: plan[term].filter((item) => item !== code) };
  renderPlan();
  savePlan();
  announce(`${code} removed from the plan.`);
}

function changeGraphTerm(code, target) {
  if (target) addOrMove(code, target);
  else removeFromPlan(code);
  updateDetails(code);
}

function warningBadge(code, term, groups) {
  const reason = explainMissing(groups, term.id, scheduled);
  const container = element('div', 'warning-badge');
  const button = makeButton('warning-trigger', `Prerequisite warning for ${code}`, '!');
  const tip = element('span', 'warning-tip', reason);
  tip.role = 'tooltip';
  tip.id = `warning-${flowCode(code)}`;
  button.setAttribute('aria-describedby', tip.id);
  button.addEventListener('click', () => showCourse(code, button));
  container.append(button, tip);
  return container;
}

function termCourse(code, term, groups) {
  const course = getCourse(code);
  const card = element('div', 'term-course');
  makeDraggable(card, code);
  const grip = element('span', 'drag-handle');
  grip.setAttribute('aria-hidden', 'true');
  const open = makeButton('term-course-open', `View ${code} prerequisites in ${term.label}`);
  open.append(element('span', 'course-code', code), element('span', 'term-course-name', course.name));
  open.title = course.name;
  open.addEventListener('click', () => showCourse(code, open));
  card.append(grip, open);
  if (groups.length) card.append(warningBadge(code, term, groups));
  return card;
}

function updateScheduleHighlight(focus = document.activeElement) {
  const focused = focus instanceof Element && focus.matches(':focus-visible')
    ? focus.closest('.term-course')?.dataset.course
    : undefined;
  const selected = dialog.open || drag?.ghost ? undefined : hoveredCourse ?? focused;
  const prerequisites = new Set(getCourse(selected).groups?.flatMap(({ options }) => options));
  const target = scheduled.get(selected);
  for (const card of board.querySelectorAll('.term-course')) {
    const { course } = card.dataset;
    const active = course === selected;
    const status = !active && prerequisites.has(course) ? courseStatus(course, target, scheduled) : undefined;
    card.classList.toggle('schedule-selected', active);
    card.classList.toggle('schedule-prerequisite', status === 'planned');
    card.classList.toggle('schedule-prerequisite-late', status === 'late');
    card.classList.toggle('schedule-muted', Boolean(selected) && !active && !status);
  }
}

function setHoveredCourse(code) {
  if (hoveredCourse === code) return;
  hoveredCourse = code;
  updateScheduleHighlight();
}

board.addEventListener('pointerover', (event) => {
  if (event.pointerType === 'touch' || dialog.open || drag?.ghost) return;
  setHoveredCourse(event.target.closest('.term-course')?.dataset.course);
});
board.addEventListener('pointerleave', () => setHoveredCourse(undefined));
board.addEventListener('focusin', (event) => updateScheduleHighlight(event.target));
board.addEventListener('focusout', (event) => updateScheduleHighlight(event.relatedTarget));

function updateSlots(container, term) {
  const emptySlots = targets[term.id] - plan[term.id].length;
  const items = [];
  container.removeAttribute('aria-label');
  container.removeAttribute('role');
  if (emptySlots > 0) {
    container.role = 'group';
    container.setAttribute('aria-label', `${emptySlots} empty ${emptySlots === 1 ? 'slot' : 'slots'}`);
    for (let slot = 0; slot < emptySlots; slot += 1) {
      const item = element('div', 'empty-slot');
      const plus = element('span', '', '+');
      plus.setAttribute('aria-hidden', 'true');
      item.append(plus, element('span', '', 'Empty slot'));
      items.push(item);
    }
  } else if (emptySlots < 0) {
    const over = Math.abs(emptySlots);
    items.push(element('div', 'term-over-target', `${over} over target`));
  } else if (!plan[term.id].length) {
    const empty = element('div', 'term-empty');
    const plus = element('span', 'empty-plus', '+');
    plus.setAttribute('aria-hidden', 'true');
    empty.append(plus, element('span', '', 'Drop a course here'));
    items.push(empty);
  }
  container.classList.toggle('zero-target', emptySlots === 0 && !plan[term.id].length);
  container.replaceChildren(...items);
}

function renderTerm(term) {
  const cell = element('section', `term-card${term.beforeEntry ? ' before-entry' : ''}`);
  cell.dataset.term = term.id;
  cell.setAttribute('aria-label', term.label);
  if (term.beforeEntry) {
    cell.append(element('span', 'entry-label', 'Before entry'));
    return cell;
  }

  const heading = element('div', 'term-heading');
  const label = term.level ? `${term.level} · Study term` : term.work ? 'Co-op term' : 'Open term';
  const targetLabel = element('label', 'term-target');
  const target = element('select', '');
  target.setAttribute('aria-label', `Course target for ${term.label}`);
  target.replaceChildren(...Array.from({ length: maxTermTarget + 1 }, (_, count) => new Option(count, count)));
  target.value = targets[term.id];
  targetLabel.append(element('span', '', 'Target'), target);
  heading.append(element('span', 'term-type', label), targetLabel);
  cell.append(heading);
  if (plan[term.id].length) {
    const list = element('div', 'term-courses');
    for (const code of plan[term.id]) {
      const groups = missingGroups(getCourse(code), term.id, scheduled);
      if (groups.length) warningList.push({ code, term, groups });
      list.append(termCourse(code, term, groups));
    }
    cell.append(list);
  }
  const slots = element('div', 'term-slots');
  cell.append(slots);
  updateSlots(slots, term);
  target.addEventListener('change', () => {
    targets[term.id] = Number(target.value);
    updateSlots(slots, term);
    savePlan();
    announce(`${term.label} course target set to ${target.value}.`);
  });
  return cell;
}

function renderBoard() {
  warningList = [];
  const grid = document.createDocumentFragment();
  grid.append(element('span', 'year-header', 'Year'));
  for (const season of seasons) {
    const header = element('div', `season-heading ${season.toLowerCase()}`);
    const icon = element('span', 'season-icon', { Winter: '❄', Spring: '✿', Fall: '◈' }[season]);
    icon.setAttribute('aria-hidden', 'true');
    header.append(icon, element('span', '', season));
    grid.append(header);
  }
  for (const year of years) {
    grid.append(element('h3', 'year-label', year));
    for (const season of seasons) grid.append(renderTerm(termsById.get(`${year}-${season.toLowerCase()}`)));
  }
  board.replaceChildren(grid);
  hoveredCourse = board.querySelector('.term-course:hover')?.dataset.course;
  updateScheduleHighlight();
  byId('planned-count').textContent = `${scheduled.size} planned`;
  const warning = byId('warning-summary');
  const count = warningList.length;
  warning.hidden = count === 0;
  warning.textContent = `${count} ${count === 1 ? 'warning' : 'warnings'}`;
}

function renderBuckets() {
  const section = byId('prereq-list');
  byId('bucket-count').textContent = warningList.length;
  if (!warningList.length) {
    section.replaceChildren(element('p', 'quiet-message', 'No missing prerequisites for the course paths shown.'));
    return;
  }

  const buckets = warningList.map(({ code, term, groups }) => {
    const bucket = element('article', 'bucket');
    const label = makeButton('bucket-course', `View ${code} prerequisites`, code);
    const header = element('header', 'bucket-heading');
    label.addEventListener('click', () => showCourse(code, label));
    header.append(label, element('span', '', term.label));
    bucket.append(header);
    for (const group of groups) {
      const { outstanding, remaining } = groupProgress(group, term.id, scheduled);
      const options = element('div', 'bucket-options');
      const caption = group.options.length === 1
        ? 'Required course'
        : `Choose ${remaining} of ${outstanding.length}${remaining < group.count ? ' remaining' : ''}`;
      options.append(element('div', 'bucket-caption', caption));
      const chips = element('div', 'bucket-chips');
      for (const option of outstanding) {
        const course = getCourse(option);
        const status = courseStatus(option, term.id, scheduled);
        const chip = makeButton('bucket-chip', `${option}, ${course.name}, ${statusText[status]}`, option);
        chip.title = status === 'late' ? `${course.name} · Needs an earlier term` : course.name;
        makeDraggable(chip, option);
        chip.addEventListener('click', () => showCourse(option, chip, true));
        chips.append(chip);
      }
      options.append(chips);
      bucket.append(options);
    }
    return bucket;
  });
  section.replaceChildren(...buckets);
}

function catalogCard(course) {
  const { code, name } = course;
  const card = element('div', 'catalog-card');
  makeDraggable(card, code);
  const grip = element('span', 'drag-handle');
  grip.setAttribute('aria-hidden', 'true');
  const open = makeButton('catalog-open', `View ${code} prerequisites`);
  open.append(element('span', 'course-code', code), element('span', 'catalog-course-name', name));
  open.addEventListener('click', () => showCourse(code, open));
  const alreadyPlanned = scheduled.has(code);
  const add = makeButton('icon-button catalog-add', `${alreadyPlanned ? 'Move' : 'Schedule'} ${code}`, alreadyPlanned ? '✓' : '+');
  add.title = alreadyPlanned ? `In ${termsById.get(scheduled.get(code)).label}` : `Schedule ${code}`;
  add.addEventListener('click', () => showCourse(code, add, true));
  card.append(grip, open, add);
  return card;
}

function renderCatalog() {
  const query = search.value.trim().toLowerCase();
  const simplify = (value) => value.toLowerCase().replace(/\s/g, '');
  const searchTerms = query.split(/\s+/);
  const matches = [...catalog.values()].filter(({ code, name, aliases = [] }) => {
    const codes = [code, ...aliases].map(simplify);
    const haystack = `${code} ${name} ${aliases.join(' ')}`.toLowerCase();
    return codes.some((value) => value.startsWith(simplify(query))) ||
      searchTerms.every((word) => haystack.includes(word));
  });
  byId('results-title').textContent = query ? 'Search results' : 'All courses';
  byId('catalog-source').textContent = query ? `${matches.length} found` : liveCatalog ? 'UW Flow catalog' : 'Sample catalog';
  if (!matches.length) {
    courseList.replaceChildren(element('p', 'quiet-message', 'No courses match your search.'));
    return;
  }

  const cards = matches.slice(0, resultLimit).map(catalogCard);
  if (matches.length > resultLimit) {
    const more = makeButton('button load-more', null, 'Show more courses');
    more.addEventListener('click', () => {
      const previousLimit = resultLimit;
      resultLimit += pageSize;
      renderCatalog();
      courseList.querySelectorAll('.catalog-open')[previousLimit]?.focus();
    });
    cards.push(more);
  }
  courseList.replaceChildren(...cards);
}

function renderPlan() {
  const focused = document.activeElement;
  const card = focused.closest('[data-course]');
  const focusCode = card?.dataset.course;
  const focusLabel = focused.getAttribute('aria-label');
  scheduled = indexPlan(plan);
  renderBoard();
  renderBuckets();
  renderCatalog();
  if (focusCode && focusLabel && !focused.isConnected) {
    const targets = [...document.querySelectorAll(`[data-course="${CSS.escape(focusCode)}"] button, button[data-course="${CSS.escape(focusCode)}"]`)];
    targets.find((node) => node.getAttribute('aria-label') === focusLabel)?.focus({ preventScroll: true });
  }
}

search.addEventListener('input', () => {
  resultLimit = pageSize;
  courseList.scrollTop = 0;
  renderCatalog();
});
byId('calendar-link').href = calendarUrl;
byId('warning-summary').addEventListener('click', () => {
  const first = document.querySelector('.warning-trigger');
  first?.scrollIntoView({ block: 'center', inline: 'center' });
  first?.focus({ preventScroll: true });
});
byId('reset-plan').addEventListener('click', () => {
  if (!window.confirm('Replace your edits with the sample plan?')) return;
  plan = initialPlan();
  targets = readTermTargets();
  renderPlan();
  savePlan();
  announce('Sample plan restored.');
});
byId('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (dialog.open) return;
  graphCleanup();
  if (dialogTrigger) (dialogTrigger.isConnected ? dialogTrigger : search).focus({ preventScroll: true });
  selectedCode = undefined;
});
byId('placement-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = selectedCode;
  const target = byId('target-term').value;
  dialogTrigger = null;
  dialog.close();
  addOrMove(code, target);
  const cell = document.querySelector(`[data-term="${target}"]`);
  const card = cell?.querySelector(`[data-course="${CSS.escape(code)}"] .term-course-open`);
  card?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  card?.focus({ preventScroll: true });
});
byId('remove-course').addEventListener('click', () => {
  const code = selectedCode;
  dialogTrigger = null;
  dialog.close();
  removeFromPlan(code);
  search.focus({ preventScroll: true });
});

renderPlan();
request('./api/catalog').then((rows) => {
  if (!Array.isArray(rows) || !rows.length) return;
  for (const { code: rawCode, name, aliases } of rows) {
    const code = normalizeCode(rawCode);
    catalog.set(code, { ...getCourse(code), code, name, aliases: aliases ?? [] });
  }
  liveCatalog = true;
  renderCatalog();
}).catch(() => {});
const restored = [...scheduled.keys()].filter((code) => !sampleCatalog.has(code));
for (let i = 0; i < restored.length; i += 50) loadDetails(restored.slice(i, i + 50));
