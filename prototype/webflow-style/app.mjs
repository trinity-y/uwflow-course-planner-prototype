import { calendarUrl, createTerms, firstPlanYear, initialPlan, lastPlanYear, sampleCatalog, seasons, termOrder, termYear, terms as defaultTerms } from './calendar.mjs';
import {
  countableSchedule, courseStatus, explainMissing, groupProgress, indexPlan, isAcademicCourse, isPinned,
  maxTermTarget, missingGroups, normalizeCode, outcomeLabels, parseLivePrerequisites,
  placeCourse, readOutcomes, readPlan, readTermDetails, readTermTargets, readYearRange, removeCourse,
} from './model.mjs';
import { element, renderGraph, termOptions } from './graph.mjs';
import { degreeCourseSets, evaluateDegree } from './degree.mjs';
import { renderCourseContributions, renderDegreeReport, renderDegreeSidebar } from './degree-view.mjs';
import requirements from './degree-requirements.json' with { type: 'json' };
import archive from './calendar-courses.json' with { type: 'json' };

const personal = location.pathname === '/personal';
const profile = personal
  ? await fetch('./api/profile').then((response) => response.ok ? response.json() : null).catch(() => null)
  : null;
const scope = personal ? '-alex' : '';
const storageKey = `uwflow-webflow-planner-v1${scope}`;
const favoritesKey = `uwflow-webflow-planner-favorites-v1${scope}`;
const equivalents = profile?.equivalents ?? {};
const pageSize = 30;
const byId = (id) => document.getElementById(id);
const dialog = byId('course-dialog');
const degreeDialog = byId('degree-dialog');
const outcomeDialog = byId('outcome-dialog');
const termEditor = byId('term-editor');
const entryTitle = byId('term-entry-title');
const entryBody = byId('term-entry-body');
const startYear = byId('start-year');
const endYear = byId('end-year');
const degreeButton = byId('open-degree-check');
const search = byId('course-search');
const courseList = byId('catalog-list');
const favoritesList = byId('favorites-list');
const board = byId('term-board');
const termsById = new Map(defaultTerms.map((term) => [term.id, { ...term, ...profile?.terms?.[term.id] }]));
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

let yearRange = readYearRange(saved?.yearRange);
for (const id of Object.keys({ ...profile?.plan, ...saved?.plan, ...saved?.targets })) {
  const year = termYear(id);
  if (year !== undefined && !termsById.has(id)) registerTerms({ start: year, end: year });
}
registerTerms(yearRange);
let plan = readPlan(saved?.plan ?? profile?.plan, timeline());
let targets = plannerTargets(saved?.targets ?? profile?.targets, !saved?.yearRange);
let { titles: termTitles, notes: termNotes } = readTermDetails(saved?.termDetails, timeline());
const disabledRules = new Set(requirements.rules.filter(({ id }) =>
  Array.isArray(saved?.disabledRules) && saved.disabledRules.includes(id),
).map(({ id }) => id));
let termEdit;
let scheduled = indexPlan(plan);
let scheduledCredits;
let outcomes = readOutcomes(saved?.outcomes ?? profile?.outcomes, scheduled);
const applyProfileUpdate = saved && profile?.revision && saved.profileRevision !== profile.revision;
if (applyProfileUpdate) {
  for (const [termId, codes] of Object.entries(profile.additions ?? {})) {
    for (const code of codes) if (!scheduled.has(code)) plan = placeCourse(plan, code, termId);
  }
}
let equivalentPlacements = new Map();
let counted;
let prerequisites;
let warningList = [];
let degreeReport;
let refreshDegreeReport;
let listedDegreeRules;
let selectedCode;
let graphView;
let dialogTrigger;
let graphCleanup = () => {};
let resultLimit = pageSize;
let liveCatalog = false;
let drag;
let suppressClick;
let hoveredCourse;
let locatedCourse;
let outcomeCode;

