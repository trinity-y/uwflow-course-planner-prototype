import { Plan, PlannerCourse } from './plannerData';

export interface CourseChoices {
  mandatory: string[];
  groups: string[][][];
}

// Factor independent choices without inventing combinations absent from the data.
export const prerequisiteChoices = (course: PlannerCourse): CourseChoices => {
  const options = Array.from(
    new Map(
      (course.prerequisiteOptions ?? [course.prerequisites]).map((option) => {
        const codes = Array.from(new Set(option));
        return [codes.slice().sort().join('|'), codes];
      }),
    ).values(),
  );
  if (!options.length) return { mandatory: [], groups: [] };
  const mandatory = options[0].filter((code) =>
    options.every((option) => option.includes(code)),
  );
  const remaining = options.map((option) =>
    option.filter((code) => !mandatory.includes(code)),
  );
  if (remaining.some((option) => !option.length))
    return { mandatory, groups: [] };
  const codes = Array.from(new Set(remaining.flat()));
  const components: string[][] = [];
  const seen = new Set<string>();
  codes.forEach((code) => {
    if (seen.has(code)) return;
    const component: string[] = [];
    const visit = (current: string) => {
      if (seen.has(current)) return;
      seen.add(current);
      component.push(current);
      codes
        .filter(
          (other) =>
            other !== current &&
            !remaining.some(
              (option) => option.includes(current) && option.includes(other),
            ),
        )
        .forEach(visit);
    };
    visit(code);
    components.push(component);
  });
  const independent =
    components.every((component) =>
      remaining.every(
        (option) =>
          component.filter((code) => option.includes(code)).length === 1,
      ),
    ) &&
    components.reduce((count, component) => count * component.length, 1) ===
      remaining.length;
  return {
    mandatory,
    groups: independent
      ? components.map((component) => component.map((code) => [code]))
      : [remaining],
  };
};

export type PrerequisiteSelections = Record<string, number>;
export const choiceKey = (code: string, group: number) => `${code}:${group}`;

export const initialPrerequisiteSelections = (
  catalog: PlannerCourse[],
  plan: Plan,
  terms: string[],
  target: string,
): PrerequisiteSelections => {
  const selections: PrerequisiteSelections = {};
  catalog.forEach((course) => {
    const deadline = terms.indexOf(plan[course.code] ?? target);
    prerequisiteChoices(course).groups.forEach((group, index) => {
      const selected = group.findIndex((option) =>
        option.every(
          (code) =>
            Boolean(plan[code]) &&
            terms.indexOf(plan[code]) >= 0 &&
            terms.indexOf(plan[code]) < deadline,
        ),
      );
      if (selected >= 0) selections[choiceKey(course.code, index)] = selected;
    });
  });
  return selections;
};

export const selectedPrerequisiteTree = (
  course: PlannerCourse,
  catalog: PlannerCourse[],
  selections: PrerequisiteSelections,
) => {
  const rows: { course: PlannerCourse; depth: number; requiredBy: string[] }[] =
    [];
  const projected: PlannerCourse[] = [];
  const unresolved: string[] = [];
  const seen = new Map<string, (typeof rows)[number]>();
  const visit = (current: PlannerCourse, depth: number, parent?: string) => {
    const existing = seen.get(current.code);
    if (existing) {
      if (parent && !existing.requiredBy.includes(parent))
        existing.requiredBy.push(parent);
      return;
    }
    const row = { course: current, depth, requiredBy: parent ? [parent] : [] };
    seen.set(current.code, row);
    rows.push(row);
    const choices = prerequisiteChoices(current);
    const parents = [...choices.mandatory];
    choices.groups.forEach((group, index) => {
      const selected = selections[choiceKey(current.code, index)];
      if (selected === undefined || !group[selected])
        unresolved.push(choiceKey(current.code, index));
      else parents.push(...group[selected]);
    });
    const prerequisites = Array.from(new Set(parents));
    projected.push({
      ...current,
      prerequisites,
      prerequisiteOptions: [prerequisites],
    });
    prerequisites.forEach((code) => {
      const dependency = catalog.find((item) => item.code === code);
      if (dependency) visit(dependency, depth + 1, current.code);
      else unresolved.push(code);
    });
  };
  visit(course, 0);
  return { rows, catalog: projected, unresolved };
};

// Visibility is separate from validation: hidden planned nodes still contribute rules.
export const missingPrerequisiteRows = (
  tree: ReturnType<typeof selectedPrerequisiteTree>,
  plan: Plan,
  terms: string[],
  target: string,
) => {
  const byCode = new Map(tree.rows.map((row) => [row.course.code, row]));
  const visible = new Set(
    tree.rows
      .filter((row, index) => {
        if (index === 0 || !plan[row.course.code]) return true;
        const assigned = terms.indexOf(plan[row.course.code]);
        return (
          assigned < 0 ||
          row.requiredBy.some(
            (parent) => assigned >= terms.indexOf(plan[parent] ?? target),
          ) ||
          prerequisiteChoices(row.course).groups.some((_, group) =>
            tree.unresolved.includes(choiceKey(row.course.code, group)),
          )
        );
      })
      .map((row) => row.course.code),
  );
  const visibleParents = (code: string): string[] =>
    Array.from(
      new Set(
        (byCode.get(code)?.requiredBy ?? []).flatMap((parent) =>
          visible.has(parent) ? [parent] : visibleParents(parent),
        ),
      ),
    );
  const depth = (code: string): number => {
    const parents = visibleParents(code);
    return parents.length
      ? Math.min(...parents.map((parent) => depth(parent))) + 1
      : 0;
  };
  return tree.rows
    .filter((row) => visible.has(row.course.code))
    .map((row) => ({
      ...row,
      depth: depth(row.course.code),
      requiredBy: visibleParents(row.course.code),
    }));
};
