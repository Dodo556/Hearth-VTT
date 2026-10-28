import { describe, expect, it } from "vitest";
import { textDrawingBounds, validDrawingText } from "./textDrawings";

describe("text drawing placement", () => {
  it("normalizes reversed corners to hundredths without changing the authorized box", () => {
    expect(textDrawingBounds({ x: 220.1234, y: 120.5678 }, { x: 20.1234, y: 20.5678 })).toEqual({
      start: { x: 20.12, y: 20.57 },
      end: { x: 220.12, y: 120.57 },
    });
    expect(textDrawingBounds({ x: 0, y: 0 }, { x: 40, y: 32 })).not.toBeNull();
    expect(textDrawingBounds({ x: 0, y: 0 }, { x: 1024, y: 512 })).not.toBeNull();
    expect(textDrawingBounds({ x: 20.12, y: 20.57 }, { x: 60.12, y: 52.57 })).not.toBeNull();
    expect(textDrawingBounds({ x: 24.07, y: 20 }, { x: 64.07, y: 52 })).not.toBeNull();
  });
  it("rejects undersized, excessive, nonfinite and negative rectangles", () => {
    for (const end of [
      { x: 39.99, y: 32 },
      { x: 40, y: 31.99 },
      { x: 1024.01, y: 100 },
      { x: 100, y: 512.01 },
      { x: Infinity, y: 100 },
      { x: NaN, y: 100 },
      { x: -40, y: 100 },
    ])
      expect(textDrawingBounds({ x: 0, y: 0 }, end)).toBeNull();
  });
  it("accepts literal labels while enforcing the host's scalar and line limits", () => {
    expect(validDrawingText("<b>North gate</b> 🐉\nKeep left")).toBe(true);
    expect(validDrawingText("🐉".repeat(120))).toBe(true);
    for (const text of [
      "",
      " \n ",
      "🐉".repeat(121),
      "a\nb\nc\nd\ne",
      "bad\ttext",
      "bad\u0085text",
    ])
      expect(validDrawingText(text)).toBe(false);
  });
});
