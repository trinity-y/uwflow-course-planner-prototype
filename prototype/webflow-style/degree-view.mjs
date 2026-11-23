import { degreeCourseSets } from './degree.mjs';
import { element } from './graph.mjs';

const pageSize = 10;

function progress(label) {
  const bar = element('progress', 'degree-progress');
  bar.setAttribute('aria-label', label);
  return bar;
}

function sourceLink(url, label) {
  const link = element('a', 'degree-source', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

function courseReference(code, actions, { counted = false, draggable = false } = {}) {
  const { findPlacement, locateCourse, showCourse, favoriteStar, makeDraggable } = actions;
  const placement = findPlacement(code);
  const displayCode = placement?.code ?? code;
  const item = element('span', 'course-with-star degree-code');
  item.classList.toggle('counted', counted);
  const link = element('button', 'degree-course-link', displayCode);
  link.type = 'button';
  link.setAttribute('aria-label', placement ? `Show ${displayCode} in the schedule` : `Plan ${code}`);
  link.title = placement?.term.label ?? actions.getCourse(code).name;
  if (draggable) makeDraggable?.(link, code);
  link.addEventListener('click', () => {
    if (findPlacement(code)) locateCourse(code);
    else showCourse(code, link, true);
  });
  item.append(link, favoriteStar(displayCode));
  return item;
}

function courseChoice(code, counted, actions, draggable) {
  const placement = actions.findPlacement(code);
  const { name } = actions.getCourse(placement?.code ?? code);
  const item = element('div', 'degree-course-choice');
  item.append(courseReference(code, actions, { counted: counted.has(placement?.code ?? code), draggable }),
    element('span', 'degree-choice-name', name));
  return item;
}

function coursePicker(requirements, archive, actions, remainingOnly) {
  const content = element('div', 'degree-eligible-content');
  const search = element('input', 'degree-eligible-search');
  search.type = 'search';
  search.placeholder = 'Filter by code or title';
  const results = element('div', 'degree-eligible-groups');
  content.append(search, results);
  let sets = [];
  let sizes = [];
  let signature;
  let previousPlan;
  let counted;

  function render() {
    const simplify = (value) => value.toLowerCase().replace(/\s/g, '');
    const query = simplify(search.value);
    const sections = [];
    for (const [index, { title, options }] of sets.entries()) {
      const matches = options.filter((entry) => !query || entry.some((code) =>
        simplify(code).includes(query) || simplify(actions.getCourse(code).name).includes(query),
      ));
      if (!matches.length) continue;
      const section = element('section', 'degree-eligible-group');
      section.dataset.setIndex = index;
      if (title) section.append(element('h4', '', title));
      const list = element('ul', 'degree-eligible-list');
      for (const entry of matches.slice(0, sizes[index])) {
        const item = element('li', 'degree-eligible-option');
        for (const [position, code] of entry.entries()) {
          if (position) item.append(element('span', 'degree-eligible-pair', '+'));
          item.append(courseChoice(code, counted, actions, remainingOnly));
        }
        list.append(item);
      }
      section.append(list);
      if (matches.length > sizes[index]) {
        const more = element('button', 'button degree-more', `Show more (${sizes[index]} of ${matches.length})`);
        more.type = 'button';
        more.addEventListener('click', () => {
          const firstNew = sizes[index];
          sizes[index] += pageSize;
          render();
          results.querySelector(`[data-set-index="${index}"]`)
            ?.querySelectorAll('.degree-eligible-option')[firstNew]?.querySelector('button')?.focus();
        });
        section.append(more);
      }
      sections.push(section);
    }
    const message = sets.length ? 'No eligible courses match.' : 'See the full degree report for eligible courses.';
    results.replaceChildren(...(sections.length ? sections : [element('p', 'quiet-message', message)]));
  }

  search.addEventListener('input', () => {
    sizes.fill(pageSize);
    render();
  });

  function update(rule, countedElsewhere) {
    const nextSignature = JSON.stringify([rule.id, rule.matched, remainingOnly ? rule.missing : null, countedElsewhere]);
    const plan = actions.getPlan();
    if (signature === nextSignature && previousPlan === plan) return;
    signature = nextSignature;
    previousPlan = plan;
    counted = new Set(rule.matched);
    sets = degreeCourseSets(requirements, archive, rule, { remainingOnly, countedElsewhere });
    sizes = sets.map((_, index) => sizes[index] ?? pageSize);
    search.setAttribute('aria-label', `Search eligible courses for ${rule.title}`);
    search.hidden = sets.reduce((sum, set) => sum + set.options.length, 0) <= pageSize && !search.value;
    render();
  }

  return { content, update };
}

function eligibleCourses(rule, requirements, archive, actions) {
  const details = element('details', 'degree-rule-details degree-eligible');
  details.append(element('summary', '', 'Eligible courses'));
  let current = rule;
  let picker;
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    if (!picker) {
      picker = coursePicker(requirements, archive, actions, false);
      details.append(picker.content);
    }
    picker.update(current);
  });
  return {
    details,
    update(next) {
      current = next;
      if (details.open) picker?.update(next);
    },
  };
}

