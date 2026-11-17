import requirements from './courseRequirements.json';
import enhancementRequirements from './enhancementRequirements.json';

export interface PlannerCourse {
  code: string;
  title: string;
  group: string;
  required: boolean;
  prerequisites: string[];
  prerequisiteOptions?: string[][];
  fixedTerm?: string;
  recommendedTerm?: string;
  workTermCourse?: boolean;
  units?: number;
  prerequisiteText?: string;
  calendarUrl?: string;
  calendarYear?: string;
  description?: string | null;
  antirequisiteText?: string | null;
  corequisiteText?: string | null;
  listedInCalendar?: boolean;
  termCapacities?: Record<string, number>;
}

export const courses: PlannerCourse[] = [
  ...requirements.courses,
  ...enhancementRequirements.courses,
].map((course) => ({
  ...course,
  prerequisiteOptions: course.prerequisiteOptions.length
    ? course.prerequisiteOptions
    : [[]],
  prerequisites: course.prerequisiteOptions[0] ?? [],
}));

export type Plan = Record<string, string>;
export const initialPlan: Plan = requirements.initialPlan;
export const sequences: Record<string, string[]> = requirements.sequences;
export { requirements };

export const termDate = (index: number) =>
  `${['Fall', 'Winter', 'Spring'][index % 3]} ${
    requirements.startYear + Math.floor((index + 2) / 3)
  }`;

// Display slots follow the published cohort load; these are not enrolment limits.
export const termCapacity = (
  term: string,
  capacities: Record<string, number> = requirements.academicTermCapacity,
) => (term.startsWith('WT') ? 2 : capacities[term] ?? 5);

export const isWorkTermCourse = (
  course: Pick<PlannerCourse, 'code' | 'workTermCourse'>,
) => Boolean(course.workTermCourse) || /^PD\s*\d/i.test(course.code);

export const canPlace = (
  course: PlannerCourse,
  term: string,
  plan: Plan,
  terms: string[],
) => {
  if (!terms.includes(term)) return 'Choose a term in this sequence.';
  if (term.startsWith('OFF')) return 'This is a term off.';
  if (isWorkTermCourse(course) && !term.startsWith('WT'))
    return 'This course can only be assigned to a work term.';
  if (course.fixedTerm && course.fixedTerm !== term)
    return `This course is assigned to ${course.fixedTerm}.`;
  if (
    Object.entries(plan).filter(
      ([code, assigned]) => assigned === term && code !== course.code,
    ).length >= termCapacity(term, course.termCapacities)
  )
    return 'This term is full.';
  return '';
};

export const prerequisiteLabel = (course: PlannerCourse) =>
  (course.prerequisiteOptions ?? [course.prerequisites])
    .map((option) => option.join(' and '))
    .join(' or ');

interface PrerequisitePath {
  codes: string[];
  requirements: Record<string, string[]>;
}

// Compare implied ordering, so a redundant direct edge is not a new path.
const minimalPrerequisitePaths = (paths: PrerequisitePath[]) => {
  const signatures = paths.map((path) => {
    const ordering = new Set<string>();
    const visit = (current: string, dependent: string) => {
      (path.requirements[current] ?? []).forEach((parent) => {
        const edge = `${parent}→${dependent}`;
        if (ordering.has(edge)) return;
        ordering.add(edge);
        visit(parent, dependent);
      });
    };
    Object.keys(path.requirements).forEach((code) => visit(code, code));
    return { codes: new Set(path.codes), ordering };
  });
  return paths.filter(
    (_, index) =>
      !signatures.some((other, otherIndex) => {
        if (index === otherIndex) return false;
        const current = signatures[index];
        return (
          other.codes.size <= current.codes.size &&
          other.ordering.size <= current.ordering.size &&
          Array.from(other.codes).every((code) => current.codes.has(code)) &&
          Array.from(other.ordering).every((edge) =>
            current.ordering.has(edge),
          ) &&
          (other.codes.size < current.codes.size ||
            other.ordering.size < current.ordering.size ||
            otherIndex < index)
        );
      }),
  );
};

// Each path is one complete OR choice, including choices inside its ancestors.
export const prerequisitePaths = (
  course: PlannerCourse,
  catalog: PlannerCourse[] = courses,
  visiting: string[] = [],
): PrerequisitePath[] => {
  if (visiting.includes(course.code)) return [];
  return minimalPrerequisitePaths(
    (course.prerequisiteOptions ?? [course.prerequisites]).flatMap((option) => {
      let paths: PrerequisitePath[] = [
        { codes: [], requirements: { [course.code]: option } },
      ];
      option.forEach((code) => {
        const dependency = catalog.find((item) => item.code === code);
        const branches = dependency
          ? prerequisitePaths(dependency, catalog, [...visiting, course.code])
          : [];
        paths = paths.flatMap((path) =>
          branches.flatMap((branch) => {
            const conflict = Object.keys(branch.requirements).some(
              (key) =>
                path.requirements[key] &&
                (path.requirements[key].length !==
                  branch.requirements[key].length ||
                  path.requirements[key].some(
                    (parent) => !branch.requirements[key].includes(parent),
                  )),
            );
            return conflict
              ? []
              : [
                  {
                    codes: Array.from(
                      new Set([...path.codes, ...branch.codes, code]),
                    ),
                    requirements: {
                      ...path.requirements,
                      ...branch.requirements,
                    },
                  },
                ];
          }),
        );
      });
      return paths;
    }),
  );
};

