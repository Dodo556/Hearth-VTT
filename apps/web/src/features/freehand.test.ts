import { describe, expect, it } from "vitest";
import { appendFreehandPoint, finishFreehand } from "./freehand";

describe("bounded freehand sampling", () => {
  it("retains corners and normalizes coordinates without turning a closed loop into a dot", () => {
    const path = [
      { x: 10.1234, y: 20.5678 },
      { x: 100, y: 20 },
      { x: 100, y: 100 },
      { x: 10.1234, y: 20.5678 },
    ];
    expect(finishFreehand(path)).toEqual({
      points: [
        { x: 10.12, y: 20.57 },
        { x: 100, y: 20 },
        { x: 100, y: 100 },
        { x: 10.12, y: 20.57 },
      ],
      simplified: false,
    });
  });
  it("ignores repeated samples and bounds memory throughout a long gesture", () => {
    let points = [{ x: 0, y: 0 }];
    let compacted = false;
    for (let i = 0; i < 10000; i++) {
      const next = appendFreehandPoint(points, { x: i / 10, y: 50 + 20 * Math.sin(i / 50) });
      points = next.points;
      compacted ||= next.simplified;
      expect(points.length).toBeLessThanOrEqual(256);
    }
    const saved = finishFreehand(points);
    expect(saved.points.length).toBeLessThanOrEqual(128);
    expect(saved.points[0]).toEqual({ x: 0, y: 0 });
    expect(saved.points.at(-1)).toEqual({ x: 999.9, y: 32.34 });
    expect(compacted).toBe(true);
    expect(appendFreehandPoint([{ x: 1, y: 1 }], { x: 1.001, y: 1.001 }).points).toEqual([
      { x: 1, y: 1 },
    ]);
    expect(finishFreehand(points)).toEqual(saved);
  });
  it("retains a visible excursion in a long closed stroke", () => {
    const points = Array.from({ length: 1025 }, (_, i) => ({
      x: 100 + 50 * Math.cos((i * Math.PI) / 512),
      y: 100 + 50 * Math.sin((i * Math.PI) / 512),
    }));
    const result = finishFreehand(points);
    expect(result.points.length).toBeLessThanOrEqual(128);
    expect(result.points.length).toBeGreaterThan(3);
    expect(result.points[0]).toEqual({ x: 150, y: 100 });
    expect(result.points.at(-1)).toEqual({ x: 150, y: 100 });
    expect(Math.min(...result.points.map((p) => p.x))).toBeLessThan(51);
    expect(result.simplified).toBe(true);
  });
});
