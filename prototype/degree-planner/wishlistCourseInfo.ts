import { CourseScheduleFragment } from 'generated/graphql';

import { getCurrentTermCode, termCodeToDate } from 'utils/Misc';

import { Plan, PlannerCourse, prerequisitePaths } from './plannerData';

export const futureCourseOfferings = (
  sections: CourseScheduleFragment['sections'] | undefined,
  currentTerm = getCurrentTermCode(),
) => {
  if (!sections?.length) return null;
  const future = Array.from(
    new Set(
      sections
        .filter(
          (section) =>
            section.term_id > currentTerm &&
            [1, 5, 9].includes(section.term_id % 10) &&
            (section.meetings.length === 0 ||
              section.meetings.some((meeting) => !meeting.is_cancelled)),
        )
        .map((section) => section.term_id),
    ),
  ).sort((a, b) => a - b);
  return future.map(termCodeToDate);
};

export const hasWishlistPrerequisiteGap = (
  course: PlannerCourse,
  plan: Plan,
  terms: string[],
  catalog?: PlannerCourse[],
) =>
  !prerequisitePaths(course, catalog).some((path) =>
    Object.entries(path.requirements).every(([dependent, parents]) =>
      parents.every((parent) => {
        const index = terms.indexOf(plan[parent]);
        return (
          index >= 0 &&
          (!plan[dependent] || index < terms.indexOf(plan[dependent]))
        );
      }),
    ),
  );
