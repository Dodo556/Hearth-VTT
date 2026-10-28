import { DrawingTextSchema } from "@hearth/protocol";
import type { ScenePoint } from "./mapTools";

export function validDrawingText(text: string): boolean {
  return DrawingTextSchema.safeParse(text).success;
}

export function textDrawingBounds(start: ScenePoint, end: ScenePoint) {
  if (![start.x, start.y, end.x, end.y].every((v) => Number.isFinite(v) && v >= 0)) return null;
  const round = (v: number) => Math.round(v * 100) / 100;
  const left = round(Math.min(start.x, end.x)),
    top = round(Math.min(start.y, end.y));
  const right = round(Math.max(start.x, end.x)),
    bottom = round(Math.max(start.y, end.y));
  // Compare integer hundredths: 64.07 - 24.07 is slightly less than 40 in binary.
  const width = Math.round(right * 100) - Math.round(left * 100),
    height = Math.round(bottom * 100) - Math.round(top * 100);
  if (width < 4000 || width > 102400 || height < 3200 || height > 51200) return null;
  return { start: { x: left, y: top }, end: { x: right, y: bottom } };
}
