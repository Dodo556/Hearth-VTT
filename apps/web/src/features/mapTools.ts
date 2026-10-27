import type { Scene } from "@hearth/protocol";
import { footprintRevealed } from "./fog";

export type MapTool = "measure" | "ping" | "draw" | null;
export type ScenePoint = { x: number; y: number };

export function clampScenePoint(point: ScenePoint, width: number, height: number): ScenePoint {
  return { x: Math.max(0, Math.min(width, point.x)), y: Math.max(0, Math.min(height, point.y)) };
}

export function measureSquares(start: ScenePoint, end: ScenePoint, gridSize: number): number {
  return Math.round((Math.hypot(end.x - start.x, end.y - start.y) / gridSize) * 10) / 10;
}

export function canPingPoint(
  scene: Pick<Scene, "active" | "visibility" | "width" | "height" | "gridSize" | "fog">,
  point: ScenePoint,
): boolean {
  const { x, y } = point;
  return (
    scene.active &&
    scene.visibility === "shared" &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    y >= 0 &&
    x < scene.width &&
    y < scene.height &&
    footprintRevealed(scene.fog, scene.gridSize, {
      x: Math.floor(x) + 0.5,
      y: Math.floor(y) + 0.5,
      size: 1,
    })
  );
}
