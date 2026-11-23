import { terms } from './calendar.mjs';
import { buildGraph, courseStatus, groupLabel, groupProgress } from './model.mjs';

export function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

const termLabels = new Map(terms.map(({ id, label }) => [id, label]));

export function termOptions(emptyLabel, required = false) {
  const empty = new Option(emptyLabel, '');
  empty.disabled = required;
  return [empty, ...terms.filter((term) => !term.beforeEntry).map((term) => new Option(term.label, term.id))];
}

function isChoice(group) {
  return group.count !== null && group.options.length > 1;
}

function directRequirements(groups, target, scheduled, bindGroup) {
  const section = element('div', 'direct-requirements');
  section.setAttribute('aria-label', 'Direct prerequisite groups');
  if (groups.length > 1) section.append(element('strong', '', `All ${groups.length} groups required`));
  const list = element('ul', 'direct-groups');
  for (const group of groups) {
    const { remaining } = groupProgress(group, target, scheduled);
    const item = element('li', `direct-group ${remaining ? 'unmet' : 'met'}`);
    const badge = element('strong', 'group-badge', groupLabel(group));
    const status = element('span', 'sr-only', remaining ? ', incomplete: ' : ', met: ');
    item.append(badge, status);
    if (isChoice(group)) {
      const options = element('span', 'direct-options');
      for (const code of group.options) {
        const option = element('button', 'direct-option', code);
        option.type = 'button';
        option.dataset.option = code;
        option.setAttribute('aria-label', `Show ${code} in the prerequisite graph`);
        options.append(option);
      }
      item.append(options);
    } else {
      item.append(element('span', '', group.options[0]));
    }
    bindGroup(item, group);
    list.append(item);
  }
  section.append(list);
  return section;
}

