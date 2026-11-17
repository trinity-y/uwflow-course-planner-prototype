import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from 'react-modal';

import DegreeEnhancementPicker from './DegreeEnhancementPicker';
import { initialPlan } from './plannerData';

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('filters available plans, previews shared progress, and adds and removes a minor', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  Modal.setAppElement(container);
  const root = createRoot(container);
  const toggled = jest.fn();
  const Fixture = () => {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <DegreeEnhancementPicker
        selected={selected}
        plan={initialPlan}
        onToggle={(id) => {
          toggled(id);
          setSelected((previous) =>
            previous.includes(id)
              ? previous.filter((item) => item !== id)
              : [...previous, id],
          );
        }}
      />
    );
  };
  const click = (text: string) => {
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button'),
    ).find((item) => item.textContent === text);
    if (!button) throw new Error(`Missing ${text}`);
    act(() => button.click());
  };
  try {
    act(() => root.render(<Fixture />));
    click('Add minor / specialization');
    const filter = document.querySelector<HTMLSelectElement>(
      '[aria-label="Enhancement type"]',
    );
    if (!filter) throw new Error('Missing type filter');
    act(() => {
      filter.value = 'minor';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(
      document.querySelector('[aria-label="Available enhancements"]')
        ?.textContent,
    ).toContain('Combinatorics and Optimization Minor');
    expect(
      document.querySelector('[aria-label="Available enhancements"]')
        ?.textContent,
    ).not.toContain('Artificial Intelligence');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      '3/8 courses planned',
    );
    click('Add minor');
    expect(toggled).toHaveBeenCalledWith('co-minor');
    expect(container.textContent).toContain('3/8 planned');
    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove Combinatorics and Optimization Minor"]',
    );
    if (!remove) throw new Error('Missing remove');
    act(() => remove.click());
    expect(container.textContent).not.toContain('3/8 planned');
    expect(toggled).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
