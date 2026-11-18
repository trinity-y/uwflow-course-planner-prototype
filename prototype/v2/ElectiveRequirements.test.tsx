import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { calendarCatalog, findAcademicCalendar } from './academicCalendars';
import ElectiveRequirements from './ElectiveRequirements';

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

test('expands calendar categories and offers Public Speaking for communication', () => {
  const calendar = findAcademicCalendar('2024-2025');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onAdd = jest.fn();
  act(() =>
    root.render(
      <ElectiveRequirements
        calendar={calendar}
        catalog={calendarCatalog(calendar, {})}
        plan={{}}
        query=""
        wishlist={[]}
        onChoose={() => undefined}
        onAdd={onAdd}
        onToggleWishlist={() => undefined}
      />,
    ),
  );
  expect(container.textContent).toContain('Natural Science0/4 planned');
  expect(container.textContent).toContain(
    'Technical Electives (TEs)0/3 planned',
  );
  expect(container.textContent).not.toContain('Required choices');
  const button = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes('Undergraduate Communication Requirement'),
  );
  act(() => button?.click());
  expect(button?.getAttribute('aria-expanded')).toBe('true');
  expect(container.textContent).toContain('Public Speaking');
  const add = container.querySelector<HTMLButtonElement>(
    '[aria-label="Add COMMST 223 to plan"]',
  );
  act(() => add?.click());
  expect(onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ code: 'COMMST 223' }),
  );
  act(() => root.unmount());
  container.remove();
});
