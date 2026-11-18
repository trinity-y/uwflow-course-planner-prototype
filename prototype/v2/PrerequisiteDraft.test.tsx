import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { courses, initialPlan, sequences } from './plannerData';
import PrerequisitePathPlanner from './PrerequisitePathPlanner';

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('does not fill an empty destination with unschedulable prerequisite drafts', () => {
  const course = courses.find((item) => item.code === 'SE 350');
  if (!course) throw new Error('Missing SE 350');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onApply = jest.fn();
  const onAddAnyway = jest.fn();
  const render = (target: string) =>
    act(() =>
      root.render(
        <PrerequisitePathPlanner
          course={course}
          target={target}
          plan={initialPlan}
          terms={sequences['Stream 8X']}
          onApply={onApply}
          onAddAnyway={onAddAnyway}
        />,
      ),
    );
  const choose = (label: string) => {
    const control = container.querySelector<HTMLInputElement>(
      `[aria-label="${label}"]`,
    );
    if (!control) throw new Error(`Missing ${label}`);
    act(() => control.click());
  };
  const button = (label: string) => {
    const found = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === label,
    );
    if (!found) throw new Error(`Missing ${label}`);
    return found;
  };
  try {
    render('2A');
    choose('Choose CS 240 for SE 350');
    choose('Choose CS 247 for SE 350');
    choose('Choose CS 241 for CS 240');
    choose('Choose CS 241 for CS 247');
    const selectors = Array.from(
      container.querySelectorAll<HTMLSelectElement>('select[id^="placement-"]'),
    );
    expect(selectors).toHaveLength(6);
    expect(selectors.map((selector) => selector.value)).toEqual([
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    expect(
      Array.from(container.querySelectorAll('p'))
        .map((node) => node.textContent)
        .join(' '),
    ).not.toContain('This term is full.');
    expect(container.textContent).toContain(
      'Choose a term for each missing prerequisite.',
    );
    expect(button('Add course anyway').disabled).toBe(false);
    expect(button('Add prerequisites and course').disabled).toBe(true);
    expect(
      Object.values(initialPlan).filter((term) => term === '2A'),
    ).toHaveLength(0);
    act(() => button('Add course anyway').click());
    expect(onAddAnyway).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    render('3A');
    expect(button('Add prerequisites and course').disabled).toBe(false);
    act(() => button('Add prerequisites and course').click());
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        'SE 350': '3A',
        'CS 240': '2B',
        'CS 247': '2B',
      }),
    );
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
