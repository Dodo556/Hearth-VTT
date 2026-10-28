import type { Drawing } from "@hearth/protocol";
import type { ScenePoint } from "./mapTools";

export type TextDraft = {
  drawingId?: string;
  expectedVersion?: number;
  start: ScenePoint;
  end: ScenePoint;
  text: string;
  color: string;
  fontSize: number;
  visibility: "shared" | "dm";
};
export type TextBox = Pick<TextDraft, "start" | "end">;
export function changeTextBox(
  box: TextBox,
  dx: number,
  dy: number,
  width: number,
  height: number,
  resize: boolean,
): TextBox {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return box;
  const w = box.end.x - box.start.x,
    h = box.end.y - box.start.y;
  if (resize)
    return {
      start: box.start,
      end: {
        x: Math.max(box.start.x + 40, Math.min(width, box.start.x + 1024, box.end.x + dx)),
        y: Math.max(box.start.y + 32, Math.min(height, box.start.y + 512, box.end.y + dy)),
      },
    };
  const x = Math.max(0, Math.min(width - w, box.start.x + dx)),
    y = Math.max(0, Math.min(height - h, box.start.y + dy));
  return { start: { x, y }, end: { x: x + w, y: y + h } };
}
const segmentDistance = (p: ScenePoint, a: ScenePoint, b: ScenePoint) => {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
export function hitDrawing(
  drawings: Drawing[],
  p: ScenePoint,
  tolerance: number,
): Drawing | undefined {
  // Text children render above primitive strokes within each visibility layer.
  const ordered = (["shared", "dm"] as const).flatMap((visibility) => {
    const layer = drawings.filter((d) => d.visibility === visibility);
    return [...layer.filter((d) => d.shape !== "text"), ...layer.filter((d) => d.shape === "text")];
  });
  return ordered.reverse().find((d) => {
    const a = { x: d.startX, y: d.startY },
      b = { x: d.endX, y: d.endY };
    if (d.shape === "text")
      return (
        p.x >= Math.min(a.x, b.x) &&
        p.x <= Math.max(a.x, b.x) &&
        p.y >= Math.min(a.y, b.y) &&
        p.y <= Math.max(a.y, b.y)
      );
    const points =
      d.shape === "freehand"
        ? (d.points ?? [])
        : d.shape === "rectangle"
          ? [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a]
          : [a, b];
    return points.slice(1).some((point, i) => {
      const previous = points[i];
      return previous !== undefined && segmentDistance(p, previous, point) <= tolerance;
    });
  });
}
