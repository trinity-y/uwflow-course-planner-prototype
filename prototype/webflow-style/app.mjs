import { calendarUrl, initialPlan, sampleCatalog, seasons, terms as defaultTerms, years } from './calendar.mjs';
import {
  countableSchedule, courseStatus, explainMissing, groupProgress, indexPlan, isPinned,
  maxTermTarget, missingGroups, normalizeCode, outcomeLabels, parseLivePrerequisites,
  placeCourse, readOutcomes, readPlan, readTermTargets, removeCourse,
} from './model.mjs';
import { element, renderGraph, termOptions } from './graph.mjs';
import { evaluateDegree } from './degree.mjs';
import { renderDegreeReport, renderDegreeSidebar } from './degree-view.mjs';
import requirements from './degree-requirements.json' with { type: 'json' };
import archive from './calendar-courses.json' with { type: 'json' };

const personal = location.pathname === '/personal';
const profile = personal
  ? await fetch('./api/profile').then((response) => response.ok ? response.json() : null).catch(() => null)
  : null;
const scope = personal ? '-alex' : '';
const storageKey = `uwflow-webflow-planner-v1${scope}`;
const favoritesKey = `uwflow-webflow-planner-favorites-v1${scope}`;
const terms = defaultTerms.map((term) => ({ ...term, ...profile?.terms?.[term.id] }));
const equivalents = profile?.equivalents ?? {};
const pageSize = 30;
const byId = (id) => document.getElementById(id);
const dialog = byId('course-dialog');
const degreeDialog = byId('degree-dialog');
const outcomeDialog = byId('outcome-dialog');
const degreeButton = byId('open-degree-check');
const search = byId('course-search');
const courseList = byId('catalog-list');
const favoritesList = byId('favorites-list');
const board = byId('term-board');
const termsById = new Map(terms.map((term) => [term.id, term]));
const statusText = { planned: 'In plan', missing: 'Unscheduled', late: 'Needs an earlier term', failed: 'Failed' };
const catalog = new Map([
  ...sampleCatalog,
  ...Object.entries(archive).filter(([code]) => !sampleCatalog.has(code))
    .map(([code, [name]]) => [code, { code, name }]),
]);
for (const course of profile?.courses ?? []) {
  catalog.set(course.code, { ...catalog.get(course.code), ...course });
}
const liveDetails = new Map();
const inFlight = new Map();
let saved;
let savedFavorites;
try {
  saved = JSON.parse(localStorage.getItem(storageKey));
} catch {
  saved = null;
}
try {
  savedFavorites = JSON.parse(localStorage.getItem(favoritesKey));
} catch {
  savedFavorites = null;
}
for (const course of Array.isArray(saved?.courses) ? saved.courses : []) {
  if (typeof course?.code === 'string' && typeof course.name === 'string' && !catalog.has(course.code)) {
    catalog.set(course.code, { code: course.code, name: course.name });
  }
}
const favorites = new Set(personal ? [] : ['CS 448']);
const startingFavorites = savedFavorites ?? profile?.favorites;
if (Array.isArray(startingFavorites)) {
  favorites.clear();
  for (const course of startingFavorites) {
    if (typeof course?.code !== 'string' || !/^[A-Z]+ \d{1,4}[A-Z]*$/.test(course.code)) continue;
    favorites.add(course.code);
    if (typeof course.name === 'string' && !catalog.has(course.code)) catalog.set(course.code, course);
  }
}

let plan = readPlan(saved?.plan ?? profile?.plan);
let targets = readTermTargets(saved?.targets ?? profile?.targets);
let scheduled = indexPlan(plan);
let outcomes = readOutcomes(saved?.outcomes ?? profile?.outcomes, scheduled);
let equivalentPlacements = new Map();
let counted;
let prerequisites;
let warningList = [];
let degreeReport;
let refreshDegreeReport;
let selectedCode;
let graphView;
let dialogTrigger;
let graphCleanup = () => {};
let resultLimit = pageSize;
let liveCatalog = false;
let drag;
let suppressClick;
let hoveredCourse;
let outcomeCode;