const getCourse = (code) => catalog.get(code) ?? { code, name: code };
const actualCode = (code) => scheduled.has(code) ? code : equivalentPlacements.get(code) ?? code;
const creditCode = (code) => archive[equivalents[code] ?? code]?.[2] ?? (equivalents[code] ?? code);
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

function registerTerms(range) {
  const added = createTerms(range).filter(({ id }) => !termsById.has(id));
  for (const term of added) termsById.set(term.id, { ...term, ...profile?.terms?.[term.id] });
  return added;
}

function timeline() {
  return [...termsById.values()].sort((a, b) => termOrder(a.id) - termOrder(b.id));
}

function plannerTargets(raw, resetOpenTerms) {
  const current = timeline();
  const values = readTermTargets(raw, current);
  if (resetOpenTerms) {
    for (const term of current) if (!term.level) values[term.id] = 0;
  }
  return values;
}

function inYearRange(year) {
  return year >= yearRange.start && year <= yearRange.end;
}

function placementOptions(label, required, currentTerm) {
  const choices = timeline().filter((term) => inYearRange(term.year) || term.id === currentTerm);
  return termOptions(choices, label, required);
}

function savePlan() {
  const courses = [...scheduled.keys()].filter((code) => !sampleCatalog.has(code)).map((code) => {
    const { name } = getCourse(code);
    return { code, name };
  });
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      plan, targets, outcomes, courses, yearRange, termDetails: { titles: termTitles, notes: termNotes },
      disabledRules: [...disabledRules], profileRevision: profile?.revision,
    }));
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
  const cell = document.elementFromPoint(active.x, active.y)?.closest('.term-card');
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

function findPlacement(code) {
  const actual = actualCode(code);
  const credit = creditCode(code);
  const placed = scheduled.has(actual) ? actual : scheduledCredits.get(credit);
  const term = termsById.get(scheduled.get(placed));
  return term ? { code: placed, term } : undefined;
}

function locateCourse(code) {
  const placement = findPlacement(code);
  if (!placement) return;
  if (!inYearRange(placement.term.year)) {
    showYears(Math.min(yearRange.start, placement.term.year), Math.max(yearRange.end, placement.term.year));
  }
  const card = board.querySelector(`[data-course="${CSS.escape(placement.code)}"]`);
  if (!card) return;
  dialogTrigger = null;
  for (const modal of [dialog, outcomeDialog, degreeDialog]) if (modal.open) modal.close();
  locatedCourse = placement.code;
  hoveredCourse = undefined;
  updateScheduleHighlight();
  card.scrollIntoView({ block: 'center', inline: 'center' });
  card.querySelector('.term-course-open').focus({ preventScroll: true });
  announce(`${placement.code} is in ${placement.term.label}.`);
}

function updateContributions(container, code) {
  if (!listedDegreeRules) {
    listedDegreeRules = new Map();
    for (const rule of requirements.rules) {
      for (const { options } of degreeCourseSets(requirements, archive, rule)) {
        for (const option of options) {
          for (const entry of option) {
            const credit = creditCode(entry);
            if (!listedDegreeRules.has(credit)) listedDegreeRules.set(credit, new Set());
            listedDegreeRules.get(credit).add(rule.id);
          }
        }
      }
    }
  }
  const listed = listedDegreeRules.get(creditCode(code));
  const rules = [];
  for (const { id, title, matched, additional, disabled } of degreeReport.rules) {
    if (disabled) continue;
    if (matched.includes(code)) rules.push({ id, title, status: 'Counted' });
    else if (additional.includes(code)) rules.push({ id, title, status: 'Additional eligible' });
    else if (listed?.has(id)) rules.push({ id, title, status: 'On course list' });
  }
  const usedBy = [];
  const listedFor = [];
  for (const [dependent, term] of scheduled) {
    if (dependent === code) continue;
    const options = getCourse(dependent).groups?.flatMap((group) => group.options).filter((option) => actualCode(option) === code);
    if (!options?.length) continue;
    const matches = options.some((option) => courseStatus(option, term, prerequisites) === 'planned');
    (matches ? usedBy : listedFor).push(dependent);
  }
  renderCourseContributions(container, rules, { usedBy, listedFor }, degreeActions);
}

