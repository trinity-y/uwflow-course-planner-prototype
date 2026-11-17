import { GetCourseQuery } from 'generated/graphql';

import calendar2024 from './calendar2024.json';
import calendar2026 from './calendar2026.json';
import {
  DegreeEnhancement,
  PlannerChoiceRequirement,
} from './degreeEnhancements';
import enhancements from './enhancementRequirements.json';
import {
  courses as defaultCourses,
  Plan,
  PlannerCourse,
  requirements,
} from './plannerData';
import fixture from './sampleCourseResponses.json';

export interface CalendarRequirements {
  program: string;
  calendar: string;
  groups: string[];
  sourceUrl: string;
  prerequisiteScope: string;
  choiceRequirements: PlannerChoiceRequirement[];
  academicTermCapacity: Record<string, number>;
  sequences: Record<string, string[]>;
  requirementSummary: string[];
  degreeRequirements: {
    pdCourses: number;
    naturalScience: number;
    technicalElectives: { total: number };
  };
}
export interface AcademicCalendar {
  id: string;
  label: string;
  requirements: CalendarRequirements;
  courses: PlannerCourse[];
  enhancements: DegreeEnhancement[];
}
const details: Record<string, GetCourseQuery> = fixture.courseDetails;
const normalize = (
  entries: Omit<PlannerCourse, 'prerequisites'>[],
  version: CalendarRequirements,
): PlannerCourse[] =>
  entries.map((course) => ({
    ...course,
    prerequisiteOptions: course.prerequisiteOptions?.length
      ? course.prerequisiteOptions
      : [[]],
    prerequisites: course.prerequisiteOptions?.[0] ?? [],
    calendarYear: version.calendar,
    termCapacities: version.academicTermCapacity,
    listedInCalendar: true,
  }));
const defaultMetadata = defaultCourses.map((course) => {
  const entry =
    details[course.code.replace(/\s/g, '').toLowerCase()]?.course[0];
  return {
    ...course,
    description: entry?.description,
    antirequisiteText: entry?.antireqs,
    corequisiteText: entry?.coreqs,
  };
});
export const academicCalendars: AcademicCalendar[] = [
  {
    ...calendar2024,
    courses: normalize(calendar2024.courses, calendar2024.requirements),
  },
  {
    id: '2025-2026',
    label: '2025–2026',
    requirements,
    courses: normalize(defaultMetadata, requirements),
    enhancements: enhancements.plans,
  },
  {
    ...calendar2026,
    courses: normalize(calendar2026.courses, calendar2026.requirements),
  },
];
export const defaultCalendarId = '2025-2026';
export const findAcademicCalendar = (id: string | null) =>
  academicCalendars.find((calendar) => calendar.id === id) ??
  academicCalendars.find((calendar) => calendar.id === defaultCalendarId) ??
  academicCalendars[0];

// Courses outside the selected snapshot remain visible in existing placements.
export const calendarCatalog = (
  calendar: AcademicCalendar,
  plan: Plan,
  retainedCodes: string[] = [],
) => {
  const listed = new Set(calendar.courses.map((course) => course.code));
  const historical = new Map(
    academicCalendars
      .flatMap((version) => version.courses)
      .map((course) => [course.code, course]),
  );
  const retained = Array.from(new Set([...Object.keys(plan), ...retainedCodes]))
    .filter((code) => !listed.has(code))
    .flatMap((code) => {
      const course = historical.get(code);
      return course
        ? [
            {
              ...course,
              required: false,
              group: 'Other courses',
              listedInCalendar: false,
              termCapacities: calendar.requirements.academicTermCapacity,
            },
          ]
        : [];
    });
  return [...calendar.courses, ...retained];
};
