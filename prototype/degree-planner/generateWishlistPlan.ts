import { PlannerChoiceRequirement } from './degreeEnhancements';
import {
  canPlace,
  courses,
  isWorkTermCourse,
  Plan,
  PlannerCourse,
  prerequisiteSuggestions,
  requirements,
} from './plannerData';

export interface WishlistGeneration {
  plan: Plan;
  added: string[];
  unplaced: { code: string; reason: string }[];
}

export const generateWishlistPlan = (
  wishlist: string[],
  plan: Plan,
  terms: string[],
  includeRequired = true,
  catalog: PlannerCourse[] = courses,
  choiceRequirements: PlannerChoiceRequirement[] = catalog === courses
    ? requirements.choiceRequirements
    : [],
): WishlistGeneration => {
  let next = { ...plan };
  const unplaced: WishlistGeneration['unplaced'] = [];
  const choices = includeRequired
    ? choiceRequirements.flatMap((choice) => {
        const existing = new Set(
          choice.courses.filter(
            (code) => plan[code] || wishlist.includes(code),
          ),
        );
        const defaults =
          choice.preferredCourses ??
          (choice.term
            ? [...choice.courses].sort(
                (a, b) =>
                  Number(b.startsWith('SE ')) - Number(a.startsWith('SE ')),
              )
            : choice.courses);
        const ordered = Array.from(new Set([...defaults, ...choice.courses]));
        return ordered
          .filter((code) => !plan[code] && !wishlist.includes(code))
          .slice(0, Math.max(0, choice.count - existing.size));
      })
    : [];
  const candidates = Array.from(
    new Set([
      ...wishlist,
      ...choices,
      ...(includeRequired
        ? catalog
            .filter((course) => course.required)
            .map((course) => course.code)
        : []),
    ]),
  );
  candidates.forEach((code) => {
    if (next[code]) return;
    const course = catalog.find((item) => item.code === code);
    if (!course) {
      unplaced.push({
        code,
        reason: 'This course is not in the sample catalog.',
      });
      return;
    }
    const existingPlan = next;
    const preferred = course.recommendedTerm;
    const orderedTerms = preferred
      ? [preferred, ...terms.filter((term) => term !== preferred)]
      : terms;
    for (const term of orderedTerms) {
      if (
        (term.startsWith('WT') && !isWorkTermCourse(course)) ||
        term.startsWith('OFF') ||
        canPlace(course, term, next, terms)
      )
        continue;
      const option = prerequisiteSuggestions(course, term, next, terms, catalog)
        .filter(
          (path) =>
            path.plan &&
            Object.entries(existingPlan).every(
              ([existing, assigned]) => path.plan?.[existing] === assigned,
            ),
        )
        .sort((a, b) => a.missing.length - b.missing.length)[0];
      if (!option?.plan) continue;
      next = { ...option.plan, [code]: term };
      return;
    }
    unplaced.push({
      code,
      reason: course.fixedTerm
        ? `No room in ${course.fixedTerm}, or prerequisites could not fit earlier.`
        : isWorkTermCourse(course)
        ? 'No work term has room for this PD course and its prerequisite path.'
        : 'No academic term has room for this course and its prerequisite path.',
    });
  });
  return {
    plan: next,
    added: Object.keys(next).filter((code) => !plan[code]),
    unplaced,
  };
};
