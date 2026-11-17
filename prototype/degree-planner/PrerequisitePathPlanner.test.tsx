import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { courses, initialPlan, sequences } from './plannerData';
import PrerequisitePathPlanner from './PrerequisitePathPlanner';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('preselects planned alternatives, edits selected prerequisite terms, and applies only the chosen branch', () => {
  const course = courses.find((item) => item.code === 'CS 350');
  if (!course) throw new Error('Missing course fixture');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onApply = jest.fn();
  const onAddAnyway = jest.fn();
  const button = (text: string) => {
    const found = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent?.includes(text),
    );
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  };
  try {
    act(() =>
      root.render(
        <PrerequisitePathPlanner
          course={course}
          target="2B"
          plan={initialPlan}
          terms={sequences['Stream 8']}
          onApply={onApply}
          onAddAnyway={onAddAnyway}
        />,
      ),
    );
    const plannedChoice = container.querySelector<HTMLInputElement>(
      '[aria-label="Choose CS 246 for CS 350"]',
    );
    expect(plannedChoice?.checked).toBe(true);
    expect(
      container.querySelector('[aria-label="CS 135 prerequisite node"]'),
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="CS 136 prerequisite node"]'),
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="CS 246 prerequisite node"]'),
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="CS 251 prerequisite node"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain('Path 1');
    const alternative = container.querySelector<HTMLInputElement>(
      '[aria-label="Choose CS 240 for CS 350"]',
    );
    if (!alternative) throw new Error('Missing alternative');
    act(() => alternative.click());
    expect(alternative.checked).toBe(true);
    const selector = document.getElementById('placement-CS 240');
    if (!(selector instanceof HTMLSelectElement))
      throw new Error('Missing term selector');
    expect(selector.value).toBe('2A');
    act(() => {
      selector.value = '3A';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain(
      'CS 240 needs an earlier term than CS 350.',
    );
    expect(onApply).not.toHaveBeenCalled();
    expect(initialPlan['CS 240']).toBeUndefined();
    act(() => button('Add prerequisites and course').click());
    expect(onApply).toHaveBeenCalledWith({
      ...initialPlan,
      'CS 240': '3A',
      'CS 251': '2A',
      'CS 350': '2B',
    });
    act(() => plannedChoice?.click());
    expect(document.getElementById('placement-CS 240')).toBeNull();
    act(() => button('Add prerequisites and course').click());
    expect(onApply).toHaveBeenLastCalledWith({
      ...initialPlan,
      'CS 251': '2A',
      'CS 350': '2B',
    });
    act(() => button('Add course anyway').click());
    expect(onAddAnyway).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