export function renderDegreeSidebar(container, requirements, archive, actions) {
  const cards = new Map();
  for (const { id, title, description } of requirements.rules) {
    const details = element('details', 'sidebar-degree-rule');
    const summary = element('summary', 'sidebar-degree-summary');
    const progress = element('span', 'sidebar-degree-progress');
    summary.append(element('span', '', title), progress);
    details.append(summary);
    let picker;
    let current;
    let countedElsewhere;
    details.addEventListener('toggle', () => {
      if (!details.open || !current) return;
      if (!picker) {
        picker = coursePicker(requirements, archive, actions, true);
        const body = element('div', 'sidebar-degree-body');
        body.append(element('p', 'degree-rule-description', description), picker.content);
        details.append(body);
      }
      picker.update(current, countedElsewhere);
    });
    cards.set(id, {
      details,
      update(rule, counted) {
        current = rule;
        countedElsewhere = counted;
        progress.textContent = `${rule.current}/${rule.target}`;
        details.hidden = rule.met || rule.disabled;
        if (!details.hidden && details.open) picker?.update(rule, counted);
      },
    });
  }

  container.replaceChildren(...[...cards.values()].map(({ details }) => details));
  return (report) => {
    const counted = [...new Set(report.rules.flatMap(({ matched }) => matched))];
    for (const rule of report.rules) cards.get(rule.id).update(rule, counted);
  };
}

function courseCodes(codes, label, actions, counted = false) {
  const group = element('div', 'degree-course-codes');
  group.append(element('strong', '', label));
  for (const code of new Set(codes)) group.append(courseReference(code, actions, { counted }));
  return group;
}

function updateCourseGroups(container, rule, actions) {
  const missing = rule.missing ?? [];
  const codes = [...rule.matched, ...rule.additional, ...missing];
  const locations = codes.map((code) => {
    const placement = actions.findPlacement(code);
    return placement && [placement.code, placement.term.id];
  });
  const signature = JSON.stringify([rule.matched, rule.additional, missing, locations]);
  if (container.dataset.courses === signature) return;
  container.dataset.courses = signature;
  const contents = [];
  if (rule.matched.length) contents.push(courseCodes(rule.matched, 'Counted', actions, true));
  if (rule.additional.length) contents.push(courseCodes(rule.additional, 'Additional eligible', actions));
  if (missing.length) contents.push(courseCodes(missing, 'Missing', actions));
  if (!contents.length) contents.push(element('p', '', 'No eligible courses are scheduled for this rule.'));
  container.replaceChildren(...contents);
}

export function renderCourseContributions(container, rules, { usedBy, listedFor }, actions) {
  const contents = [];
  if (rules.length) {
    const list = element('ul', 'contribution-list');
    for (const { id, title, status } of rules) {
      const item = element('li', 'contribution-rule');
      const link = element('button', 'degree-course-link', title);
      link.type = 'button';
      link.addEventListener('click', () => actions.showDegreeRule(id));
      item.append(link, element('span', `rule-status${status === 'Counted' ? ' met' : ' neutral'}`, status));
      list.append(item);
    }
    contents.push(list);
  } else {
    contents.push(element('p', 'quiet-message', 'No modeled degree rules list this course.'));
  }
  if (usedBy.length) contents.push(courseCodes(usedBy, 'Prerequisite for', actions, true));
  if (listedFor.length) contents.push(courseCodes(listedFor, 'Prerequisite option for', actions));
  container.replaceChildren(...contents);
}

