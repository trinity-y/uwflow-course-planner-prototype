import { Plan, PlannerCourse } from './plannerData';
import {
  buildPrerequisiteGraph,
  orderPrerequisiteGraph,
  StackingOrder,
} from './prerequisiteGraph';

export const graphDependencies = (course: PlannerCourse) =>
  Array.from(
    new Set((course.prerequisiteOptions ?? [course.prerequisites]).flat()),
  );

export interface PaletteLayoutOptions {
  stacking: StackingOrder;
  rowHeight: number;
  rowGap: number;
  indent: number;
  gutter: number;
}

export const defaultPaletteLayout: PaletteLayoutOptions = {
  stacking: 'branches',
  rowHeight: 40,
  rowGap: 12,
  indent: 24,
  gutter: 24,
};

export const paletteGraph = (
  seeds: PlannerCourse[],
  catalog: PlannerCourse[],
  options: Partial<PaletteLayoutOptions> = {},
) => {
  const layout = { ...defaultPaletteLayout, ...options };
  const graph = buildPrerequisiteGraph(
    catalog.map((course) => ({
      code: course.code,
      prerequisiteOptions: course.prerequisiteOptions ?? [course.prerequisites],
    })),
    seeds.map((course) => course.code),
  );
  const byCode = new Map(catalog.map((course) => [course.code, course]));
  const depths = new Map(graph.nodes.map((node) => [node.code, node.depth]));
  const nodes = orderPrerequisiteGraph(graph, layout.stacking).map(
    (code, index) => {
      const course = byCode.get(code);
      if (!course) throw new Error(`Unknown course in graph: ${code}`);
      return {
        course,
        x: layout.gutter + (depths.get(code) ?? 0) * layout.indent,
        y: index * (layout.rowHeight + layout.rowGap),
        height: layout.rowHeight,
      };
    },
  );
  const positioned = new Map(nodes.map((node) => [node.course.code, node]));
  const edges = graph.edges.map((edge) => {
    const from = positioned.get(edge.from);
    const to = positioned.get(edge.to);
    if (!from || !to)
      throw new Error(`Missing layout for ${edge.from} → ${edge.to}`);
    return { from, to, alternative: edge.alternative };
  });
  return {
    nodes,
    edges,
    height: nodes.length
      ? nodes.length * (layout.rowHeight + layout.rowGap) - layout.rowGap
      : 0,
  };
};

const minimalOptions = (options: string[][]) => {
  const unique = Array.from(
    new Map(
      options.map((option) => {
        const codes = Array.from(new Set(option));
        return [codes.slice().sort().join('|'), codes];
      }),
    ).values(),
  );
  return unique.filter(
    (option, index) =>
      !unique.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.length < option.length &&
          other.every((code) => option.includes(code)),
      ),
  );
};

// Contract planned nodes for display; retain original rules on the course objects.
export const unplannedPaletteGraph = (
  seeds: PlannerCourse[],
  catalog: PlannerCourse[],
  plan: Plan,
  options: Partial<PaletteLayoutOptions> = {},
) => {
  const full = paletteGraph(seeds, catalog, options);
  const originals = new Map(
    full.nodes.map((node) => [node.course.code, node.course]),
  );
  const memo = new Map<string, string[][]>();
  const combine = (parents: string[], resolve: (code: string) => string[][]) =>
    parents.reduce<string[][]>(
      (paths, code) =>
        minimalOptions(
          paths.flatMap((path) =>
            resolve(code).map((branch) => [...path, ...branch]),
          ),
        ),
      [[]],
    );
  const expand = (code: string): string[][] => {
    if (!plan[code]) return [[code]];
    const known = memo.get(code);
    if (known) return known;
    const course = originals.get(code);
    if (!course) throw new Error(`Unknown prerequisite course: ${code}`);
    const expanded = minimalOptions(
      (course.prerequisiteOptions ?? [course.prerequisites]).flatMap(
        (parents) => combine(parents, expand),
      ),
    );
    memo.set(code, expanded);
    return expanded;
  };
  const projected = Array.from(originals.values())
    .filter((course) => !plan[course.code])
    .map((course) => ({
      ...course,
      prerequisiteOptions: minimalOptions(
        (course.prerequisiteOptions ?? [course.prerequisites]).flatMap(
          (parents) => combine(parents, expand),
        ),
      ),
    }));
  const roots = new Set(
    seeds.filter((course) => !plan[course.code]).map((course) => course.code),
  );
  const result = paletteGraph(
    projected.filter((course) => roots.has(course.code)),
    projected,
    options,
  );
  result.nodes.forEach((node) => {
    node.course = originals.get(node.course.code) ?? node.course;
  });
  return result;
};

export const paletteEdgeOnRoute = (
  from: string,
  to: string,
  connections: Set<string>,
  plan: Plan,
): boolean => {
  const visited = new Set<string>();
  const visit = (dependent: string): boolean => {
    if (visited.has(dependent)) return false;
    visited.add(dependent);
    return Array.from(connections).some((connection) => {
      const [parent, child] = connection.split('→');
      return (
        child === dependent &&
        (parent === from || (Boolean(plan[parent]) && visit(parent)))
      );
    });
  };
  return visit(to);
};
