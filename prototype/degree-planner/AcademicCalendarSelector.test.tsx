import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from 'react-modal';
import { MemoryRouter } from 'react-router-dom';

import DegreePlannerPage from './DegreePlannerPage';

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('calendar changes persist, update enhancement requirements and keep course placements', () => {
  localStorage.removeItem('uwflow-degree-planner-calendar-v1');
  localStorage.setItem('uwflow-degree-planner-enhancements-v1', '["business"]');
  const container = document.createElement('div');
  document.body.appendChild(container);
  Modal.setAppElement(container);
  const root = createRoot(container);
  const click = (label: string) => {
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button'),
    ).find(
      (item) =>
        item.getAttribute('aria-label') === label ||
        item.textContent?.trim() === label,
    );
    if (!button) throw new Error(`Missing ${label}`);
    act(() => button.click());
  };
  const calendar = () => {
    const element =
      container.querySelector<HTMLSelectElement>('#academic-calendar');
    if (!element) throw new Error('Missing calendar selector');
    return element;
  };
  const choose = (value: string) =>
    act(() => {
      const input = calendar();
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  try {
    act(() =>
      root.render(
        <MemoryRouter>
          <DegreePlannerPage />
        </MemoryRouter>,
      ),
    );
    expect(calendar().value).toBe('2025-2026');
    expect(container.textContent).toContain('0/7 planned');
    click('Add CS 241 to plan');
    click('Add to 2A');
    expect(
      container.querySelector('[aria-label="Remove CS 241"]'),
    ).not.toBeNull();
    const sequence = container.querySelector<HTMLSelectElement>('#sequence');
    if (!sequence) throw new Error('Missing sequence');
    act(() => {
      sequence.value = 'Stream 8Y';
      sequence.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const original4A = container.querySelector(
      '[aria-label="Jump to 4A"]',
    )?.textContent;
    choose('2024-2025');
    expect(container.textContent).toContain('0/8 planned');
    expect(
      container.querySelector('[aria-label="Jump to 4A"]')?.textContent,
    ).toBe(original4A);
    expect(container.querySelector<HTMLSelectElement>('#sequence')?.value).toBe(
      'Stream 8Y',
    );
    expect(container.querySelector('#sequence')?.textContent).toContain(
      'existing schedule',
    );
    expect(
      container.querySelector('[aria-label="Remove CS 241"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain(
      'Scheduled courses and term dates are kept.',
    );
    expect(localStorage.getItem('uwflow-degree-planner-calendar-v1')).toBe(
      '2024-2025',
    );
    choose('2026-2027');
    expect(container.textContent).toContain('0/7 planned');
    expect(
      container.querySelector('[aria-label="Remove CS 241"]'),
    ).not.toBeNull();
    expect(localStorage.getItem('uwflow-degree-planner-calendar-v1')).toBe(
      '2026-2027',
    );
  } finally {
    act(() => root.unmount());
    container.remove();
    localStorage.removeItem('uwflow-degree-planner-calendar-v1');
    localStorage.removeItem('uwflow-degree-planner-enhancements-v1');
  }
});
