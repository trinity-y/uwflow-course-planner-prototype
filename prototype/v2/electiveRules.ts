import { AcademicCalendar } from './academicCalendars';
import { enhancementProgress, EnhancementRule } from './degreeEnhancements';
import data from './electiveRequirements.json';
import { Plan, PlannerCourse } from './plannerData';

export interface ElectiveRule extends EnhancementRule {
  category: string;
  sourceUrl: string;
  note: string;
}

const snapshots: Record<string, { rules: ElectiveRule[] }> = data;

export const electiveRules = (calendar: AcademicCalendar) =>
  snapshots[calendar.id]?.rules ?? [];

export const electiveProgress = (
  calendar: AcademicCalendar,
  catalog: PlannerCourse[],
  plan: Plan,
) => {
  const coreOptions = new Set(
    calendar.requirements.choiceRequirements.flatMap(
      (choice) => choice.courses,
    ),
  );
  const eligible = catalog.filter(
    (course) =>
      !course.required &&
      !coreOptions.has(course.code) &&
      !course.workTermCourse &&
      !/^PD\s/.test(course.code) &&
      course.units === 0.5,
  );
  const allowed = new Set(eligible.map((course) => course.code));
  const rules = electiveRules(calendar).map((rule) => ({
    ...rule,
    courses:
      rule.id === 'unrestricted'
        ? Array.from(allowed)
        : rule.courses.filter((code) => allowed.has(code)),
  }));
  const progress = enhancementProgress(
    { rules, exclusiveGroups: [] },
    Object.fromEntries(
      Object.entries(plan).filter(([code]) => allowed.has(code)),
    ),
  );
  return { rules, ...progress };
};
