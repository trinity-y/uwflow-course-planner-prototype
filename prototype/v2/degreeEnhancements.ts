import data from './enhancementRequirements.json';
import { Plan, PlannerCourse, prerequisitePaths } from './plannerData';

export interface EnhancementRule {
  id: string;
  label: string;
  count: number;
  courses: string[];
  minimums: { label: string; count: number; courses: string[] }[];
}
export interface DegreeEnhancement {
  id: string;
  title: string;
  kind: string;
  calendar: string;
  units: number;
  sourceUrl: string;
  rules: EnhancementRule[];
  exclusiveGroups: string[][];
  notes: string[];
}
export const degreeEnhancements: DegreeEnhancement[] = data.plans;

// Maximum matching allocates each planned course once within one enhancement.
// Equivalences share a counting unit; constrained slots enforce list minimums.
export const enhancementProgress = (
  enhancement: Pick<DegreeEnhancement, 'rules' | 'exclusiveGroups'>,
  plan: Plan,
  priorityPlan: Plan = plan,
  costs: Record<string, number> = {},
) => {
  const representative = new Map<string, string>();
  const find = (code: string): string => {
    const parent = representative.get(code);
    return parent && parent !== code ? find(parent) : code;
  };
  enhancement.exclusiveGroups.forEach((group) =>
    group
      .slice(1)
      .forEach((code) => representative.set(find(code), find(group[0]))),
  );
  const slots = enhancement.rules
    .flatMap((rule) => [
      ...rule.minimums.flatMap((minimum) =>
        Array.from({ length: minimum.count }, () => ({
          rule: rule.id,
          eligible: new Set(minimum.courses),
        })),
      ),
      ...Array.from(
        {
          length: Math.max(
            0,
            rule.count -
              rule.minimums.reduce((sum, minimum) => sum + minimum.count, 0),
          ),
        },
        () => ({ rule: rule.id, eligible: new Set(rule.courses) }),
      ),
    ])
    .sort((a, b) => a.eligible.size - b.eligible.size);
  const units = new Map<string, string[]>();
  Array.from(new Set(enhancement.rules.flatMap((rule) => rule.courses)))
    .filter((code) => plan[code])
    .sort(
      (a, b) =>
        Number(Boolean(priorityPlan[b])) - Number(Boolean(priorityPlan[a])) ||
        (costs[a] ?? 0) - (costs[b] ?? 0),
    )
    .forEach((code) => {
      const unit = find(code);
      units.set(unit, [...(units.get(unit) ?? []), code]);
    });
  const matched = new Map<string, { slot: number; code: string }>();
  const assign = (slot: number, visited: Set<string>): boolean => {
    const candidates = Array.from(units).sort(
      ([a], [b]) => Number(matched.has(a)) - Number(matched.has(b)),
    );
    for (const [unit, codes] of candidates) {
      if (visited.has(unit)) continue;
      const code = codes.find((item) => slots[slot].eligible.has(item));
      if (!code) continue;
      visited.add(unit);
      const previous = matched.get(unit);
      if (!previous || assign(previous.slot, visited)) {
        matched.set(unit, { slot, code });
        return true;
      }
    }
    return false;
  };
  slots.forEach((_, index) => assign(index, new Set()));
  const allocation: Record<string, string[]> = {};
  enhancement.rules.forEach((rule) => {
    allocation[rule.id] = [];
  });
  matched.forEach(({ slot, code }) => allocation[slots[slot].rule].push(code));
  return { planned: matched.size, total: slots.length, allocation };
};

export interface PlannerChoiceRequirement {
  id?: string;
  label?: string;
  term?: string;
  count: number;
  courses: string[];
  preferredCourses?: string[];
}

export const activeCurriculum = (
  catalog: PlannerCourse[],
  baseGroups: string[],
  baseChoices: PlannerChoiceRequirement[],
  selectedIds: string[],
  plan: Plan,
  availableEnhancements: DegreeEnhancement[] = degreeEnhancements,
) => {
  const selected = availableEnhancements.filter((item) =>
    selectedIds.includes(item.id),
  );
  const mandatory = new Set(
    selected.flatMap((item) =>
      item.rules
        .filter((rule) => rule.count === rule.courses.length)
        .flatMap((rule) => rule.courses),
    ),
  );
  const activeCourses = catalog.map((course) => {
    const enhancement = selected.find((item) =>
      item.rules.some((rule) => rule.courses.includes(course.code)),
    );
    return {
      ...course,
      required: course.required || mandatory.has(course.code),
      group: enhancement && !course.required ? enhancement.title : course.group,
    };
  });
  const choices: PlannerChoiceRequirement[] = [
    ...baseChoices,
    ...selected.flatMap((enhancement) => {
      const progress = enhancementProgress(enhancement, plan);
      const allPossible = {
        ...Object.fromEntries(
          enhancement.rules
            .flatMap((rule) => rule.courses)
            .map((code) => [code, 'planned']),
        ),
        ...plan,
      };
      const priorityPlan = {
        ...Object.fromEntries(
          catalog
            .filter((course) => course.required)
            .map((course) => [course.code, 'planned']),
        ),
        ...plan,
      };
      const costs: Record<string, number> = {};
      enhancement.rules
        .flatMap((rule) => rule.courses)
        .forEach((code) => {
          if (costs[code] !== undefined) return;
          const course = catalog.find((item) => item.code === code);
          const paths = course ? prerequisitePaths(course, catalog) : [];
          costs[code] = Math.min(
            ...paths.map(
              (path) =>
                path.codes.filter((parent) => !priorityPlan[parent]).length,
            ),
            Number.MAX_SAFE_INTEGER,
          );
        });
      const completion = enhancementProgress(
        enhancement,
        allPossible,
        priorityPlan,
        costs,
      );
      return enhancement.rules.map((rule) => {
        const allocated = progress.allocation[rule.id];
        const priority = new Set(
          rule.minimums
            .filter(
              (minimum) =>
                allocated.filter((code) => minimum.courses.includes(code))
                  .length < minimum.count,
            )
            .flatMap((minimum) => minimum.courses),
        );
        return {
          id: `${enhancement.id}:${rule.id}`,
          label: rule.label,
          count: rule.count,
          preferredCourses: completion.allocation[rule.id],
          courses: rule.courses
            .filter((code) => !plan[code] || allocated.includes(code))
            .sort((a, b) => Number(priority.has(b)) - Number(priority.has(a))),
        };
      });
    }),
  ];
  return {
    courses: activeCourses,
    groups: [...baseGroups, ...selected.map((item) => item.title)],
    choices,
    selected,
  };
};
