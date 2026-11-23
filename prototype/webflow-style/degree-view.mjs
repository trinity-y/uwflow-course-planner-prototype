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

function courseChoice(code, { getCourse, showCourse, favoriteStar }) {
  const { name } = getCourse(code);
  const item = element('div', 'degree-course-choice');
  const heading = element('div', 'course-with-star');
  const link = element('button', 'degree-course-link', code);
  link.type = 'button';
  link.setAttribute('aria-label', `Plan ${code}`);
  link.addEventListener('click', () => showCourse(code, link, true));
  heading.append(link, favoriteStar(code));
  item.append(heading, element('span', 'degree-choice-name', name));
  return item;
}

function eligibleCourses(rule, requirements, archive, actions) {
  const details = element('details', 'degree-rule-details degree-eligible');
  details.append(element('summary', '', 'Eligible courses'));
  details.addEventListener('toggle', () => {
    if (!details.open || details.childElementCount > 1) return;
    const sets = degreeCourseSets(requirements, archive, rule);
    const content = element('div', 'degree-eligible-content');
    const search = element('input', 'degree-eligible-search');
    search.type = 'search';
    search.placeholder = 'Filter by code or title';
    search.setAttribute('aria-label', `Search eligible courses for ${rule.title}`);
    const results = element('div', 'degree-eligible-groups');
    const sizes = sets.map(() => pageSize);

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
        if (title) section.append(element('h4', '', title));
        const list = element('ul', 'degree-eligible-list');
        for (const entry of matches.slice(0, sizes[index])) {
          const item = element('li', 'degree-eligible-option');
          for (const [position, code] of entry.entries()) {
            if (position) item.append(element('span', 'degree-eligible-pair', '+'));
            item.append(courseChoice(code, actions));
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
            results.querySelectorAll('.degree-eligible-group')[sections.indexOf(section)]
              ?.querySelectorAll('.degree-eligible-option')[firstNew]?.querySelector('button')?.focus();
          });
          section.append(more);
        }
        sections.push(section);
      }
      results.replaceChildren(...(sections.length ? sections : [element('p', 'quiet-message', 'No eligible courses match.')]));
    }

    if (sets.reduce((sum, set) => sum + set.options.length, 0) > pageSize) content.append(search);
    search.addEventListener('input', () => {
      sizes.fill(pageSize);
      render();
    });
    content.append(results);
    details.append(content);
    render();
  });
  return details;
}

function courseCodes(codes, label, favoriteStar) {
  const group = element('div', 'degree-course-codes');
  group.append(element('strong', '', label));
  for (const code of codes) {
    const item = element('span', 'course-with-star degree-code');
    item.append(element('span', '', code), favoriteStar(code));
    group.append(item);
  }
  return group;
}

function ruleRow(rule, requirements, archive, actions) {
  const row = element('li', 'degree-rule');
  const heading = element('div', 'degree-rule-heading');
  const title = element('h3', '', rule.title);
  const status = element('span', 'rule-status');
  heading.append(title, status);
  row.append(heading, element('p', 'degree-rule-description', rule.description));
  const bar = progress(`${rule.title} progress`);
  const amount = element('span', '');
  if (rule.target > 1) {
    const tracking = element('div', 'degree-rule-tracking');
    tracking.append(bar, amount);
    row.append(tracking);
  }
  const counts = element('p', 'degree-rule-counts');
  if (rule.counts) row.append(counts);

  const details = element('details', 'degree-rule-details');
  const counted = element('div', 'degree-counted');
  details.append(element('summary', '', 'Course details'), counted, sourceLink(requirements.sources[rule.source], 'View calendar requirement'));
  row.append(details, eligibleCourses(rule, requirements, archive, actions));

  let previousCourses;
  function update(next) {
    status.classList.toggle('met', next.met);
    status.textContent = next.met ? 'Met' : 'Incomplete';
    bar.max = next.target;
    bar.value = next.current;
    amount.textContent = `${next.current} / ${next.target}`;
    if (next.counts) counts.textContent = next.counts.map(({ label, count }) => `${label} · ${count}`).join('  /  ');
    const signature = JSON.stringify([next.matched, next.missing]);
    if (previousCourses === signature) return;
    previousCourses = signature;
    const contents = next.matched.length
      ? [courseCodes(next.matched, 'Counted', actions.favoriteStar)]
      : [element('p', '', 'No scheduled courses count toward this rule yet.')];
    if (next.missing?.length) contents.push(courseCodes(next.missing, 'Missing', actions.favoriteStar));
    counted.replaceChildren(...contents);
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
    state.textContent = next.met === next.total ? 'Passes the modeled requirements' : 'Degree requirements incomplete';
    percent.textContent = `${next.percent}%`;
    bar.max = next.total;
    bar.value = next.met;
    count.textContent = `${next.met} of ${next.total} rules met. The check uses the courses and terms in your plan.`;
    rows.forEach((row, index) => row.update(next.rules[index]));
  }
  update(report);
  return update;
}
