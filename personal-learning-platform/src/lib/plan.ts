import type { Concept, Course, NextAction } from "../../shared/types";

export interface DueItem {
  course: Course;
  concept: Concept;
  due: string;
  mastery: number;
}
/** Every scheduled review across courses, earliest first. */
export function reviews(courses: Course[]): DueItem[] {
  return courses
    .flatMap((course) =>
      course.concepts.flatMap((concept) => {
        const s = course.state.concepts[concept.id];
        return s?.nextReview
          ? [{ course, concept, due: s.nextReview, mastery: s.mastery }]
          : [];
      }),
    )
    .sort((a, b) => a.due.localeCompare(b.due));
}

const weight: Record<NextAction["kind"], number> = {
  review: 0,
  diagnose: 1,
  practice: 2,
  explain: 3,
  transfer: 4,
};
/**
 * The single next step across all courses (the protocol's "one startable
 * 5–15 minute task"): due reviews, then repairing gaps, then new work.
 * Courses arrive most recently studied first, which breaks ties.
 */
export function nextStep(
  courses: Course[],
): { course: Course; action: NextAction } | null {
  const candidates = courses
    .map((course, i) => ({ course, action: course.state.nextAction, i }))
    .filter(
      (c): c is { course: Course; action: NextAction; i: number } =>
        !!c.action && !c.action.completed,
    );
  candidates.sort(
    (a, b) => weight[a.action.kind] - weight[b.action.kind] || a.i - b.i,
  );
  return candidates[0] ?? null;
}

export interface LineNode {
  concept: Concept;
  layer: number;
  row: number;
  x: number;
  y: number;
}
export interface LineEdge {
  from: string;
  to: string;
  kind: "parent" | "prerequisite";
}
/**
 * Lays a course out as a transit map: prerequisites flow left to right in
 * layers (longest path), rows ordered by a few barycentre sweeps so lines
 * cross less. Parent links that duplicate a prerequisite are drawn once.
 */
export function layoutLines(
  concepts: Concept[],
  spacing = { column: 168, row: 92, padX: 56, padY: 48 },
) {
  const ids = new Set(concepts.map((c) => c.id));
  const edges: LineEdge[] = [];
  for (const c of concepts) {
    for (const p of c.prerequisites)
      if (ids.has(p) && p !== c.id)
        edges.push({ from: p, to: c.id, kind: "prerequisite" });
    if (
      c.parentId &&
      ids.has(c.parentId) &&
      c.parentId !== c.id &&
      !c.prerequisites.includes(c.parentId)
    )
      edges.push({ from: c.parentId, to: c.id, kind: "parent" });
  }
  const incoming = new Map<string, string[]>();
  for (const e of edges)
    incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]);
  const layer = new Map<string, number>();
  const depth = (id: string, seen = new Set<string>()): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (seen.has(id)) return 0; // defensive: the server rejects cycles
    seen.add(id);
    const value = Math.max(
      0,
      ...(incoming.get(id) ?? []).map((p) => depth(p, seen) + 1),
    );
    layer.set(id, value);
    return value;
  };
  concepts.forEach((c) => depth(c.id));
  const layers: string[][] = [];
  concepts.forEach((c) => {
    const l = layer.get(c.id) ?? 0;
    (layers[l] ??= []).push(c.id);
  });
  const row = new Map<string, number>();
  const place = () =>
    layers.forEach((ids) => ids.forEach((id, i) => row.set(id, i)));
  place();
  const outgoing = new Map<string, string[]>();
  for (const e of edges)
    outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e.to]);
  const centre = (list: string[] | undefined, fallback: number) =>
    list?.length
      ? list.reduce((n, id) => n + (row.get(id) ?? 0), 0) / list.length
      : fallback;
  for (let sweep = 0; sweep < 4; sweep++) {
    const forward = sweep % 2 === 0;
    const order = forward ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const ids of order) {
      ids.sort(
        (a, b) =>
          centre(forward ? incoming.get(a) : outgoing.get(a), row.get(a)!) -
          centre(forward ? incoming.get(b) : outgoing.get(b), row.get(b)!),
      );
      ids.forEach((id, i) => row.set(id, i));
    }
  }
  const tallest = Math.max(1, ...layers.map((l) => l.length));
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const nodes: LineNode[] = layers.flatMap((ids, l) =>
    ids.map((id, i) => ({
      concept: byId.get(id)!,
      layer: l,
      row: i,
      x: spacing.padX + l * spacing.column,
      // centre short layers against the tallest one
      y: spacing.padY + (i + (tallest - ids.length) / 2) * spacing.row,
    })),
  );
  return {
    nodes,
    edges,
    width: spacing.padX * 2 + Math.max(0, layers.length - 1) * spacing.column,
    height: spacing.padY * 2 + (tallest - 1) * spacing.row + 36,
  };
}

/** Transit-style connector: run, turn with rounded corners, run. */
export function linePath(x1: number, y1: number, x2: number, y2: number) {
  if (Math.abs(y1 - y2) < 1) return `M${x1} ${y1}H${x2}`;
  const mid = x1 + (x2 - x1) / 2,
    r = Math.min(12, Math.abs(y2 - y1) / 2, Math.abs(x2 - x1) / 4),
    dir = y2 > y1 ? 1 : -1;
  return `M${x1} ${y1}H${mid - r}Q${mid} ${y1} ${mid} ${y1 + dir * r}V${y2 - dir * r}Q${mid} ${y2} ${mid + r} ${y2}H${x2}`;
}
