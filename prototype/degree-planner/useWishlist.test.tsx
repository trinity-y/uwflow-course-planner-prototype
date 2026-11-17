import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import CourseGraph from './CourseGraph';
import { courses } from './plannerData';
import useWishlist from './useWishlist';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

const storageKey = 'uwflow-degree-planner-wishlist-v1';
beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => localStorage.removeItem(storageKey));

test('palette hearts toggle and persist independently from details and course placement', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root = createRoot(container);
  const onChoose = jest.fn();
  const onAdd = jest.fn();
  const Fixture = () => {
    const { wishlist, toggleWishlist } = useWishlist();
    return (
      <CourseGraph
        seeds={courses.filter((course) => course.code === 'CS 247')}
        plan={{}}
        onChoose={onChoose}
        onAdd={onAdd}
        wishlist={wishlist}
        onToggleWishlist={toggleWishlist}
      />
    );
  };
  const heart = (action: string) => {
    const found = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${action} CS 247 ${
        action === 'Add' ? 'to' : 'from'
      } wishlist"]`,
    );
    if (!found) throw new Error('Wishlist control missing');
    return found;
  };
  try {
    act(() => root.render(<Fixture />));
    expect(heart('Add').getAttribute('aria-pressed')).toBe('false');
    act(() => heart('Add').click());
    expect(heart('Remove').getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual([
      'CS 247',
    ]);
    expect(onChoose).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<Fixture />));
    expect(heart('Remove').getAttribute('aria-pressed')).toBe('true');
    act(() => heart('Remove').click());
    expect(heart('Add').getAttribute('aria-pressed')).toBe('false');
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual([]);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

test('invalid stored wishlist data does not prevent rendering', () => {
  localStorage.setItem(storageKey, 'not valid JSON');
  const container = document.createElement('div');
  const root = createRoot(container);
  const Fixture = () => {
    const { wishlist } = useWishlist();
    return <span>{wishlist.length} saved courses</span>;
  };
  try {
    act(() => root.render(<Fixture />));
    expect(container.textContent).toBe('0 saved courses');
  } finally {
    act(() => root.unmount());
  }
});