function ruleRow(rule, requirements, archive, actions) {
  const row = element('li', 'degree-rule');
  row.dataset.degreeRule = rule.id;
  const heading = element('div', 'degree-rule-heading');
  const title = element('h3', '', rule.title);
  title.tabIndex = -1;
  const status = element('span', 'rule-status');
  const controls = element('div', 'degree-rule-controls');
  const toggle = element('input', 'degree-rule-toggle');
  toggle.type = 'checkbox';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', `Use rule ${rule.title}`);
  toggle.addEventListener('change', () => actions.setRuleEnabled(rule.id, toggle.checked));
  controls.append(status, toggle);
  heading.append(title, controls);
  row.append(heading, element('p', 'degree-rule-description', rule.description));
  const bar = progress(`${rule.title} progress`);
  const amount = element('span', '');
  const tracking = element('div', 'degree-rule-tracking');
  tracking.append(bar, amount);
  const counts = element('p', 'degree-rule-counts');
  row.append(tracking, counts);

  const details = element('details', 'degree-rule-details');
  details.open = true;
  const counted = element('div', 'degree-counted');
  details.append(element('summary', '', 'Course details'), counted);
  if (rule.source) details.append(sourceLink(requirements.sources[rule.source], 'View calendar requirement'));
  const eligible = eligibleCourses(rule, requirements, archive, actions);
  row.append(details, eligible.details);

  function update(next) {
    toggle.checked = !next.disabled;
    status.classList.toggle('met', next.met);
    status.classList.toggle('neutral', next.disabled);
    status.textContent = next.disabled ? 'Off' : next.met ? 'Met' : 'Incomplete';
    details.hidden = eligible.details.hidden = Boolean(next.disabled);
    tracking.hidden = Boolean(next.disabled) || next.target <= 1;
    counts.hidden = !next.counts;
    if (next.disabled) return;
    bar.max = next.target;
    bar.value = next.current;
    amount.textContent = `${next.current} / ${next.target}${next.available > next.target ? ` · ${next.available} eligible` : ''}`;
    if (next.counts) counts.textContent = next.counts.map(({ label, count }) => `${label} · ${count}`).join('  /  ');
    updateCourseGroups(counted, next, actions);
    eligible.update(next);
  }

  return { row, update };
}

export function renderDegreeReport(container, report, requirements, archive, actions) {
  const overview = element('section', 'degree-overview');
  const summary = element('div', 'degree-overview-heading');
  const state = element('strong', '');
  const percent = element('span', '');
  const bar = progress('Degree rules met');
  const count = element('p', '');
  summary.append(state, percent);
  overview.append(summary, bar, count);

  const list = element('ul', 'degree-rule-list');
  const rows = report.rules.map((rule) => ruleRow(rule, requirements, archive, actions));
  list.append(...rows.map(({ row }) => row));
  const manual = element('section', 'degree-manual');
  manual.append(
    element('h3', '', 'Confirm separately'),
    element('p', '', 'These checks use grades, evaluations, or approvals and are outside the plan percentage.'),
  );
  const reviewList = element('ul', '');
  for (const rule of requirements.manualReview) {
    const item = element('li', '');
    item.append(
      element('p', '', rule.description),
      sourceLink(requirements.sources[rule.source], rule.title),
    );
    reviewList.append(item);
  }
  manual.append(reviewList);
  container.replaceChildren(overview, list, manual);

  function update(next) {
    state.textContent = !next.total ? 'No active rules' : next.met === next.total ? 'Passes the modeled requirements' : 'Degree requirements incomplete';
    percent.hidden = bar.hidden = count.hidden = !next.total;
    percent.textContent = `${next.percent}%`;
    bar.max = next.total || 1;
    bar.value = next.met;
    count.textContent = `${next.met} of ${next.total} enabled rules met.`;
    rows.forEach((row, index) => row.update(next.rules[index]));
  }
  update(report);
  return update;
}
