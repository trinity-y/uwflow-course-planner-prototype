import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

import WishlistPage from './WishlistPage';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('searches outside the wishlist and saves results without planning them', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onAdd = jest.fn();
  const Fixture = () => {
    const [wishlist, setWishlist] = useState(['CS 247']);
    return (
      <WishlistPage
        wishlist={wishlist}
        plan={{ 'CS 247': '2B' }}
        terms={['1A', '1B', '2A', '2B']}
        onMove={() => undefined}
        onToggleWishlist={(code) =>
          setWishlist((current) =>
            current.includes(code)
              ? current.filter((item) => item !== code)
              : [...current, code],
          )
        }
        onDetails={() => undefined}
        onAdd={onAdd}
        onApply={() => undefined}
        onViewTerm={() => undefined}
      />
    );
  };
  try {
    act(() => root.render(<Fixture />));
    expect(
      container.querySelector('[aria-label="Planned in 2B"]')?.textContent,
    ).toBe('2B');
    expect(
      container.querySelector('[aria-label="Wishlist priority order"]')
        ?.textContent,
    ).toContain('Missing prerequisites');
    expect(
      container.querySelector('[aria-label="View CS 247 in 2B"]'),
    ).toBeNull();
    const input = container.querySelector<HTMLInputElement>(
      '[aria-label="Search all courses for wishlist"]',
    );
    if (!input) throw new Error('Search field missing');
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set?.call(input, 'econ101');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const add = container.querySelector<HTMLButtonElement>(
      '[aria-label="Add ECON 101 to wishlist"]',
    );
    if (!add) throw new Error('Course outside wishlist was not found');
    act(() => add.click());
    expect(
      container.querySelector('[aria-label="Unscheduled wishlist courses"]')
        ?.textContent,
    ).toBe('ECON 101');
    expect(
      container.querySelector('[aria-label="Wishlist priority order"]')
        ?.textContent,
    ).toContain('ECON 101');
    expect(onAdd).not.toHaveBeenCalled();
    const results = container.querySelector(
      '[aria-label="Course search results"]',
    );
    expect(
      results
        ?.querySelector('[aria-label="Remove ECON 101 from wishlist"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