function showCourse(code, trigger, focusPlacement = false) {
  code = actualCode(code);
  selectedCode = code;
  graphView = { course: code, slot: null };
  dialogTrigger = trigger;
  const currentTerm = scheduled.get(code);
  byId('detail-favorite').replaceChildren(favoriteStar(code));
  const select = byId('target-term');
  select.replaceChildren(...placementOptions('Choose a term', true, currentTerm));
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
  byId('locate-detail-course').hidden = !atTerm;
  byId('place-course').textContent = atTerm ? 'Move course' : 'Add course';
  updateContributions(byId('detail-contributions'), code);
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
    onPlacementChange: changeGraphTerm, view: graphView, favoriteStar, prerequisites, outcomeFor, placementOptions,
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
  updateContributions(byId('outcome-contributions'), code);
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
  const selected = dialog.open || degreeDialog.open || outcomeDialog.open || termEditor.open || drag?.ghost ? undefined : hoveredCourse ?? focused;
  const required = new Set(getCourse(selected).groups?.flatMap(({ options }) => options.map(actualCode)));
  const target = scheduled.get(selected);
  for (const card of board.querySelectorAll('.term-course')) {
    const { course } = card.dataset;
    const active = course === selected;
    const status = !active && required.has(course) ? courseStatus(course, target, counted) : undefined;
    card.classList.toggle('schedule-selected', active || course === locatedCourse);
    card.classList.toggle('schedule-prerequisite', status === 'planned');
    card.classList.toggle('schedule-prerequisite-late', status === 'late');
    card.classList.toggle('schedule-muted', Boolean(selected) && !active && !status && course !== locatedCourse);
  }
}

function setHoveredCourse(code) {
  if (hoveredCourse === code) return;
  hoveredCourse = code;
  updateScheduleHighlight();
}

board.addEventListener('pointerover', (event) => {
  if (event.pointerType === 'touch' || dialog.open || degreeDialog.open || outcomeDialog.open || termEditor.open || drag?.ghost) return;
  setHoveredCourse(event.target.closest('.term-course')?.dataset.course);
});
board.addEventListener('pointerleave', () => setHoveredCourse(undefined));
board.addEventListener('focusin', (event) => updateScheduleHighlight(event.target));
board.addEventListener('focusout', (event) => updateScheduleHighlight(event.relatedTarget));
document.addEventListener('pointerdown', (event) => {
  if (!locatedCourse || event.target.closest('.term-course')?.dataset.course === locatedCourse) return;
  locatedCourse = undefined;
  updateScheduleHighlight();
});

function termTitle(term) {
  return termTitles[term.id] ?? term.note ?? '';
}

function openTermEditor(term, kind, noteIndex) {
  const editingTitle = kind === 'title';
  const note = termNotes[term.id]?.[noteIndex];
  termEdit = { term, kind, noteIndex };
  byId('term-editor-term').textContent = term.label;
  byId('term-editor-title').textContent = editingTitle ? 'Edit term title' : note ? 'Edit note' : 'Add note';
  byId('save-term-entry').textContent = editingTitle || note ? 'Save' : 'Add note';
  byId('remove-term-note').hidden = !note;
  entryTitle.required = !editingTitle;
  entryTitle.placeholder = editingTitle ? 'e.g. Co-op placement' : 'e.g. Exchange semester';
  entryTitle.value = editingTitle ? termTitle(term) : note?.title ?? '';
  entryTitle.setCustomValidity('');
  entryBody.hidden = byId('term-entry-body-label').hidden = editingTitle;
  entryBody.value = note?.body ?? '';
  termEditor.showModal();
  entryTitle.select();
  setHoveredCourse(undefined);
}

