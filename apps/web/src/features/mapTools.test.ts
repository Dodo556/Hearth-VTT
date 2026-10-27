import { describe, expect, it } from "vitest";
import { clampScenePoint, measureSquares } from "./mapTools";

describe("scene-space ruler", () => {
  it("measures a 3-4-5 line in grid squares with one decimal", () => {
    expect(measureSquares({ x: 120, y: 100 }, { x: 300, y: 340 }, 60)).toBe(5);
    expect(measureSquares({ x: 0, y: 0 }, { x: 30, y: 0 }, 60)).toBe(0.5);
  });
  it("keeps both pointer and keyboard positions inside the scene", () => {
    expect(clampScenePoint({ x: -25, y: 1200 }, 1440, 960)).toEqual({ x: 0, y: 960 });
  });
});

it("shows pings only while their scene is active, shared and revealed", async () => {
  const { canPingPoint } = await import("./mapTools");
  const scene = {
    active: true,
    visibility: "shared" as const,
    width: 120,
    height: 60,
    gridSize: 60,
    fog: { enabled: true, columns: 2, rows: 1, revealed: "01" },
  };
  expect(canPingPoint(scene, { x: 30, y: 30 })).toBe(true);
  expect(canPingPoint(scene, { x: 90, y: 30 })).toBe(false);
  expect(canPingPoint({ ...scene, active: false }, { x: 30, y: 30 })).toBe(false);
  expect(canPingPoint({ ...scene, visibility: "dm" }, { x: 30, y: 30 })).toBe(false);
  expect(canPingPoint(scene, { x: 120, y: 30 })).toBe(false);
});
