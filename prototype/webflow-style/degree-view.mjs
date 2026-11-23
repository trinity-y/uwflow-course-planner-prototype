import { element } from './graph.mjs';

function progress(value, target, label) {
  const bar = element('progress', 'degree-progress');
  bar.max = target;
  bar.value = value;
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

function ruleRow(rule, sources) {
  const row = element('li', 'degree-rule');
  const heading = element('div', 'degree-rule-heading');
  const title = element('h3', '', rule.title);
  const status = element('span', rule.met ? 'rule-status met' : 'rule-status', rule.met ? 'Met' : 'Incomplete');
  heading.append(title, status);
  row.append(heading, element('p', 'degree-rule-description', rule.description));

  if (rule.target > 1) {
    const tracking = element('div', 'degree-rule-tracking');
    tracking.append(
      progress(rule.current, rule.target, `${rule.title} progress`),
      element('span', '', `${rule.current} / ${rule.target}`),
    );
    row.append(tracking);
  }

  if (rule.counts) {
    row.append(element('p', 'degree-rule-counts', rule.counts.map(({ label, count }) => `${label} · ${count}`).join('  /  ')));
  }
  const details = element('details', 'degree-rule-details');
  details.append(element('summary', '', 'Course details'));
  if (rule.matched.length) details.append(element('p', '', `Counted: ${rule.matched.join(', ')}`));
  else details.append(element('p', '', 'No scheduled courses count toward this rule yet.'));
  if (rule.missing?.length) details.append(element('p', '', `Missing: ${rule.missing.join(', ')}`));
  details.append(sourceLink(sources[rule.source], 'View calendar requirement'));
  row.append(details);
  return row;
}

export function renderDegreeReport(container, report, requirements) {
  const overview = element('section', 'degree-overview');
  const summary = element('div', 'degree-overview-heading');
  summary.append(
    element('strong', '', report.met === report.total ? 'Passes the modeled requirements' : 'Degree requirements incomplete'),
    element('span', '', `${report.percent}%`),
  );
  overview.append(
    summary,
    progress(report.met, report.total, 'Degree rules met'),
    element('p', '', `${report.met} of ${report.total} rules met. The check uses the courses and terms in your plan.`),
  );

  const list = element('ul', 'degree-rule-list');
  list.append(...report.rules.map((rule) => ruleRow(rule, requirements.sources)));
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
}