export function renderGraph(container, code, getCourse, scheduled, onPlacementChange) {
  const { depth, edges } = buildGraph(code, getCourse);
  if (depth.size === 1) {
    container.replaceChildren();
    return () => {};
  }

  const target = scheduled.get(code);
  const scroll = element('div', 'graph-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Prerequisite courses, earliest steps first');
  const canvas = element('canvas', 'graph-lines');
  canvas.setAttribute('aria-hidden', 'true');
  const layout = element('div', 'graph-layout');
  layout.append(canvas);
  const cards = new Map();
  const gates = new Map();
  const summaries = new Map();
  const choiceTargets = new Map();
  const choicesByCourse = new Map();
  const deepest = Math.max(...depth.values());
  let pointerSelection;
  let focusSelection;
  let currentSelection;
  let highlightedGroups = new Set();
  let links = [];
  let frame;

  function updateHighlight() {
    const selection = pointerSelection ?? focusSelection;
    if (selection === currentSelection) return;
    currentSelection = selection;
    highlightedGroups = new Set(selection?.groups);
    const involved = new Set();
    for (const group of highlightedGroups) {
      involved.add(choiceTargets.get(group));
      group.options.forEach((option) => involved.add(option));
    }
    for (const [course, card] of cards) {
      card.classList.toggle('graph-muted', Boolean(selection) && !involved.has(course));
      card.classList.toggle('graph-emphasis', course === selection?.course);
    }
    for (const [group, item] of [...gates, ...summaries]) {
      item.classList.toggle('graph-muted', Boolean(selection) && !highlightedGroups.has(group));
    }
    if (frame === undefined) frame = requestAnimationFrame(paint);
  }

  function bindHighlight(node, groups, course, includeFocus = true) {
    const selection = { groups, course };
    node.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      pointerSelection = selection;
      updateHighlight();
    });
    node.addEventListener('pointerleave', () => {
      if (pointerSelection !== selection) return;
      pointerSelection = undefined;
      updateHighlight();
    });
    if (!includeFocus) return;
    node.addEventListener('focusin', () => {
      focusSelection = selection;
      updateHighlight();
    });
    node.addEventListener('focusout', (event) => {
      if (focusSelection !== selection || node.contains(event.relatedTarget)) return;
      focusSelection = undefined;
      updateHighlight();
    });
  }

  for (const [to, groups] of edges) {
    for (const group of groups) {
      if (!isChoice(group)) continue;
      choiceTargets.set(group, to);
      for (const option of group.options) {
        if (!choicesByCourse.has(option)) choicesByCourse.set(option, []);
        choicesByCourse.get(option).push(group);
      }
      const label = groupLabel(group);
      const { remaining } = groupProgress(group, scheduled.get(to), scheduled);
      const gate = element('span', `graph-gate ${remaining ? 'unmet' : 'met'}`, label);
      gate.title = `${to}: ${label} from ${group.options.join(', ')}`;
      bindHighlight(gate, [group], undefined, false);
      layout.append(gate);
      gates.set(group, gate);
    }
  }

  for (let level = deepest; level >= 0; level -= 1) {
    const column = element('section', 'graph-column');
    const label = level === 0 ? 'Selected course' : level === 1 ? 'Direct prerequisites' : 'Earlier steps';
    if (level < 2) column.classList.add('graph-direct');
    column.append(element('h4', '', label));
    const stack = element('div', 'graph-stack');
    for (const [courseCode, courseDepth] of depth) {
      if (courseDepth !== level) continue;
      const status = level === 0 ? 'goal' : courseStatus(courseCode, target, scheduled);
      const node = element('div', `graph-node ${status}`);
      const term = termLabels.get(scheduled.get(courseCode));
      const name = getCourse(courseCode)?.name;
      const courseName = element('span', 'graph-course-name', name);
      if (name) courseName.title = name;
      const select = element('select', 'graph-term');
      select.dataset.graphTerm = courseCode;
      select.setAttribute('aria-label', `Term for ${courseCode}`);
      select.replaceChildren(...termOptions('Unscheduled'));
      select.value = scheduled.get(courseCode) ?? '';
      select.addEventListener('change', () => onPlacementChange(courseCode, select.value));
      const heading = element('div', 'graph-node-heading');
      heading.append(element('strong', '', courseCode));
      const groupCount = getCourse(courseCode)?.groups?.length;
      if (groupCount > 1) {
        const label = element('span', 'graph-all', `All ${groupCount}`);
        label.title = `All ${groupCount} prerequisite groups required`;
        heading.append(label);
      }
      node.append(heading, courseName, select);
      if (status === 'late') node.append(element('span', 'graph-node-caption', `${term} is too late`));
      const choices = choicesByCourse.get(courseCode);
      if (choices) bindHighlight(node, choices, courseCode);
      stack.append(node);
      cards.set(courseCode, node);
    }
    column.append(stack);
    layout.append(column);
  }

  scroll.append(layout);
  const direct = getCourse(code)?.groups ? edges.get(code) : [];
  const summary = direct.length ? directRequirements(direct, target, scheduled, (item, group) => {
    summaries.set(group, item);
    if (isChoice(group)) bindHighlight(item.querySelector('.group-badge'), [group], undefined, false);
    for (const option of item.querySelectorAll('button[data-option]')) {
      const course = option.dataset.option;
      bindHighlight(option, [group], course);
      option.addEventListener('click', () => cards.get(course).scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    }
  }) : null;
  container.replaceChildren(...(summary ? [summary, scroll] : [scroll]));

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
      if (!currentSelection) stroke(link);
      else if (!highlightedGroups.has(link.group)) stroke(link, .28, 1.5, '#a1a9b8');
    }
    for (const link of links) {
      if (highlightedGroups.has(link.group)) stroke(link, 1, 2, '#526ccf');
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
      const end = cards.get(to).getBoundingClientRect();
      const endX = end.left - bounds.left;
      const centerY = end.top + end.height / 2 - bounds.top;
      for (const [index, group] of groups.entries()) {
        const gate = gates.get(group);
        const gateX = endX - 38;
        const gateY = centerY + (index - (groups.length - 1) / 2) * 20;
        if (gate) {
          gate.style.transform = `translate(${gateX}px, ${gateY}px) translate(-50%, -50%)`;
          const path = new Path2D();
          path.moveTo(gateX, gateY);
          path.lineTo(endX, centerY);
          links.push({ group, path, color: '#8999c1' });
        }
        for (const from of group.options) {
          if (depth.get(from) <= depth.get(to)) continue;
          const start = cards.get(from).getBoundingClientRect();
          const x = start.right - bounds.left;
          const y = start.top + start.height / 2 - bounds.top;
          const destinationX = gate ? gateX : endX;
          const destinationY = gate ? gateY : centerY;
          const middle = (x + destinationX) / 2;
          const path = new Path2D();
          path.moveTo(x, y);
          path.bezierCurveTo(middle, y, middle, destinationY, destinationX, destinationY);
          const color = courseStatus(from, target, scheduled) === 'planned' ? '#8296df' : '#a8b2cc';
          links.push({ group, path, color, dashed: group.count === null });
        }
      }
    }
    if (frame === undefined) frame = requestAnimationFrame(paint);
  }

  const observer = new ResizeObserver(measure);
  observer.observe(layout);
  return () => {
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
}
