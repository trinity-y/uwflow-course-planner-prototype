import { calendarCatalog, findAcademicCalendar } from './academicCalendars';
import { electiveProgress, electiveRules } from './electiveRules';
import { createCorePlan } from './plannerData';

const calendar = findAcademicCalendar('2025-2026');
const catalog = calendarCatalog(calendar, {});

test('elective categories and counts follow the selected calendar', () => {
  expect(
    electiveRules(findAcademicCalendar('2024-2025')).map((rule) => [
      rule.id,
      rule.count,
    ]),
  ).toEqual([
    ['cse-a', 1],
    ['cse-c', 1],
    ['natural-science', 4],
    ['technical', 3],
    ['communication', 1],
    ['unrestricted', 2],
  ]);
  expect(electiveRules(calendar).map((rule) => rule.count)).toEqual([
    1, 1, 3, 4, 1, 2,
  ]);
  expect(
    electiveRules(calendar).find((rule) => rule.id === 'communication')
      ?.courses,
  ).toContain('COMMST 223');
});

test('core placements do not fill elective requirements', () => {
  const progress = electiveProgress(
    calendar,
    catalog,
    createCorePlan(calendar.courses),
  );
  expect(progress.planned).toBe(0);
  expect(progress.total).toBe(12);
});

test('allocates overlapping courses once, including unrestricted electives', () => {
  const plan = { 'AFM 131': '2B', 'COMMST 223': '1B', 'CS 492': '4A' };
  const progress = electiveProgress(calendar, catalog, plan);
  const codes = Object.values(progress.allocation).flat();
  expect(codes).toHaveLength(3);
  expect(new Set(codes).size).toBe(3);
  expect(progress.allocation.communication).toEqual(['COMMST 223']);
  expect(progress.allocation['cse-a']).toEqual(['CS 492']);
  expect(progress.allocation['cse-c']).toEqual(['AFM 131']);
});