const getCourse = (code) => catalog.get(code) ?? { code, name: code };
const actualCode = (code) => scheduled.has(code) ? code : equivalentPlacements.get(code) ?? code;
const outcomeFor = (code) => outcomes[actualCode(code)];
const pinned = (code) => isPinned(outcomeFor(code));
function withEquivalents(placements) {
  const result = new Map(placements);
  for (const [required, actual] of equivalentPlacements) {
    if (placements.has(actual) && !result.has(required)) result.set(required, placements.get(actual));
  }
  return result;
}
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
    localStorage.setItem(storageKey, JSON.stringify({ plan, targets, outcomes, courses }));
  } catch {
    // A browser can deny storage while still allowing the current plan to be edited.
  }
}

function makeDraggable(card, code) {
  card.dataset.course = code;
  card.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary || pinned(code) ||
      event.target.closest('.catalog-add, .warning-trigger, .favorite-star, .course-outcome-menu')) return;
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

function updateFavoriteStar(star, code) {
  const favorite = favorites.has(code);
  star.setAttribute('aria-pressed', String(favorite));
  star.textContent = favorite ? '★' : '☆';
  star.title = favorite ? `Remove ${code} from favorites` : `Add ${code} to favorites`;
}

function favoriteStar(code) {
  const star = makeButton('favorite-star', `Favorite ${code}`);
  star.dataset.favoriteCode = code;
  updateFavoriteStar(star, code);
  star.addEventListener('click', () => {
    const position = [...favorites].indexOf(code);
    if (position >= 0) favorites.delete(code);
    else favorites.add(code);
    try {
      const courses = [...favorites].map((code) => ({ code, name: getCourse(code).name }));
      localStorage.setItem(favoritesKey, JSON.stringify(courses));
    } catch {
      // Keep the current favorites available when browser storage is disabled.
    }
    const restoreFocus = favoritesList.contains(star) && star === document.activeElement;
    renderFavorites();
    const copies = document.querySelectorAll(`[data-favorite-code="${CSS.escape(code)}"]`);
    copies.forEach((copy) => updateFavoriteStar(copy, code));
    if (restoreFocus) {
      const stars = favoritesList.querySelectorAll('.favorite-star');
      (stars[Math.min(position, stars.length - 1)] ?? byId('favorites-title')).focus({ preventScroll: true });
    }
    announce(position < 0 ? `${code} added to favorites.` : `${code} removed from favorites.`);
  });
  return star;
}

function withFavorite(control, code) {
  const row = element('span', 'course-with-star');
  row.append(control, favoriteStar(code));
  return row;
}