function saveTermEdit(remove = false) {
  const { term, kind, noteIndex } = termEdit;
  const title = entryTitle.value.trim();
  let focus = '.term-title';
  if (kind === 'title') {
    termTitles[term.id] = title;
  } else {
    const notes = termNotes[term.id] ??= [];
    if (remove) {
      notes.splice(noteIndex, 1);
      focus = '.add-term-note';
    } else {
      if (!title) {
        entryTitle.setCustomValidity('Enter a title for this note.');
        entryTitle.reportValidity();
        return;
      }
      const index = noteIndex ?? notes.length;
      notes[index] = { title, body: entryBody.value.trim() };
      focus = `[data-note-index="${index}"]`;
    }
  }
  termEditor.close();
  renderBoard();
  savePlan();
  const cell = board.querySelector(`[data-term="${term.id}"]`);
  (cell.querySelector(focus) ?? cell.querySelector('.term-title')).focus({ preventScroll: true });
  announce(`${kind === 'title' ? 'Term title saved' : remove ? 'Note removed' : 'Note saved'} for ${term.label}.`);
}

function noteSlot(term, slot, zero) {
  const item = makeButton(`add-term-note ${zero ? 'term-empty' : 'empty-slot'}`,
    `Add note in ${term.label}${zero ? '' : `, slot ${slot + 1}`}`);
  const plus = element('span', zero ? 'empty-plus' : '', '+');
  plus.setAttribute('aria-hidden', 'true');
  item.append(plus, element('span', '', zero ? 'Add note' : 'Empty slot'));
  item.addEventListener('click', () => openTermEditor(term, 'note'));
  return item;
}

function updateSlots(container, term) {
  const target = targets[term.id];
  const zero = target === 0;
  const classes = plan[term.id].filter(isAcademicCourse).length;
  const emptySlots = target - classes - (zero ? 0 : termNotes[term.id]?.length ?? 0);
  const items = [];
  container.closest('.term-card').classList.toggle('zero-target', zero);
  container.removeAttribute('aria-label');
  container.removeAttribute('role');
  if (emptySlots > 0) {
    container.role = 'group';
    container.setAttribute('aria-label', `${emptySlots} empty ${emptySlots === 1 ? 'slot' : 'slots'}`);
    for (let slot = 0; slot < emptySlots; slot += 1) items.push(noteSlot(term, slot, false));
  } else if (emptySlots < 0) {
    const over = Math.abs(emptySlots);
    items.push(element('div', 'term-over-target', `${over} over target`));
  }
  if (zero) items.push(noteSlot(term, 0, true));
  container.replaceChildren(...items);
}

