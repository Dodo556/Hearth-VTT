import type { ScenePoint } from "./mapTools";

const normalized = (p: ScenePoint): ScenePoint => ({
  x: Math.round(p.x * 100) / 100,
  y: Math.round(p.y * 100) / 100,
});
const same = (a: ScenePoint, b: ScenePoint) => a.x === b.x && a.y === b.y;

// Iterative Ramer–Douglas–Peucker: bounded drafts avoid recursion and unbounded work.
function simplify(points: ScenePoint[], tolerance: number): ScenePoint[] {
  const keep = new Set([0, points.length - 1]);
  const pending: [number, number][] = [[0, points.length - 1]];
  while (pending.length) {
    const range = pending.pop();
    if (!range) break;
    const [first, last] = range;
    const a = points[first],
      b = points[last];
    if (!a || !b) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    let farthest = -1,
      distance = tolerance * tolerance;
    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      if (!p) continue;
      const t = length
        ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
        : 0;
      const d = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
      if (d > distance) {
        distance = d;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep.add(farthest);
      pending.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, i) => keep.has(i));
}

export function finishFreehand(input: ScenePoint[]): { points: ScenePoint[]; simplified: boolean } {
  const points: ScenePoint[] = [];
  for (const p of input) {
    const next = normalized(p);
    const last = points.at(-1);
    if (!last || !same(last, next)) points.push(next);
  }
  if (points.length <= 128) return { points, simplified: false };
  let tolerance = 0.5;
  let result = simplify(points, tolerance);
  while (result.length > 128) {
    tolerance *= 2;
    result = simplify(points, tolerance);
  }
  // A closed loop must retain an excursion even at the coarsest tolerance.
  if (result.length === 2 && result[0] && result[1] && same(result[0], result[1])) {
    const start = result[0];
    let farthest = start,
      distance = 0;
    for (const p of points) {
      const d = (p.x - start.x) ** 2 + (p.y - start.y) ** 2;
      if (d > distance) {
        distance = d;
        farthest = p;
      }
    }
    result = [start, farthest, start];
  }
  return { points: result, simplified: true };
}

export function appendFreehandPoint(
  points: ScenePoint[],
  point: ScenePoint,
): { points: ScenePoint[]; simplified: boolean } {
  const next = normalized(point);
  const last = points.at(-1);
  if (last && same(last, next)) return { points, simplified: false };
  const updated = [...points, next];
  return updated.length > 256 ? finishFreehand(updated) : { points: updated, simplified: false };
}
