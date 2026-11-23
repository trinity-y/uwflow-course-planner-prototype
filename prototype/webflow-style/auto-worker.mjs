import { solveAuto } from './auto-plan.mjs';
import requirements from './degree-requirements.json' with { type: 'json' };
import archive from './calendar-courses.json' with { type: 'json' };

self.addEventListener('message', ({ data }) => {
  try {
    const result = solveAuto({ ...data, requirements, archive }, (value) => self.postMessage({ progress: value }));
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
});