function renderTerm(term) {
  const cell = element('section', 'term-card');
  cell.dataset.term = term.id;
  cell.setAttribute('aria-label', term.label);
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
  const title = termTitle(term);
  const edit = makeButton(`term-title${title ? '' : ' untitled'}`, `Edit title for ${term.label}${title ? `, ${title}` : ''}`);
  edit.setAttribute('aria-haspopup', 'dialog');
  edit.append(element('span', 'term-title-text', title || 'Add term title'));
  const pencil = element('span', 'term-pencil', '✎');
  pencil.setAttribute('aria-hidden', 'true');
  edit.append(pencil);
  edit.addEventListener('click', () => openTermEditor(term, 'title'));
  cell.append(edit);
  const notes = termNotes[term.id] ?? [];
  if (plan[term.id].length || notes.length) {
    const list = element('div', 'term-courses');
    for (const code of plan[term.id]) {
      const groups = pinned(code) ? [] : missingGroups(getCourse(code), term.id, prerequisites);
      if (groups.length) warningList.push({ code, term, groups });
      list.append(termCourse(code, term, groups));
    }
    for (const [noteIndex, note] of notes.entries()) {
      const entry = makeButton('term-note-card', `Edit note ${note.title} in ${term.label}`);
      entry.setAttribute('aria-haspopup', 'dialog');
      entry.dataset.noteIndex = noteIndex;
      entry.append(element('strong', '', note.title), element('span', 'term-note-tag', 'Note'));
      if (note.body) entry.append(element('span', 'term-note-body', note.body));
      entry.addEventListener('click', () => openTermEditor(term, 'note', noteIndex));
      list.append(entry);
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
  for (let year = yearRange.start; year <= yearRange.end; year += 1) {
    grid.append(element('h3', 'year-label', year));
    for (const season of seasons) grid.append(renderTerm(termsById.get(`${year}-${season.toLowerCase()}`)));
  }
  board.replaceChildren(grid);
  hoveredCourse = board.querySelector('.term-course:hover')?.dataset.course;
  updateScheduleHighlight();
  byId('planned-count').textContent = `${[...scheduled.keys()].filter(isAcademicCourse).length} ${Object.keys(outcomes).length ? 'courses' : 'planned'}`;
  const warning = byId('warning-summary');
  const count = warningList.length;
  warning.hidden = count === 0;
  warning.textContent = `${count} ${count === 1 ? 'warning' : 'warnings'}`;
}

function renderBuckets() {
  byId('prereq-section').hidden = warningList.length === 0;
  byId('bucket-count').textContent = warningList.length;

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
  byId('prereq-list').replaceChildren(...buckets);
}

function updateDegree() {
  degreeReport = evaluateDegree(requirements, archive, counted, { timeline: timeline(), equivalents, disabledRules });
  const active = degreeReport.total > 0;
  const met = active && degreeReport.met === degreeReport.total;
  degreeButton.classList.toggle('met', met);
  byId('degree-percent').textContent = active ? `${degreeReport.percent}%` : '—';
  byId('degree-status').textContent = !active ? 'No active rules' : met ? 'Passes modeled requirements' : 'Degree requirements incomplete';
  byId('degree-rule-count').textContent = active ? `${degreeReport.met} of ${degreeReport.total} rules met` : '';
  byId('degree-course-count').textContent = `${degreeReport.total - degreeReport.met} rules left`;
  byId('degree-section').hidden = met || !active;
  updateDegreeSidebar(degreeReport);
  refreshDegreeReport?.(degreeReport);
}

function setRuleEnabled(id, enabled) {
  if (enabled) disabledRules.delete(id);
  else disabledRules.add(id);
  updateDegree();
  savePlan();
  announce(`${requirements.rules.find((rule) => rule.id === id).title} turned ${enabled ? 'on' : 'off'}.`);
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
  byId('catalog-source').textContent = query ? `${matches.length} found` : liveCatalog ? 'UW Flow catalog' : 'Bundled catalog';
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
  scheduledCredits = new Map();
  for (const code of scheduled.keys()) {
    const credit = creditCode(code);
    if (!scheduledCredits.has(credit)) scheduledCredits.set(credit, code);
  }
  if (!scheduled.has(locatedCourse)) locatedCourse = undefined;
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

function showYears(start, end) {
  yearRange = { start, end };
  startYear.value = start;
  endYear.value = end;
  for (const { id, target } of registerTerms(yearRange)) {
    plan[id] = [];
    targets[id] = target;
  }
  renderBoard();
  savePlan();
}

for (const input of [startYear, endYear]) {
  input.min = firstPlanYear;
  input.max = lastPlanYear;
  input.addEventListener('input', () => endYear.setCustomValidity(''));
}
startYear.value = yearRange.start;
endYear.value = yearRange.end;
byId('year-range').addEventListener('submit', (event) => {
  event.preventDefault();
  if (startYear.valueAsNumber > endYear.valueAsNumber) {
    endYear.setCustomValidity('Enter an end year on or after the start year.');
    endYear.reportValidity();
    return;
  }
  showYears(startYear.valueAsNumber, endYear.valueAsNumber);
  announce(`Showing ${yearRange.start} through ${yearRange.end}.`);
});

entryTitle.addEventListener('input', () => entryTitle.setCustomValidity(''));
byId('close-term-editor').addEventListener('click', () => termEditor.close());
byId('remove-term-note').addEventListener('click', () => saveTermEdit(true));
byId('term-editor-form').addEventListener('submit', (event) => {
  event.preventDefault();
  saveTermEdit();
});

search.addEventListener('input', () => {
  resultLimit = pageSize;
  courseList.scrollTop = 0;
  renderCatalog();
});
byId('calendar-link').href = calendarUrl;
byId('degree-calendar').textContent = `${requirements.program} · ${requirements.calendar}`;
byId('warning-summary').addEventListener('click', () => {
  const first = document.querySelector('.warning-trigger');
  first?.scrollIntoView({ block: 'center', inline: 'center' });
  first?.focus({ preventScroll: true });
});
function replacePlan(next, message, nextOutcomes = {}) {
  plan = next;
  targets = plannerTargets(profile?.targets, true);
  outcomes = readOutcomes(nextOutcomes, indexPlan(plan));
  termNotes = {};
  renderPlan();
  savePlan();
  announce(message);
}
byId('reset-plan').addEventListener('click', () => {
  if (personal) {
    if (profile && window.confirm('Replace your edits with the imported course plan?')) {
      termTitles = {};
      replacePlan(readPlan(profile.plan, timeline()), 'Imported plan restored.', profile.outcomes);
    }
  } else if (window.confirm('Replace your edits with the sample plan?')) {
    termTitles = {};
    replacePlan(initialPlan(timeline()), 'Sample plan restored.');
  }
});
byId('clear-plan').addEventListener('click', () => {
  if (!window.confirm('Start a blank plan? This clears scheduled courses, recorded outcomes, and note cards.')) return;
  const blank = Object.fromEntries(timeline().map(({ id }) => [id, []]));
  replacePlan(blank, 'Blank plan started.');
});
function showDegreeRule(id) {
  const report = byId('degree-report');
  dialogTrigger = null;
  if (dialog.open) dialog.close();
  if (outcomeDialog.open) outcomeDialog.close();
  if (!degreeDialog.open) {
    refreshDegreeReport = renderDegreeReport(report, degreeReport, requirements, archive, degreeActions);
    report.scrollTop = 0;
    degreeDialog.showModal();
  }
  setHoveredCourse(undefined);
  if (id) {
    const rule = report.querySelector(`[data-degree-rule="${CSS.escape(id)}"]`);
    rule.querySelector('details').open = true;
    rule.querySelector('h3').scrollIntoView({ block: 'start' });
    rule.querySelector('h3').focus({ preventScroll: true });
  }
}
degreeButton.addEventListener('click', () => showDegreeRule());
byId('close-degree-check').addEventListener('click', () => degreeDialog.close());
byId('close-outcome').addEventListener('click', () => outcomeDialog.close());
outcomeDialog.addEventListener('close', () => {
  if (degreeDialog.open || board.contains(document.activeElement)) return;
  board.querySelector(`[data-course="${CSS.escape(outcomeCode)}"] .course-outcome-menu`)?.focus({ preventScroll: true });
});
degreeDialog.addEventListener('close', () => {
  if (degreeDialog.open) return;
  refreshDegreeReport = undefined;
  if (!board.contains(document.activeElement)) degreeButton.focus({ preventScroll: true });
});
byId('close-dialog').addEventListener('click', () => dialog.close());
byId('locate-detail-course').addEventListener('click', () => locateCourse(selectedCode));
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

const degreeActions = {
  favoriteStar, getCourse, findPlacement, locateCourse, makeDraggable, showCourse, showDegreeRule, setRuleEnabled, getPlan: () => plan,
};
const updateDegreeSidebar = renderDegreeSidebar(byId('degree-course-list'), requirements, archive, degreeActions);
if (personal) {
  byId('planner-title').textContent = profile ? 'Alex’s course plan' : 'Personal plan unavailable';
  byId('open-sample-plan').hidden = false;
  byId('reset-plan').textContent = 'Restore Alex’s plan';
  byId('reset-plan').hidden = !profile;
}
renderPlan();
if (applyProfileUpdate || (saved && !saved.yearRange)) savePlan();
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
