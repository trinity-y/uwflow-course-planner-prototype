import { Plan, PlannerCourse } from './plannerData';
import { buildPrerequisiteGraph } from './prerequisiteGraph';

interface ChoiceRequirement {
  courses: string[];
  count: number;
}

export const remainingPaletteSeeds = (
  catalog: PlannerCourse[],
  plan: Plan,
  choices: ChoiceRequirement[] = [],
) => {
  const remainingChoices = new Set(
    choices
      .filter(
        (choice) =>
          choice.courses.filter((code) => plan[code]).length < choice.count,
      )
      .flatMap((choice) => choice.courses),
  );
  return catalog.filter(
    (course) =>
      !plan[course.code] &&
      (course.required || remainingChoices.has(course.code)),
  );
};

export const searchPaletteSeeds = (
  seeds: PlannerCourse[],
  catalog: PlannerCourse[],
  query: string,
) => {
  const normalized = query.toLowerCase().replace(/\s/g, '');
  if (!normalized) return seeds;
  const matching = new Set(
    catalog
      .filter((course) =>
        `${course.code} ${course.title}`
          .toLowerCase()
          .replace(/\s/g, '')
          .includes(normalized),
      )
      .map((course) => course.code),
  );
  const nodes = catalog.map((course) => ({
    code: course.code,
    prerequisiteOptions: course.prerequisiteOptions ?? [course.prerequisites],
  }));
  return seeds.filter((course) =>
    buildPrerequisiteGraph(nodes, [course.code]).nodes.some((node) =>
      matching.has(node.code),
    ),
  );
};
