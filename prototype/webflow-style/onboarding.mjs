import { createTerms, firstPlanYear, lastPlanYear, preloadCore, termOrder } from './calendar.mjs';
import { element } from './graph.mjs';
import { maxTermTarget, outcomeLabels } from './model.mjs';
import { currentTermId, describeTerm, inferRange, inferSequence, levels, programName, readTranscript, sequenceTargets, startCalendar } from './transcript.mjs';

export function attachOnboarding(createCalendar) {
  const byId = (id) => document.getElementById(id);
  const dialog = byId('onboarding');
  const form = byId('setup-form');
  const file = byId('transcript-file');
  const start = byId('setup-start');
  const end = byId('setup-end');
  const current = byId('setup-current');
  const error = byId('setup-error');
  let records = [];
  let sequence;
  let targets;
  let range;
  let entryYear;
  let generation = 0;

  function step(review) {
    byId('setup-source').hidden = review;
    form.hidden = !review;
    for (const item of dialog.querySelectorAll('[data-step]')) {
      if (item.dataset.step === (review ? '2' : '1')) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    }
    error.textContent = '';
  }

  function renderTerms() {
    const rows = [];
    const terms = createTerms(range, { entryYear, levels: sequence });
    const recordedPlan = Object.fromEntries(records.map(({ id, courses }) => [id, courses.map(({ code }) => code)]));
    const preview = preloadCore(recordedPlan, terms);
    const previous = current.value;
    current.replaceChildren(...terms.map(({ id, level }) => new Option(describeTerm(id, level), id)));
    const today = currentTermId();
    const inferredCurrent = records.at(-1)?.id ?? (terms.some((term) => term.id === today) ? today : null);
    current.value = terms.some((term) => term.id === previous) ? previous
      : inferredCurrent ?? terms.find((term) => term.level)?.id ?? terms[0].id;
    for (const term of terms) {
      const row = element('tr');
      const title = element('th', '', term.label);
      title.scope = 'row';
      const record = records.find(({ id }) => id === term.id);
      if (record) {
        const detail = element('details');
        detail.append(element('summary', '', `${record.courses.length} recorded`));
        for (const { code, outcome } of record.courses) detail.append(element('div', '', `${code} · ${outcomeLabels[outcome]}`));
        title.append(detail);
      }
      const expected = preview[term.id].filter((code) => !recordedPlan[term.id]?.includes(code));
      if (expected.length) {
        const detail = element('details');
        detail.append(element('summary', '', `${expected.length} expected`), element('div', '', expected.join(', ')));
        title.append(detail);
      }
      const level = element('select');
      level.setAttribute('aria-label', `Study level for ${term.label}`);
      level.append(new Option(record?.work || term.work ? 'Co-op / open' : 'Open', ''), ...levels.map((value) => new Option(value, value)));
      level.value = term.level ?? '';
      level.onchange = () => {
        sequence[term.id] = level.value;
        const defaults = sequenceTargets(createTerms(range, { entryYear, levels: sequence }), records);
        targets[term.id] = defaults[term.id];
        renderTerms();
      };
      const target = element('input');
      target.type = 'number'; target.min = 0; target.max = maxTermTarget; target.required = true;
      target.setAttribute('aria-label', `Course target for ${term.label}`);
      target.value = targets[term.id];
      target.oninput = () => { targets[term.id] = target.valueAsNumber; };
      for (const input of [level, target]) {
        const cell = element('td');
        cell.append(input);
        row.append(cell);
      }
      row.prepend(title);
      rows.push(row);
    }
    byId('setup-terms').replaceChildren(...rows);
  }

  function updateRange(reset) {
    if (!start.reportValidity() || !end.reportValidity()) return false;
    const next = { start: start.valueAsNumber, end: end.valueAsNumber };
    if (next.start > next.end || records.some(({ id }) => Number(id.slice(0, 4)) < next.start || Number(id.slice(0, 4)) > next.end)) {
      error.textContent = 'Choose an ordered year range that includes all transcript terms.';
      return false;
    }
    if (!reset && next.start === range.start && next.end === range.end) return true;
    entryYear = next.start;
    const inferred = inferSequence(next, entryYear, records);
    const keep = !reset && next.start === range.start;
    sequence = keep ? { ...inferred, ...sequence } : inferred;
    range = next;
    const defaults = sequenceTargets(createTerms(range, { entryYear, levels: sequence }), records);
    targets = keep ? Object.fromEntries(Object.entries(defaults).map(([id, value]) => [id, targets[id] ?? value])) : defaults;
    error.textContent = '';
    renderTerms();
    return true;
  }

  function review(transcript) {
    records = transcript?.records ?? [];
    const inferred = inferRange(records);
    start.value = inferred.start;
    end.value = inferred.end;
    byId('setup-degree').textContent = transcript?.program ?? programName;
    byId('setup-name').value = records.length ? 'Transcript calendar' : 'SE calendar';
    byId('setup-record').textContent = records.length ? `Latest transcript term · ${describeTerm(records.at(-1).id, records.at(-1).level)}` : '';
    current.replaceChildren();
    step(true);
    updateRange(true);
    byId('setup-name').focus();
  }
  for (const field of [start, end]) {
    field.min = firstPlanYear; field.max = lastPlanYear;
    field.onchange = () => updateRange(false);
  }
  file.onchange = async () => {
    const picked = file.files[0];
    if (!picked) return;
    const token = ++generation;
    error.textContent = 'Reading transcript on this device…';
    try {
      const transcript = await readTranscript(picked);
      if (token === generation) review(transcript);
    } catch (reason) {
      if (token === generation) error.textContent = reason.name === 'Error' ? reason.message : 'Could not read this PDF. Choose a text-based, unlocked transcript.';
    } finally { file.value = ''; }
  };
  byId('setup-blank').onclick = () => { generation++; review(); };
  byId('setup-back').onclick = () => { step(false); file.focus(); };
  byId('setup-close').onclick = () => dialog.close();
  dialog.onclose = () => { generation++; file.value = ''; records = []; };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!updateRange(false)) return;
    const academic = Object.entries(sequence).filter(([id, level]) => level && Object.hasOwn(targets, id)
      && Number(id.slice(0, 4)) >= range.start && Number(id.slice(0, 4)) <= range.end).sort(([a], [b]) => termOrder(a) - termOrder(b));
    if (academic.some(([, level], i) => i && levels.indexOf(level) <= levels.indexOf(academic[i - 1][1]))) {
      error.textContent = 'Assign each study level once, in order from 1A to 4B.'; return;
    }
    const data = startCalendar({ range, entryYear, sequence: Object.fromEntries(academic), targets, records, currentTerm: current.value });
    createCalendar(byId('setup-name').value.trim() || 'SE calendar', data);
  };
  return () => { step(false); dialog.showModal(); };
}
