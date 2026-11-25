import { opinions, solveAuto } from './auto-plan.mjs';
import { element } from './graph.mjs';

export function readOpinions(raw) {
  return Object.fromEntries(Object.entries(raw ?? {}).filter(([code, value]) =>
    /^[A-Z]+ \d{1,4}[A-Z]*$/.test(code) && value !== 'neutral' && Object.hasOwn(opinions, value),
  ));
}

export function opinionPicker(code, current, onChange) {
  const group = element('div', 'opinion-options');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', `Opinion for ${code}`);
  for (const [value, { symbol, label }] of Object.entries(opinions)) {
    const button = element('button', `opinion-button opinion-${value}`, symbol);
    button.type = 'button';
    button.dataset.opinion = value;
    button.dataset.opinionCode = code;
    button.title = label;
    button.setAttribute('aria-label', `${label} ${code}`);
    button.setAttribute('aria-pressed', String((current ?? 'neutral') === value));
    button.addEventListener('click', () => onChange(code, value));
    group.append(button);
  }
  return group;
}

export function createAutoRunner(requirements, archive) {
  let worker;
  let pending;
  let generation = 0;

  function cancel() {
    generation += 1;
    clearTimeout(pending);
    worker?.terminate();
    worker = undefined;
  }

  function run(data, onProgress, onResult, onError) {
    cancel();
    const next = generation;
    const finish = (result) => {
      if (next !== generation) return;
      worker?.terminate();
      worker = undefined;
      onResult(result);
    };
    function fallback() {
      worker?.terminate();
      worker = undefined;
      pending = setTimeout(() => {
        if (next !== generation) return;
        try {
          finish(solveAuto({ ...data, requirements, archive }, onProgress));
        } catch {
          onError();
        }
      }, 0);
    }
    pending = setTimeout(() => {
      try {
        worker = new Worker(new URL('./auto-worker.mjs', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data: message }) => {
          if (next !== generation) return;
          if (message.result) finish(message.result);
          else if (message.error) fallback();
          else onProgress(message.progress);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          if (next === generation) fallback();
        };
        worker.postMessage(data);
      } catch {
        fallback();
      }
    }, 65);
  }

  return { run, cancel };
}

export function renderOpinions(container, { codes, preferences, getCourse, openCourse, setOpinion }) {
  const fragment = document.createDocumentFragment();
  for (const code of codes) {
    const row = element('div', 'opinion-course');
    const intro = element('div', 'opinion-course-label');
    const title = element('button', 'degree-course-link', code);
    title.type = 'button';
    title.setAttribute('aria-label', `View ${code} course details`);
    title.addEventListener('click', () => openCourse(code, title));
    intro.append(title, element('span', '', getCourse(code).name));
    row.append(intro, opinionPicker(code, preferences[code], setOpinion));
    fragment.append(row);
  }
  container.replaceChildren(fragment);
}