function showCourse(code, trigger, focusPlacement = false) {
  code = actualCode(code);
  selectedCode = code;
  graphView = { course: code, slot: null };
  dialogTrigger = trigger;
  const currentTerm = scheduled.get(code);
  byId('detail-favorite').replaceChildren(favoriteStar(code));
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
  const locked = pinned(code);
  byId('remove-course').hidden = !atTerm || locked;
  byId('place-course').textContent = atTerm ? 'Move course' : 'Add course';
  const groups = locked ? [] : missingGroups(course, atTerm, prerequisites);
  const status = byId('detail-status');
  byId('detail-code').textContent = code;
  byId('detail-title').textContent = course.name;
  status.classList.toggle('needs-attention', groups.length > 0);
  if (locked) {
    status.textContent = `${outcomeLabels[outcomeFor(code)]} · Locked to ${termsById.get(atTerm).label}`;
  } else if (groups.length) {
    const timing = atTerm ? `Before ${termsById.get(atTerm).label}: ` : '';
    status.textContent = timing + explainMissing(groups, atTerm, prerequisites);
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
  } else if (personal) {
    note.append(element('span', '', 'This personal plan uses the local course catalog.'));
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
  graphCleanup = renderGraph(graph, code, getCourse, withEquivalents(scheduled), {
    onPlacementChange: changeGraphTerm, view: graphView, favoriteStar, prerequisites, outcomeFor,
  });
  graph.dataset.course = code;
  const viewport = graph.querySelector('.graph-scroll');
  byId('placement-form').hidden = Boolean(viewport) || locked;
  if (viewport) viewport.scrollTo(scroll ?? { left: viewport.scrollWidth });
  if (focusCourse) {
    const select = graph.querySelector(`[data-graph-term="${CSS.escape(focusCourse)}"]`);
    if (select && !select.disabled) select.focus();
    else if (!viewport && !locked) byId('target-term').focus();
  } else if (graphControl) {
    graph.querySelector(`[data-graph-control="${CSS.escape(graphControl)}"]`)?.focus({ preventScroll: true });
  }
}

function loadDetails(codes) {
  if (personal) return;
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
  code = actualCode(code);
  const next = placeCourse(plan, code, target, outcomes);
  if (next === plan) return;
  const moved = scheduled.has(code);
  plan = next;
  renderPlan();
  savePlan();
  announce(`${code} ${moved ? 'moved' : 'added'} to ${termsById.get(target).label}.`);
  if (!sampleCatalog.has(code)) loadDetails([code]);
}

function removeFromPlan(code) {
  code = actualCode(code);
  const next = removeCourse(plan, code, outcomes);
  if (next === plan) return;
  plan = next;
  delete outcomes[code];
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
  const reason = explainMissing(groups, term.id, prerequisites);
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

function showOutcomeMenu(code) {
  outcomeCode = code;
  const term = termsById.get(scheduled.get(code));
  byId('outcome-code').textContent = `${code} · ${term.label}`;
  const choices = Object.entries({ planned: 'Planned', ...outcomeLabels }).map(([outcome, label]) => {
    const button = makeButton('button outcome-option', null, label);
    button.setAttribute('aria-pressed', String((outcomes[code] ?? 'planned') === outcome));
    button.addEventListener('click', () => {
      if (outcome === 'planned') delete outcomes[code];
      else outcomes[code] = outcome;
      outcomeDialog.close();
      renderPlan();
      savePlan();
      announce(`${code} marked ${label.toLowerCase()}.`);
    });
    return button;
  });
  byId('outcome-options').replaceChildren(...choices);
  outcomeDialog.showModal();
  setHoveredCourse(undefined);
}

function termCourse(code, term, groups) {
  const course = getCourse(code);
  const card = element('div', 'term-course');
  makeDraggable(card, code);
  const grip = element('span', 'drag-handle');
  grip.setAttribute('aria-hidden', 'true');
  if (pinned(code)) card.classList.add('course-pinned');
  const open = makeButton('term-course-open', `View ${code} prerequisites in ${term.label}`);
  open.append(element('span', 'course-code', code));
  open.title = course.name;
  open.addEventListener('click', () => showCourse(code, open));
  const name = element('span', 'term-course-name', course.name);
  name.addEventListener('click', () => showCourse(code, open));
  if (!pinned(code)) card.append(grip);
  card.append(withFavorite(open, code), name);
  if (groups.length) card.append(warningBadge(code, term, groups));
  const outcome = outcomeFor(code);
  if (outcome) {
    const label = element('span', `course-outcome ${outcome}`, outcomeLabels[outcome]);
    card.classList.add(`outcome-${outcome}`);
    if (pinned(code)) label.title = 'Locked to this term';
    card.append(label);
  }
  const menu = makeButton('course-outcome-menu', `Change status for ${code} in ${term.label}`, '⋯');
  menu.setAttribute('aria-haspopup', 'dialog');
  menu.addEventListener('click', () => showOutcomeMenu(code));
  card.append(menu);
  return card;
}

function updateScheduleHighlight(focus = document.activeElement) {
  const focused = focus instanceof Element && focus.matches(':focus-visible')
    ? focus.closest('.term-course')?.dataset.course
    : undefined;
  const selected = dialog.open || degreeDialog.open || outcomeDialog.open || drag?.ghost ? undefined : hoveredCourse ?? focused;
  const required = new Set(getCourse(selected).groups?.flatMap(({ options }) => options.map(actualCode)));
  const target = scheduled.get(selected);
  for (const card of board.querySelectorAll('.term-course')) {
    const { course } = card.dataset;
    const active = course === selected;
    const status = !active && required.has(course) ? courseStatus(course, target, counted) : undefined;
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
  if (event.pointerType === 'touch' || dialog.open || degreeDialog.open || outcomeDialog.open || drag?.ghost) return;
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
  if (term.note) cell.append(element('p', 'term-note', term.note));
  if (plan[term.id].length) {
    const list = element('div', 'term-courses');
    for (const code of plan[term.id]) {
      const groups = pinned(code) ? [] : missingGroups(getCourse(code), term.id, prerequisites);
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
  byId('planned-count').textContent = `${scheduled.size} ${Object.keys(outcomes).length ? 'courses' : 'planned'}`;
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
    header.append(withFavorite(label, code), element('span', '', term.label));
    bucket.append(header);
    for (const group of groups) {
      const { outstanding, remaining } = groupProgress(group, term.id, prerequisites);
      const options = element('div', 'bucket-options');
      const caption = group.options.length === 1
        ? 'Required course'
        : `Choose ${remaining} of ${outstanding.length}${remaining < group.count ? ' remaining' : ''}`;
      options.append(element('div', 'bucket-caption', caption));
      const chips = element('div', 'bucket-chips');
      for (const option of outstanding) {
        const course = getCourse(option);
        const status = outcomeFor(option) === 'failed' ? 'failed' : courseStatus(option, term.id, prerequisites);
        const chip = makeButton('bucket-chip', `${option}, ${course.name}, ${statusText[status]}`, option);
        chip.title = status === 'late' ? `${course.name} · Needs an earlier term` : course.name;
        makeDraggable(chip, option);
        chip.addEventListener('click', () => showCourse(option, chip, true));
        chips.append(withFavorite(chip, option));
      }
      options.append(chips);
      bucket.append(options);
    }
    return bucket;
  });
  section.replaceChildren(...buckets);
}

function updateDegree() {
  degreeReport = evaluateDegree(requirements, archive, counted, { timeline: terms, equivalents });
  const met = degreeReport.met === degreeReport.total;
  degreeButton.classList.toggle('met', met);
  byId('degree-percent').textContent = `${degreeReport.percent}%`;
  byId('degree-status').textContent = met ? 'Passes modeled requirements' : 'Degree requirements incomplete';
  byId('degree-rule-count').textContent = `${degreeReport.met} of ${degreeReport.total} rules met`;
  byId('degree-course-count').textContent = `${degreeReport.total - degreeReport.met} rules left`;
  updateDegreeSidebar(degreeReport);
  refreshDegreeReport?.(degreeReport);
}

function catalogCard(course) {
  const { code, name } = course;
  const card = element('div', 'catalog-card');
  makeDraggable(card, code);
  const grip = element('span', 'drag-handle');
  grip.setAttribute('aria-hidden', 'true');
  const open = makeButton('catalog-open', `View ${code} prerequisites`);
  open.append(element('span', 'course-code', code));
  open.addEventListener('click', () => showCourse(code, open));
  const info = element('div', 'catalog-info');
  const title = element('span', 'catalog-course-name', name);
  title.addEventListener('click', () => showCourse(code, open));
  info.append(withFavorite(open, code), title);
  const term = termsById.get(scheduled.get(actualCode(code)));
  const action = pinned(code) ? 'View' : term ? 'Move' : 'Schedule';
  const add = makeButton('icon-button catalog-add', `${action} ${code}`, term ? '✓' : '+');
  add.title = pinned(code) ? `Locked to ${term.label}` : term ? `Planned for ${term.label}` : `Schedule ${code}`;
  add.addEventListener('click', () => showCourse(code, add, true));
  card.append(grip, info, add);
  return card;
}

function renderFavorites() {
  const cards = [...favorites].map((code) => catalogCard(getCourse(code)));
  byId('favorite-count').textContent = favorites.size;
  favoritesList.replaceChildren(...(cards.length ? cards : [element('p', 'quiet-message', 'Star a course to save it here.')]));
}

function renderCatalog() {
  const query = search.value.trim().toLowerCase();
  const simplify = (value) => value.toLowerCase().replace(/\s/g, '');
  const searchTerms = query.split(/\s+/);
  const matches = [...catalog.values()].filter(({ code, name, aliases = [] }) => {
    if (scheduled.has(actualCode(code))) return false;
    const codes = [code, ...aliases].map(simplify);
    const haystack = `${code} ${name} ${aliases.join(' ')}`.toLowerCase();
    return codes.some((value) => value.startsWith(simplify(query))) ||
      searchTerms.every((word) => haystack.includes(word));
  });
  byId('results-title').textContent = query ? 'Search results' : 'All courses';
  byId('catalog-source').textContent = query ? `${matches.length} found` : liveCatalog ? 'UW Flow catalog' : '2023–24 catalog';
  if (!matches.length) {
    courseList.replaceChildren(element('p', 'quiet-message', 'No unscheduled courses match your search.'));
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
  equivalentPlacements = new Map(Object.entries(equivalents)
    .filter(([actual]) => scheduled.has(actual))
    .map(([actual, required]) => [required, actual]));
  counted = countableSchedule(scheduled, outcomes);
  prerequisites = withEquivalents(counted);
  renderBoard();
  updateDegree();
  renderBuckets();
  renderFavorites();
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
function replacePlan(next, message, nextOutcomes = {}) {
  plan = next;
  targets = readTermTargets(profile?.targets);
  outcomes = readOutcomes(nextOutcomes, indexPlan(plan));
  renderPlan();
  savePlan();
  announce(message);
}
byId('reset-plan').addEventListener('click', () => {
  if (personal) {
    if (profile && window.confirm('Replace your edits with the imported course plan?')) {
      replacePlan(readPlan(profile.plan), 'Imported plan restored.', profile.outcomes);
    }
  } else if (window.confirm('Replace your edits with the sample plan?')) {
    replacePlan(initialPlan(), 'Sample plan restored.');
  }
});
byId('clear-plan').addEventListener('click', () => {
  if (!window.confirm('Start a blank plan? This clears scheduled courses and recorded outcomes.')) return;
  const blank = Object.fromEntries(terms.map(({ id }) => [id, []]));
  replacePlan(blank, 'Blank plan started.');
});
degreeButton.addEventListener('click', () => {
  const report = byId('degree-report');
  refreshDegreeReport = renderDegreeReport(report, degreeReport, requirements, archive, {
    favoriteStar, getCourse, showCourse,
  });
  report.scrollTop = 0;
  degreeDialog.showModal();
  setHoveredCourse(undefined);
});
byId('close-degree-check').addEventListener('click', () => degreeDialog.close());
byId('close-outcome').addEventListener('click', () => outcomeDialog.close());
outcomeDialog.addEventListener('close', () => {
  board.querySelector(`[data-course="${CSS.escape(outcomeCode)}"] .course-outcome-menu`)?.focus({ preventScroll: true });
});
degreeDialog.addEventListener('close', () => {
  refreshDegreeReport = undefined;
  degreeButton.focus({ preventScroll: true });
});
byId('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (dialog.open) return;
  graphCleanup();
  if (dialogTrigger) {
    const opener = dialogTrigger.isConnected && !dialogTrigger.closest('[hidden]') ? dialogTrigger : search;
    opener.focus({ preventScroll: true });
  }
  selectedCode = undefined;
});
byId('placement-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = selectedCode;
  const target = byId('target-term').value;
  if (!degreeDialog.open) dialogTrigger = null;
  dialog.close();
  addOrMove(code, target);
  if (degreeDialog.open) return;
  const cell = document.querySelector(`[data-term="${target}"]`);
  const card = cell?.querySelector(`[data-course="${CSS.escape(code)}"] .term-course-open`);
  card?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  card?.focus({ preventScroll: true });
});
byId('remove-course').addEventListener('click', () => {
  const code = selectedCode;
  if (!degreeDialog.open) dialogTrigger = null;
  dialog.close();
  removeFromPlan(code);
  if (!degreeDialog.open) search.focus({ preventScroll: true });
});

const updateDegreeSidebar = renderDegreeSidebar(byId('degree-course-list'), requirements, archive, {
  favoriteStar, getCourse, makeDraggable, showCourse,
});
if (personal) {
  byId('planner-title').textContent = profile ? 'Alex’s course plan' : 'Personal plan unavailable';
  byId('open-sample-plan').hidden = false;
  byId('reset-plan').textContent = 'Restore Alex’s plan';
  byId('reset-plan').hidden = !profile;
}
renderPlan();
if (!personal) {
  request('./api/profile-status').then(({ available }) => {
    byId('open-personal-plan').hidden = !available;
  }).catch(() => {});
  request('./api/catalog').then((rows) => {
    if (!Array.isArray(rows) || !rows.length) return;
    for (const { code: rawCode, name, aliases } of rows) {
      const code = normalizeCode(rawCode);
      catalog.set(code, { ...getCourse(code), code, name, aliases: aliases ?? [] });
    }
    liveCatalog = true;
    renderCatalog();
    renderFavorites();
  }).catch(() => {});
  const restored = [...scheduled.keys()].filter((code) => !sampleCatalog.has(code));
  for (let i = 0; i < restored.length; i += 50) loadDetails(restored.slice(i, i + 50));
}
