import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { initialPlan, sequences } from './plannerData';
import TermBoard from './TermBoard';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('compares terms, pages the board, and keeps destination actions specific', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onAdd = jest.fn();
  const onRemove = jest.fn();
  const Fixture = () => {
    const [selected, setSelected] = useState('1A');
    return (
      <TermBoard
        terms={sequences['Stream 8']}
        plan={initialPlan}
        selectedTerm={selected}
        issues={[]}
        onSelect={setSelected}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    );
  };
  const click = (selector: string) => {
    const control = container.querySelector<
      HTMLButtonElement | HTMLInputElement
    >(selector);
    if (!control) throw new Error(`Missing control ${selector}`);
    act(() => control.click());
  };
  try {
    act(() => root.render(<Fixture />));
    expect(
      Array.from(container.querySelectorAll('section')).map((node) =>
        node.getAttribute('aria-label'),
      ),
    ).toEqual([
      '1A · Fall 2025',
      '1B · Winter 2026',
      'WT1 · Spring 2026',
      '2A · Fall 2026',
    ]);
    click('[aria-label="Add a course to 1B"]');
    expect(onAdd).toHaveBeenCalledWith('1B');
    click('[aria-label="Remove CS 135"]');
    expect(onRemove).toHaveBeenCalledWith('CS 135');
    click('[aria-label="Next terms"]');
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe(
      '1B · Winter 2026',
    );
    click('[aria-label="Jump to 4B"]');
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe(
      '4B · Winter 2030',
    );
    expect(container.querySelectorAll('section')).toHaveLength(1);
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="Next terms"]')
        ?.disabled,
    ).toBe(true);
    click('[aria-label="Previous terms"]');
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe(
      'WT6 · Fall 2029',
    );
    click('[aria-label="Jump to 3A"]');
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe(
      '3A · Winter 2028',
    );
    click('[aria-label="Next terms"]');
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe(
      'WT4 · Spring 2028',
    );
    click('[aria-label="Jump to 3A"]');
    click('input[type="checkbox"]');
    expect(container.textContent).not.toContain('Work term');
    const inputs = container.querySelectorAll<HTMLInputElement>('input');
    act(() => inputs[1].click());
    expect(container.querySelectorAll('section')).toHaveLength(8);
    expect(container.querySelector('[aria-label="Next terms"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
