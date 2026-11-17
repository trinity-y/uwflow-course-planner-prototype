export interface RequirementNode {
  code: string;
  // Each inner array is an AND group; the outer array contains OR choices.
  prerequisiteOptions: string[][];
}

export interface RequirementGraph {
  nodes: { code: string; depth: number }[];
  edges: { from: string; to: string; alternative: boolean }[];
}

export type StackingOrder = 'depth' | 'branches';

export const buildPrerequisiteGraph = (
  catalog: RequirementNode[],
  selectedCodes: string[],
): RequirementGraph => {
  const byCode = new Map(catalog.map((node) => [node.code, node]));
  if (byCode.size !== catalog.length)
    throw new Error('Duplicate course codes in requirements.');
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (code: string): number => {
    const known = depths.get(code);
    if (known !== undefined) return known;
    const node = byCode.get(code);
    if (!node) throw new Error(`Unknown prerequisite course: ${code}`);
    if (visiting.has(code)) throw new Error(`Prerequisite cycle at ${code}`);
    visiting.add(code);
    const parents = Array.from(new Set(node.prerequisiteOptions.flat()));
    const depth = parents.length ? Math.max(...parents.map(visit)) + 1 : 0;
    visiting.delete(code);
    depths.set(code, depth);
    return depth;
  };
  selectedCodes.forEach(visit);
  const included = catalog.filter((node) => depths.has(node.code));
  return {
    nodes: included.map((node) => ({
      code: node.code,
      depth: depths.get(node.code) ?? 0,
    })),
    edges: included.flatMap((node) =>
      Array.from(new Set(node.prerequisiteOptions.flat())).map((from) => ({
        from,
        to: node.code,
        alternative: node.prerequisiteOptions.some(
          (option) => !option.includes(from),
        ),
      })),
    ),
  };
};

export const orderPrerequisiteGraph = (
  graph: RequirementGraph,
  strategy: StackingOrder,
): string[] => {
  if (strategy === 'depth')
    return [...graph.nodes]
      .sort((a, b) => a.depth - b.depth)
      .map((node) => node.code);
  const children = new Map(
    graph.nodes.map((node) => [
      node.code,
      graph.edges
        .filter((edge) => edge.from === node.code)
        .map((edge) => edge.to),
    ]),
  );
  const priority = new Map<string, number>();
  const visit = (code: string) => {
    if (priority.has(code)) return;
    priority.set(code, priority.size);
    (children.get(code) ?? []).forEach(visit);
  };
  graph.nodes
    .filter((node) => node.depth === 0)
    .forEach((node) => visit(node.code));
  const placed = new Set<string>();
  while (placed.size < graph.nodes.length) {
    const ready = graph.nodes
      .filter(
        (node) =>
          !placed.has(node.code) &&
          graph.edges
            .filter((edge) => edge.to === node.code)
            .every((edge) => placed.has(edge.from)),
      )
      .sort(
        (a, b) => (priority.get(a.code) ?? 0) - (priority.get(b.code) ?? 0),
      );
    if (!ready.length)
      throw new Error('Cannot stack a cyclic prerequisite graph.');
    placed.add(ready[0].code);
  }
  return Array.from(placed);
};

export const traceCoursePath = (
  edges: RequirementGraph['edges'],
  code: string | null,
) => {
  const courses = new Set<string>();
  const connections = new Set<string>();
  if (!code) return { courses, connections };
  const visit = (current: string) => {
    if (courses.has(current)) return;
    courses.add(current);
    edges.forEach((edge) => {
      if (edge.to !== current) return;
      connections.add(`${edge.from}→${edge.to}`);
      visit(edge.from);
    });
  };
  visit(code);
  return { courses, connections };
};