export const prerequisiteSuggestions = (
  course: PlannerCourse,
  target: string,
  plan: Plan,
  terms: string[],
  catalog: PlannerCourse[] = courses,
) =>
  prerequisitePaths(course, catalog).map((path) => {
    const next = { ...plan };
    const deadlines: Record<string, number> = {
      [course.code]: terms.indexOf(target),
    };
    const missing = path.codes.filter((code) => {
      const assigned = terms.indexOf(plan[code]);
      const parents = Object.keys(path.requirements).filter((parent) =>
        path.requirements[parent].includes(code),
      );
      return (
        !plan[code] ||
        (isWorkTermCourse(
          catalog.find((item) => item.code === code) ?? { code },
        ) &&
          !plan[code].startsWith('WT')) ||
        parents.some(
          (parent) =>
            assigned >=
            terms.indexOf(
              parent === course.code ? target : plan[parent] ?? target,
            ),
        )
      );
    });
    [...path.codes, course.code].reverse().forEach((code) => {
      const assigned =
        code === course.code
          ? terms.indexOf(target)
          : terms.indexOf(plan[code]);
      const deadline = Math.min(
        deadlines[code] ?? terms.indexOf(target),
        assigned >= 0 ? assigned : terms.length,
      );
      (path.requirements[code] ?? []).forEach((dependency) => {
        deadlines[dependency] = Math.min(
          deadlines[dependency] ?? terms.length,
          deadline,
        );
      });
    });
    let error = '';
    path.codes.forEach((code) => {
      if (error) return;
      const dependency = catalog.find((item) => item.code === code);
      if (!dependency) {
        error = `No sample data for ${code}.`;
        return;
      }
      const existingIndex = terms.indexOf(next[code]);
      if (
        existingIndex >= 0 &&
        existingIndex < deadlines[code] &&
        (!isWorkTermCourse(dependency) || next[code].startsWith('WT'))
      )
        return;
      const term = terms.find(
        (item, index) =>
          index < deadlines[code] &&
          (!item.startsWith('WT') || isWorkTermCourse(dependency)) &&
          !canPlace(dependency, item, next, terms) &&
          (path.requirements[code] ?? []).every(
            (prerequisite) =>
              next[prerequisite] && terms.indexOf(next[prerequisite]) < index,
          ),
      );
      if (!term) {
        error = `No space for ${code} before ${target}. Choose a later term or free up an earlier term.`;
        return;
      }
      next[code] = term;
    });
    return { ...path, missing, plan: error ? null : next, error };
  });

export const prerequisiteIssues = (
  plan: Plan,
  terms: string[],
  catalog: PlannerCourse[] = courses,
) =>
  catalog.filter((course) => {
    if (!plan[course.code]) return false;
    return !prerequisitePaths(course, catalog).some((path) =>
      Object.entries(path.requirements).every(([parent, dependencies]) =>
        dependencies.every((code) => {
          const prerequisiteIndex = terms.indexOf(plan[code]);
          return (
            prerequisiteIndex >= 0 &&
            prerequisiteIndex < terms.indexOf(plan[parent])
          );
        }),
      ),
    );
  });

export const prerequisiteRoutes = (
  course: PlannerCourse,
  catalog: PlannerCourse[] = courses,
) =>
  prerequisitePaths(course, catalog).map((path) => ({
    codes: new Set([...path.codes, course.code]),
    connections: new Set(
      Object.entries(path.requirements).flatMap(([dependent, parents]) =>
        parents.map((parent) => `${parent}→${dependent}`),
      ),
    ),
    label: [
      (path.requirements[course.code] ?? []).join(' and '),
      ...Object.entries(path.requirements)
        .filter(([code]) => code !== course.code)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([code, chosen]) => {
          const dependency = catalog.find((item) => item.code === code);
          const options = dependency?.prerequisiteOptions ?? [
            dependency?.prerequisites ?? [],
          ];
          if (options.length < 2) return [];
          const varying = chosen.filter(
            (parent) => !options.every((option) => option.includes(parent)),
          );
          return varying.length ? [`${code}: ${varying.join(' and ')}`] : [];
        }),
    ]
      .filter(Boolean)
      .join(' · '),
  }));
