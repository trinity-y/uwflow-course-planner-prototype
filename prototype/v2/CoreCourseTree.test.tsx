import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { findAcademicCalendar } from './academicCalendars';
import CoreCourseTree from './CoreCourseTree';
import { createCorePlan, Plan } from './plannerData';
import { remainingPaletteSeeds } from './remainingPaletteSeeds';

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('names alternatives by requirement and hides them once any option is planned', () => {
  const calendar = findAcademicCalendar('2025-2026');
  const choices = calendar.requirements.choiceRequirements;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onAdd = jest.fn();
  const render = (plan: Plan) =>
    act(() =>
      root.render(
        <CoreCourseTree
          choices={choices}
          seeds={remainingPaletteSeeds(calendar.courses, plan, choices).filter(
            (course) => course.group === 'Core courses',
          )}
          catalog={calendar.courses}
          plan={plan}
          onChoose={() => undefined}
          onAdd={onAdd}
        />,
      ),
    );
  const mechanics = () =>
    Array.from(container.querySelectorAll('fieldset')).find(
      (group) =>
        group.querySelector('legend')?.textContent === 'Mechanics · Choose one',
    );
  const plan = createCorePlan(calendar.courses);
  try {
    render(plan);
    expect(mechanics()).toBeDefined();
    expect(mechanics()?.textContent).toContain('2A recommended');
    for (const code of ['ECE 105', 'PHYS 115', 'PHYS 121']) {
      expect(
        mechanics()?.querySelector(`[aria-label="Add ${code} to plan"]`),
      ).not.toBeNull();
    }
    const add = mechanics()?.querySelector<HTMLButtonElement>(
      '[aria-label="Add ECE 105 to plan"]',
    );
    act(() => add?.click());
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ECE 105' }),
    );
    render({ ...plan, 'PHYS 115': '2A' });
    expect(mechanics()).toBeUndefined();
    expect(container.textContent).not.toContain('ECE 105');
    expect(container.querySelector('legend')?.textContent).toContain(
      'Choose one',
    );
    render(plan);
    expect(mechanics()).toBeDefined();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

test('renders named choices without requiring a term', () => {
  const calendar = findAcademicCalendar('2025-2026');
  const course = calendar.courses.find((item) => item.code === 'ECE 105');
  if (!course) throw new Error('Missing course');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    act(() =>
      root.render(
        <CoreCourseTree
          choices={[
            {
              id: 'science',
              label: 'Science foundation',
              count: 1,
              courses: [course.code],
            },
          ]}
          seeds={[course]}
          catalog={calendar.courses}
          plan={{}}
          onChoose={() => undefined}
        />,
      ),
    );
    expect(container.querySelector('legend')?.textContent).toBe(
      'Science foundation · Choose one',
    );
    expect(container.textContent).not.toContain('recommended');
    expect(container.textContent).toContain('Classical Mechanics');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
