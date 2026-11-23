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

function directRequirements(groups, target, scheduled) {
  const section = element('div', 'direct-requirements');
  section.setAttribute('aria-label', 'Direct prerequisite groups');
  if (groups.length > 1) section.append(element('strong', '', `All ${groups.length} groups required`));
  const list = element('ul', 'direct-groups');
  for (const group of groups) {
    const { remaining } = groupProgress(group, target, scheduled);
    const item = element('li', `direct-group ${remaining ? 'unmet' : 'met'}`);
    const badge = element('strong', 'group-badge', groupLabel(group));
    const status = element('span', 'sr-only', remaining ? ', incomplete: ' : ', met: ');
    item.append(badge, status, element('span', '', group.options.join(' · ')));
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
  const deepest = Math.max(...depth.values());

  for (const [to, groups] of edges) {
    gates.set(to, groups.map((group) => {
      if (group.count === null || group.options.length < 2) return null;
      const label = groupLabel(group);
      const { remaining } = groupProgress(group, scheduled.get(to), scheduled);
      const gate = element('span', `graph-gate ${remaining ? 'unmet' : 'met'}`, label);
      gate.title = `${to}: ${label} from ${group.options.join(', ')}`;
      layout.append(gate);
      return gate;
    }));
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
      stack.append(node);
      cards.set(courseCode, node);
    }
    column.append(stack);
    layout.append(column);
  }

  scroll.append(layout);
  const direct = getCourse(code)?.groups ?? [];
  container.replaceChildren(...(direct.length ? [directRequirements(direct, target, scheduled)] : []), scroll);

  const draw = () => {
    const bounds = layout.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(bounds.width * scale);
    canvas.height = Math.ceil(bounds.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.lineWidth = 1.5;

    for (const [to, groups] of edges) {
      const end = cards.get(to).getBoundingClientRect();
      const endX = end.left - bounds.left;
      const centerY = end.top + end.height / 2 - bounds.top;
      for (const [index, group] of groups.entries()) {
        const gate = gates.get(to)[index];
        const gateX = endX - 38;
        const gateY = centerY + (index - (groups.length - 1) / 2) * 20;
        if (gate) {
          gate.style.transform = `translate(${gateX}px, ${gateY}px) translate(-50%, -50%)`;
          ctx.setLineDash([]);
          ctx.strokeStyle = '#8999c1';
          ctx.beginPath();
          ctx.moveTo(gateX, gateY);
          ctx.lineTo(endX, centerY);
          ctx.stroke();
        }
        for (const from of group.options) {
          if (depth.get(from) <= depth.get(to)) continue;
          const start = cards.get(from).getBoundingClientRect();
          const x = start.right - bounds.left;
          const y = start.top + start.height / 2 - bounds.top;
          const destinationX = gate ? gateX : endX;
          const destinationY = gate ? gateY : centerY;
          const middle = (x + destinationX) / 2;
          ctx.strokeStyle = courseStatus(from, target, scheduled) === 'planned' ? '#8296df' : '#a8b2cc';
          ctx.setLineDash(group.count === null ? [4, 4] : []);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.bezierCurveTo(middle, y, middle, destinationY, destinationX, destinationY);
          ctx.stroke();
        }
      }
    }
  };

  const observer = new ResizeObserver(draw);
  observer.observe(layout);
  return () => observer.disconnect();
}
