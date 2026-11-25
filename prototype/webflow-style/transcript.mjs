import { createTerms, defaultYearRange, preloadCore, termLabel, termOrder, terms as sampleTerms } from './calendar.mjs';
import requirements from './degree-requirements.json' with { type: 'json' };
import { isAcademicCourse } from './model.mjs';

export const levels = Object.keys(requirements.coreByLevel);
export const programName = 'Software Engineering, Honours';

// Read physical rows, since PDF text items need not be emitted in reading order.
export function pageLines(items) {
  const rows = [];
  const positioned = items.filter((item) => item.str?.trim())
    .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  for (const item of positioned) {
    const y = item.transform[5];
    if (!rows.length || rows.at(-1).y - y > 2) rows.push({ y, items: [] });
    rows.at(-1).items.push(item);
  }
  return rows.map((row) => row.items.sort((a, b) => a.transform[4] - b.transform[4])
    .map((item) => item.str.trim()).join(' ').replace(/\s+/g, ' '));
}

export async function readTranscript(file) {
  const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false, useSystemFonts: false });
  try {
    const pdf = await task.promise;
    const lines = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      lines.push(...pageLines((await page.getTextContent()).items));
    }
    return parseTranscript(lines);
  } finally {
    await task.destroy();
  }
}

export function parseTranscript(lines) {
  const terms = {};
  let term;
  let program;
  let table = false;
  for (const line of lines) {
    const heading = /^(Winter|Spring|Fall)\s+(\d{4})$/i.exec(line);
    if (heading) {
      const id = `${heading[2]}-${heading[1].toLowerCase()}`;
      term = terms[id] ??= { id, courses: [] };
      table = false;
      continue;
    }
    const degree = /^Program:\s*(.+)$/i.exec(line);
    if (degree) program = degree[1];
    if (!term) continue;
    const study = /Level:\s*([1-4][AB])\b.*?Form Of Study:\s*(.+)/i.exec(line);
    if (study) {
      term.work = /co-?op work/i.test(study[2]);
      term.level = study[1].toUpperCase();
    }
    if (/^Course\s+Description\b/i.test(line)) { table = true; continue; }
    if (/^(?:Term (?:GPA|Totals)|Academic Standing|Milestones|Scholarships|End of Undergraduate)/i.test(line)) table = false;
    const row = table && /^([A-Z]{2,12})\s*(\d{1,4}[A-Z]?)\s+(.+)$/.exec(line);
    if (!row) continue;
    const units = /\s+(\d+\.\d+)\s+(\d+\.\d+)(?:\s+([\dA-Z+-]+))?$/.exec(row[3]);
    const grade = units?.[3];
    const academic = isAcademicCourse(`${row[1]} ${row[2]}`);
    const passed = units && (Number(units[2]) > 0 || (grade === 'CR' && (!academic || Number(units[1]) === 0)));
    const outcome = passed ? 'passed' : grade && !['IP', 'INC', 'UR'].includes(grade) ? 'failed' : 'enrolled';
    term.courses.push({ code: `${row[1]} ${row[2]}`, name: row[3].slice(0, units?.index).trim(), outcome });
  }
  if (!/^(?:software engineering[, (]+honou?rs\b|honou?rs software engineering\b)/i.test(program ?? '')) {
    throw new Error(program ? `This transcript lists ${program}. The planner supports Honours Software Engineering.`
      : 'Could not find the program. Choose a Waterloo unofficial undergraduate transcript PDF.');
  }
  const records = Object.values(terms).filter((term) => term.courses.length).sort((a, b) => termOrder(a.id) - termOrder(b.id));
  if (!records.length) throw new Error('No course rows were found. Choose a text-based Waterloo transcript.');
  return { program, records };
}

export function inferRange(records, today = new Date()) {
  const byLevel = new Map(sampleTerms.filter((term) => term.level).map((term) => [term.level, term.year]));
  const academic = records.filter((term) => !term.work && byLevel.has(term.level));
  const first = academic[0];
  const last = academic.at(-1);
  const start = first ? Number(first.id.slice(0, 4)) - (byLevel.get(first.level) - defaultYearRange.start)
    : Number(records[0]?.id.slice(0, 4)) || today.getFullYear();
  const remainingYears = last ? defaultYearRange.end - byLevel.get(last.level) : 0;
  return {
    start: Math.min(start, Number(records[0]?.id.slice(0, 4)) || start),
    end: Math.max(start + defaultYearRange.end - defaultYearRange.start,
      last ? Number(last.id.slice(0, 4)) + remainingYears : start, Number(records.at(-1)?.id.slice(0, 4)) || start),
  };
}

export function inferSequence(range, entryYear, records = []) {
  const all = createTerms(range, { entryYear });
  const recorded = new Map(records.map((term) => [term.id, term]));
  const anchors = new Map(records.filter((term) => !term.work && levels.includes(term.level)).map((term) => [term.level, term.id]));
  const sequence = {};
  let last = -Infinity;
  for (const [index, level] of levels.entries()) {
    const anchor = anchors.get(level);
    const next = levels.slice(index + 1).map((key) => anchors.get(key)).find(Boolean);
    const available = all.filter(({ id }) => termOrder(id) > last && (!next || termOrder(id) < termOrder(next)) && !recorded.has(id));
    const nominal = all.find((term) => term.level === level);
    const id = anchor ?? (available.find((term) => termOrder(term.id) >= termOrder(nominal?.id)) ?? available.at(-1))?.id;
    if (id && all.some((term) => term.id === id)) {
      sequence[id] = level;
      last = termOrder(id);
    }
  }
  return sequence;
}

export function startCalendar({ range, entryYear, sequence, targets, records = [], currentTerm }) {
  const setup = { entryYear, levels: sequence, currentTerm, imported: records.length > 0 };
  const terms = createTerms(range, setup);
  const plan = Object.fromEntries(terms.map(({ id }) => [id, []]));
  const outcomes = {};
  const courses = [];
  const notes = {};
  const chosen = new Map();
  for (const term of records) {
    for (const course of term.courses) {
      const previous = chosen.get(course.code);
      // The board represents one placement per course. Preserve other attempts in their own term.
      if (previous) {
        const keepOld = previous.outcome === 'passed' && course.outcome !== 'passed';
        const other = keepOld ? { ...course, id: term.id } : previous;
        (notes[other.id] ??= []).push({ title: `${other.code} · ${other.outcome}`, body: 'Earlier or repeated transcript attempt.' });
        if (keepOld) continue;
      }
      chosen.set(course.code, { ...course, id: term.id });
    }
  }
  for (const { code, name, id, outcome } of chosen.values()) {
    plan[id].push(code);
    outcomes[code] = outcome;
    courses.push({ code, name });
  }
  const last = records.at(-1);
  if (last) {
    const transcriptLimit = termOrder(last.id) + Number(!last.courses.some((course) => course.outcome === 'enrolled'));
    setup.solveFrom = Math.max(transcriptLimit, termOrder(currentTerm) ?? transcriptLimit);
  }
  return {
    setup, yearRange: range, plan: preloadCore(plan, terms),
    targets, outcomes, courses, termDetails: { notes }, autoMode: false,
  };
}

export function sequenceTargets(terms, records) {
  const recorded = new Map(records.map((term) => [term.id, term]));
  return Object.fromEntries(terms.map(({ id, target }) => {
    const term = recorded.get(id);
    return [id, term ? Math.max(target, term.courses.filter(({ code }) => isAcademicCourse(code)).length) : target];
  }));
}

export function describeTerm(id, level) {
  return [termLabel(id), level].filter(Boolean).join(' · ');
}
