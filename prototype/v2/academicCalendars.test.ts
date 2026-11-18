import {
  academicCalendars,
  calendarCatalog,
  findAcademicCalendar,
} from './academicCalendars';
import { enhancementProgress } from './degreeEnhancements';
import { paletteGraph } from './paletteGraph';
import {
  canPlace,
  createCorePlan,
  initialPlan,
  Plan,
  prerequisiteIssues,
} from './plannerData';

const course = (id: string, code: string) => {
  const found = findAcademicCalendar(id).courses.find(
    (item) => item.code === code,
  );
  if (!found) throw new Error(`Missing ${code} in ${id}`);
  return found;
};

test('calendar snapshots contain real differences in core requirements, electives and sequences', () => {
  const older = findAcademicCalendar('2024-2025');
  const current = findAcademicCalendar('2025-2026');
  const newer = findAcademicCalendar('2026-2027');
  expect(course(older.id, 'SE 390').required).toBe(true);
  expect(course(current.id, 'SE 390').required).toBe(false);
  expect(course(older.id, 'ECE 192').recommendedTerm).toBe('2B');
  expect(course(current.id, 'ECE 192').recommendedTerm).toBe('1B');
  expect(older.requirements.degreeRequirements.naturalScience).toBe(4);
  expect(current.requirements.degreeRequirements.naturalScience).toBe(3);
  expect(older.requirements.degreeRequirements.technicalElectives.total).toBe(
    3,
  );
  expect(current.requirements.degreeRequirements.technicalElectives.total).toBe(
    4,
  );
  expect(Object.keys(older.requirements.sequences)).toEqual([
    'Stream 8',
    'Stream 8X',
  ]);
  expect(Object.keys(current.requirements.sequences)).toEqual([
    'Stream 8X',
    'Stream 8Y',
  ]);
  expect(current.requirements.degreeRequirements.pdCourses).toBe(5);
  expect(newer.requirements.degreeRequirements.pdCourses).toBe(4);
});

test('placement checks use the selected calendar load rather than the default calendar', () => {
  const plan: Plan = Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E', 'F'].map((code) => [code, '1B']),
  );
  const terms = ['1A', '1B', 'WT1', '2A'];
  expect(canPlace(course('2024-2025', 'ECON 101'), '1B', plan, terms)).toBe(
    'This term is full.',
  );
  expect(canPlace(course('2025-2026', 'ECON 101'), '1B', plan, terms)).toBe('');
});

test.each(['2024-2025', '2025-2026', '2026-2027'])(
  '%s has a complete course graph and matching enhancement sources',
  (id) => {
    const calendar = findAcademicCalendar(id);
    expect(() =>
      paletteGraph(calendar.courses, calendar.courses),
    ).not.toThrow();
    calendar.enhancements.forEach((enhancement) => {
      expect(enhancement.calendar).toBe(calendar.label);
      enhancement.rules
        .flatMap((rule) => rule.courses)
        .forEach((code) =>
          expect(calendar.courses.some((item) => item.code === code)).toBe(
            true,
          ),
        );
    });
  },
);

test('Business requirements and progress use the selected calendar version', () => {
  const older = findAcademicCalendar('2024-2025').enhancements.find(
    (item) => item.id === 'business',
  );
  const current = findAcademicCalendar('2025-2026').enhancements.find(
    (item) => item.id === 'business',
  );
  if (!older || !current) throw new Error('Missing business');
  expect(enhancementProgress(older, initialPlan).total).toBe(8);
  expect(enhancementProgress(current, initialPlan).total).toBe(7);
});

test('switching calendars preserves scheduled and wishlisted courses missing from the selected snapshot', () => {
  const older = findAcademicCalendar('2024-2025');
  const plan = { ...initialPlan, 'AMATH 449': '4A' };
  const catalog = calendarCatalog(older, plan, ['ACTSC 447']);
  expect(
    catalog.find((item) => item.code === 'AMATH 449')?.listedInCalendar,
  ).toBe(false);
  expect(
    catalog.find((item) => item.code === 'ACTSC 447')?.listedInCalendar,
  ).toBe(false);
  expect(plan['AMATH 449']).toBe('4A');
  expect(
    calendarCatalog(findAcademicCalendar('2025-2026'), {
      'FINE 257': '3A',
    }).find((item) => item.code === 'FINE 257')?.listedInCalendar,
  ).toBe(false);
  expect(findAcademicCalendar('unknown').id).toBe('2025-2026');
  expect(academicCalendars).toHaveLength(3);
});

test.each([
  ['2024-2025', 38, '2B'],
  ['2025-2026', 35, '1B'],
  ['2026-2027', 35, '1B'],
] as const)(
  'starts %s with named core courses in calendar terms',
  (id, count, economicsTerm) => {
    const calendar = findAcademicCalendar(id);
    const plan = createCorePlan(calendar.courses);
    expect(Object.keys(plan)).toHaveLength(count);
    expect(plan['CS 137']).toBe('1A');
    expect(plan['ECE 192']).toBe(economicsTerm);
    expect(plan['SE 402']).toBe('4B');
    expect(plan['PD 19']).toBeUndefined();
    expect(plan['ENGL 109']).toBeUndefined();
    expect(plan['CS 349']).toBeUndefined();
    expect(plan['SE 490']).toBe(id === '2024-2025' ? '4A' : undefined);
    for (const terms of Object.values(calendar.requirements.sequences)) {
      if (id === '2025-2026')
        expect(prerequisiteIssues(plan, terms, calendar.courses)).toEqual([]);
      for (const [code, term] of Object.entries(plan)) {
        expect(canPlace(course(id, code), term, plan, terms)).toBe('');
      }
    }
  },
);
