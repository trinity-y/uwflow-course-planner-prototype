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

// Stop display paths at planned courses; retain original rules for course details.
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
  const projected = Array.from(originals.values())
    .filter((course) => !plan[course.code])
    .map((course) => ({
      ...course,
      prerequisiteOptions: minimalOptions(
        (course.prerequisiteOptions ?? [course.prerequisites]).flatMap(
          (parents) => [parents.filter((code) => !plan[code])],
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
  return { ...result, remainingCatalog: projected };
};
