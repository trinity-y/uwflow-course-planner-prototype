import { termLabel } from './calendar.mjs';
import { buildGraph, courseStatus, groupLabel, groupProgress, isPinned, outcomeLabels } from './model.mjs';

export function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

export function termOptions(timeline, emptyLabel, required = false) {
  const empty = new Option(emptyLabel, '');
  empty.disabled = required;
  return [empty, ...timeline.map((term) => new Option(term.label, term.id))];
}

function slotLabel(group) {
  const countNames = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
  return group.count < group.options.length
    ? `${countNames[group.count] ?? group.count} of ${group.options.length}`
    : groupLabel(group);
}

function graphButton(className, content, control, label) {
  const button = element('button', className, content);
  button.type = 'button';
  button.dataset.graphControl = control;
  button.setAttribute('aria-label', label);
  return button;
}

export function renderGraph(container, code, getCourse, scheduled, { onPlacementChange, view, favoriteStar, prerequisites, outcomeFor, placementOptions }) {
  const { depth, edges } = buildGraph(code, getCourse);
  if (depth.size === 1) {
    container.replaceChildren();
    return () => {};
  }

  if (!depth.has(view.course)) {
    view.course = code;
    view.slot = null;
  }
  const target = scheduled.get(code);
  const scroll = element('div', 'graph-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Prerequisite courses, earliest steps first');
  const panel = element('section', 'graph-slots');
  panel.setAttribute('aria-labelledby', 'graph-slots-title');
  const canvas = element('canvas', 'graph-lines');
  canvas.setAttribute('aria-hidden', 'true');
  const layout = element('div', 'graph-layout');
  layout.append(canvas);
  const cards = new Map();
  const gates = new Map();
  const slotTargets = new Map();
  const summaries = new Map();
  const deepest = Math.max(...depth.values());
  let pointerPreview;
  let focusPreview;
  let currentGroup;
  let links = [];
  let frame;

  const selectedSlot = () => edges.get(view.course)[view.slot];

  function updateHighlight() {
    const preview = pointerPreview ?? focusPreview;
    const pinned = selectedSlot();
    const group = pinned ?? preview?.group;
    const primary = preview?.group === group ? preview?.option : undefined;
    const involved = group ? new Set([...group.options, slotTargets.get(group)]) : null;
    for (const [course, { node, button }] of cards) {
      const inspected = course === view.course;
      node.classList.toggle('graph-inspected', inspected);
      node.classList.toggle('graph-muted', involved !== null && !involved.has(course));
      node.classList.toggle('graph-emphasis', course === primary);
      button.setAttribute('aria-pressed', String(inspected));
    }
    for (const [slot, gate] of gates) {
      gate.classList.toggle('graph-muted', Boolean(group) && group !== slot);
      gate.setAttribute('aria-pressed', String(pinned === slot));
    }
    for (const [slot, { item, button }] of summaries) {
      const highlighted = group === slot;
      item.classList.toggle('graph-muted', Boolean(group) && !highlighted);
      item.classList.toggle('graph-slot-current', highlighted);
      button.setAttribute('aria-pressed', String(pinned === slot));
    }
    if (currentGroup !== group) {
      currentGroup = group;
      if (frame === undefined) frame = requestAnimationFrame(paint);
    }
  }

  function bindPreview(node, getPreview) {
    let pointer;
    let focus;
    node.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      pointer = getPreview();
      pointerPreview = pointer;
      updateHighlight();
    });
    node.addEventListener('pointerleave', () => {
      if (pointerPreview !== pointer) return;
      pointerPreview = undefined;
      updateHighlight();
    });
    node.addEventListener('focusin', (event) => {
      focus = event.target.matches(':focus-visible') ? getPreview() : undefined;
      focusPreview = focus;
      updateHighlight();
    });
    node.addEventListener('focusout', (event) => {
      if (focusPreview !== focus || node.contains(event.relatedTarget)) return;
      focusPreview = undefined;
      updateHighlight();
    });
  }

  function inspect(course) {
    view.course = course;
    view.slot = null;
    pointerPreview = undefined;
    focusPreview = undefined;
    renderSlots();
    updateHighlight();
    panel.querySelector('h4').focus({ preventScroll: true });
  }

  function toggleSlot(course, index) {
    const changedCourse = view.course !== course;
    view.slot = !changedCourse && view.slot === index ? null : index;
    view.course = course;
    if (changedCourse) renderSlots();
    updateHighlight();
  }

  function renderSlots() {
    const course = view.course;
    const heading = element('h4', '', `Prerequisite slots for ${course}`);
    heading.id = 'graph-slots-title';
    heading.tabIndex = -1;
    heading.dataset.graphControl = 'prerequisite-slots';
    summaries.clear();
    const list = element('ul', 'graph-slot-list');
    for (const [index, group] of edges.get(course).entries()) {
      if (group.count === null) continue;
      const { remaining } = groupProgress(group, scheduled.get(course), prerequisites);
      const label = slotLabel(group);
      const item = element('li', `graph-slot ${remaining ? 'unmet' : 'met'}`);
      const button = graphButton('graph-slot-button', undefined, `slot:${course}:${index}`,
        `Highlight ${label.toLowerCase()} slot ${index + 1} for ${course}`);
      button.append(
        element('strong', 'group-badge', label),
        element('span', 'graph-slot-progress', remaining ? `${remaining} needed` : 'Met'),
      );
      button.addEventListener('click', () => toggleSlot(course, index));
      bindPreview(button, () => ({ group }));
      const options = element('div', 'direct-options');
      for (const option of group.options) {
        const link = graphButton('direct-option', option, `option:${course}:${index}:${option}`,
          `Show ${option} in the prerequisite graph`);
        const star = favoriteStar(option);
        star.dataset.graphControl = `favorite:option:${course}:${index}:${option}`;
        const choice = element('span', 'course-with-star');
        bindPreview(link, () => ({ group, option }));
        link.addEventListener('click', () => cards.get(option).node.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
        choice.append(link, star);
        options.append(choice);
      }
      item.append(button, options);
      list.append(item);
      summaries.set(group, { item, button });
    }
    const noSlots = getCourse(course)?.groups ? 'No course prerequisites in this graph.' : 'No prerequisite slots available.';
    panel.replaceChildren(heading, list.childElementCount ? list : element('p', 'quiet-message', noSlots));
  }

  for (const [to, groups] of edges) {
    for (const [index, group] of groups.entries()) {
      if (group.count === null) continue;
      slotTargets.set(group, to);
      const label = slotLabel(group);
      const { remaining } = groupProgress(group, scheduled.get(to), prerequisites);
      const gate = graphButton(`graph-gate ${remaining ? 'unmet' : 'met'}`, label, `gate:${to}:${index}`,
        `Highlight ${label.toLowerCase()} branch ${index + 1} for ${to}`);
      gate.tabIndex = -1;
      gate.title = `${to}: ${label} from ${group.options.join(', ')}`;
      gate.addEventListener('click', () => toggleSlot(to, index));
      bindPreview(gate, () => ({ group }));
      layout.append(gate);
      gates.set(group, gate);
    }
  }

  for (let level = deepest; level >= 0; level -= 1) {
    const column = element('section', 'graph-column');
    const label = level === 0 ? 'Goal course' : level === 1 ? 'Direct prerequisites' : 'Earlier steps';
    if (level < 2) column.classList.add('graph-direct');
    column.append(element('h4', '', label));
    const stack = element('div', 'graph-stack');
    for (const [course, courseDepth] of depth) {
      if (courseDepth !== level) continue;
      const outcome = outcomeFor(course);
      const status = outcome === 'failed' ? 'failed' : level === 0 ? 'goal' : courseStatus(course, target, prerequisites);
      const node = element('div', `graph-node ${status}`);
      const currentTerm = scheduled.get(course);
      const name = getCourse(course)?.name;
      const courseName = element('span', 'graph-course-name', name);
      if (name) courseName.title = name;
      const select = element('select', 'graph-term');
      select.dataset.graphTerm = course;
      select.setAttribute('aria-label', `Term for ${course}`);
      select.replaceChildren(...placementOptions('Unscheduled', false, currentTerm));
      select.value = currentTerm ?? '';
      select.disabled = isPinned(outcome);
      select.addEventListener('change', () => onPlacementChange(course, select.value));
      const button = graphButton('graph-inspect', undefined, `course:${course}`, `Show prerequisite slots for ${course}`);
      button.addEventListener('click', () => inspect(course));
      const heading = element('span', 'graph-node-heading');
      const codeLabel = element('strong', '', course);
      const star = favoriteStar(course);
      star.dataset.graphControl = `favorite:course:${course}`;
      button.append(codeLabel);
      heading.append(button, star);
      const groupCount = getCourse(course)?.groups?.length ?? 0;
      node.style.setProperty('--slot-count', groupCount);
      if (groupCount) {
        heading.append(element('span', 'graph-all', `${groupCount} ${groupCount === 1 ? 'slot' : 'slots'}`));
      }
      courseName.addEventListener('click', () => inspect(course));
      node.append(heading, courseName, select);
      if (select.disabled) node.append(element('span', 'graph-node-caption', `${outcomeLabels[outcome]} · Locked`));
      else if (status === 'late') node.append(element('span', 'graph-node-caption', `${termLabel(currentTerm)} is too late`));
      bindPreview(node, () => {
        const pinned = selectedSlot();
        const slots = edges.get(view.course);
        const group = pinned ?? slots.find((slot) => slot.count !== null && slot.options.length > 1 && slot.options.includes(course));
        return group?.options.includes(course) ? { group, option: course } : undefined;
      });
      stack.append(node);
      cards.set(course, { node, button });
    }
    column.append(stack);
    layout.append(column);
  }

  scroll.append(layout);
  renderSlots();
  container.replaceChildren(panel, scroll);

  const ctx = canvas.getContext('2d');
  function paint() {
    frame = undefined;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    function stroke({ path, color, dashed }, opacity = 1, width = 1.5, strokeColor = color) {
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = width;
      ctx.setLineDash(dashed ? [4, 4] : []);
      ctx.stroke(path);
    }
    for (const link of links) {
      if (!currentGroup) stroke(link);
      else if (currentGroup !== link.group) stroke(link, .28, 1.5, '#a1a9b8');
    }
    for (const link of links) {
      if (currentGroup === link.group) stroke(link, 1, 2, '#526ccf');
    }
  }

  function measure() {
    const bounds = layout.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(bounds.width * scale);
    canvas.height = Math.ceil(bounds.height * scale);
    ctx.scale(scale, scale);
    links = [];

    for (const [to, groups] of edges) {
      const end = cards.get(to).node.getBoundingClientRect();
      const endX = end.left - bounds.left;
      const centerY = end.top + end.height / 2 - bounds.top;
      for (const [index, group] of groups.entries()) {
        const gate = gates.get(group);
        const gateX = endX - 38;
        const gateY = centerY + (index - (groups.length - 1) / 2) * 24;
        if (gate) {
          gate.style.transform = `translate(${gateX}px, ${gateY}px) translate(-50%, -50%)`;
          const path = new Path2D();
          path.moveTo(gateX, gateY);
          path.lineTo(endX, centerY);
          links.push({ group, path, color: '#8999c1' });
        }
        for (const from of group.options) {
          if (depth.get(from) <= depth.get(to)) continue;
          const start = cards.get(from).node.getBoundingClientRect();
          const x = start.right - bounds.left;
          const y = start.top + start.height / 2 - bounds.top;
          const destinationX = gate ? gateX : endX;
          const destinationY = gate ? gateY : centerY;
          const middle = (x + destinationX) / 2;
          const path = new Path2D();
          path.moveTo(x, y);
          path.bezierCurveTo(middle, y, middle, destinationY, destinationX, destinationY);
          const color = courseStatus(from, target, prerequisites) === 'planned' ? '#8296df' : '#a8b2cc';
          links.push({ group, path, color, dashed: group.count === null });
        }
      }
    }
    if (frame === undefined) frame = requestAnimationFrame(paint);
  }

  const observer = new ResizeObserver(measure);
  observer.observe(layout);
  updateHighlight();
  return () => {
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
}
