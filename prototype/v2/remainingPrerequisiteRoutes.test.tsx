import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { findAcademicCalendar } from './academicCalendars';
import CourseGraph from './CourseGraph';
import { unplannedPaletteGraph } from './paletteGraph';
import { createCorePlan, prerequisiteRoutes } from './plannerData';

const calendar = findAcademicCalendar('2025-2026');
const course = calendar.courses.find((item) => item.code === 'SE 490');
if (!course) throw new Error('Missing SE 490');
const seed = course;

test('SE 490 routes show only missing prerequisites, without planned CS alternatives', () => {
  const plan = createCorePlan(calendar.courses);
  const graph = unplannedPaletteGraph([seed], calendar.courses, plan);
  expect(graph.nodes.map((node) => node.course.code)).toEqual([
    'PD 10',
    'SE 390',
    'SE 490',
  ]);
  const root = graph.remainingCatalog.find((item) => item.code === seed.code);
  if (!root) throw new Error('Missing displayed SE 490');
  const routes = prerequisiteRoutes(root, graph.remainingCatalog);
  expect(routes).toHaveLength(1);
  expect(Array.from(routes[0].connections)).toEqual([
    'SE 390→SE 490',
    'PD 10→SE 390',
  ]);
  expect(routes[0].label).not.toMatch(/CS 240|CS 247|CS 246|CS 240E/);
  expect(seed.prerequisiteOptions).toEqual([['SE 390']]);
});

test('removing a planned prerequisite restores only the missing alternatives', () => {
  const plan = createCorePlan(calendar.courses);
  delete plan['CS 247'];
  const graph = unplannedPaletteGraph([seed], calendar.courses, plan);
  const root = graph.remainingCatalog.find((item) => item.code === seed.code);
  if (!root) throw new Error('Missing displayed SE 490');
  const routes = prerequisiteRoutes(root, graph.remainingCatalog);
  expect(routes).toHaveLength(2);
  expect(routes.some((route) => route.codes.has('CS 247'))).toBe(true);
  expect(routes.some((route) => route.codes.has('CS 246'))).toBe(true);
  expect(
    routes.every(
      (route) => !route.codes.has('CS 240') && !route.codes.has('CS 240E'),
    ),
  ).toBe(true);
});

test('hover labels and colours use the same remaining graph as the displayed courses', () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (plan: Record<string, string>) =>
    act(() =>
      root.render(
        <CourseGraph
          seeds={[seed]}
          catalog={calendar.courses}
          plan={plan}
          onChoose={() => undefined}
        />,
      ),
    );
  const hover = () => {
    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="SE 490:"]',
    );
    if (!button) throw new Error('Missing SE 490');
    act(() => button.focus());
  };
  try {
    const plan = createCorePlan(calendar.courses);
    render(plan);
    hover();
    const legend = container.querySelector(
      '[aria-label="Prerequisite path colours"]',
    );
    expect(legend?.textContent).toContain('Path 1');
    expect(legend?.textContent).not.toContain('Path 2');
    expect(legend?.textContent).not.toMatch(/CS 240|CS 247|CS 246|CS 240E/);
    render({ ...plan, 'SE 390': '3B' });
    expect(container.querySelector('svg path')).toBeNull();
    expect(
      container.querySelector('[aria-label="Prerequisite path colours"]')
        ?.textContent,
    ).not.toContain('Path 1');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
