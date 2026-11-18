import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import CourseGraph from './CourseGraph';
import { courses } from './plannerData';
import { remainingPaletteSeeds } from './remainingPaletteSeeds';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('updates remaining paths when a requirement is planned and restores it on removal', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const catalog = courses.map((course) => ({
    ...course,
    required: course.code === 'CS 247',
  }));
  const render = (plan: Record<string, string>) =>
    act(() =>
      root.render(
        <CourseGraph
          seeds={remainingPaletteSeeds(catalog, plan)}
          plan={plan}
          onChoose={() => undefined}
        />,
      ),
    );
  const visible = (code: string) =>
    Boolean(container.querySelector(`button[aria-label^="${code}:"]`));
  try {
    render({ 'CS 135': '1A' });
    expect(visible('CS 247')).toBe(true);
    expect(visible('CS 135')).toBe(false);
    expect(visible('CS 350')).toBe(false);
    expect(container.querySelector('[aria-expanded]')).toBeNull();
    render({ 'CS 135': '1A', 'CS 247': '2B' });
    expect(visible('CS 247')).toBe(false);
    expect(visible('CS 135')).toBe(false);
    render({ 'CS 135': '1A' });
    expect(visible('CS 247')).toBe(true);
    expect(visible('CS 135')).toBe(false);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
