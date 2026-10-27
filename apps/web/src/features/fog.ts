import type { Scene } from "@hearth/protocol";
export type Fog = Scene["fog"];
export type FogTool = "select" | "reveal" | "hide";
export type FogRect = { column: number; row: number; width: number; height: number };
const revealed = (fog: Fog, index: number) =>
  (Number.parseInt(fog.revealed.slice((index >> 3) * 2, (index >> 3) * 2 + 2), 16) &
    (1 << (index % 8))) !==
  0;
// Display helper only; server projection and movement independently enforce access.
export function footprintRevealed(
  fog: Fog,
  grid: number,
  token: { x: number; y: number; size: number },
) {
  if (!fog.enabled) return true;
  const { x, y, size } = token;
  const left = Math.floor((x - size / 2) / grid),
    right = Math.ceil((x + size / 2) / grid);
  const top = Math.floor((y - size / 2) / grid),
    bottom = Math.ceil((y + size / 2) / grid);
  if (
    !Number.isFinite(x + y + size) ||
    size <= 0 ||
    left < 0 ||
    top < 0 ||
    right > fog.columns ||
    bottom > fog.rows
  )
    return false;
  for (let r = top; r < bottom; r++)
    for (let c = left; c < right; c++) if (!revealed(fog, r * fog.columns + c)) return false;
  return true;
}
export function fogPixels(fog: Fog) {
  const pixels = new Uint8ClampedArray(fog.columns * fog.rows * 4);
  for (let i = 0; i < fog.columns * fog.rows; i++)
    pixels.set([9, 15, 19, fog.enabled && !revealed(fog, i) ? 255 : 0], i * 4);
  return pixels;
}
export function fogRectangle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  grid: number,
  width: number,
  height: number,
): FogRect {
  const col = (x: number) =>
    Math.max(0, Math.min(Math.ceil(width / grid) - 1, Math.floor(x / grid)));
  const row = (y: number) =>
    Math.max(0, Math.min(Math.ceil(height / grid) - 1, Math.floor(y / grid)));
  const column = Math.min(col(a.x), col(b.x)),
    r = Math.min(row(a.y), row(b.y));
  return {
    column,
    row: r,
    width: Math.abs(col(a.x) - col(b.x)) + 1,
    height: Math.abs(row(a.y) - row(b.y)) + 1,
  };
}
