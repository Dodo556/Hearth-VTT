import type { Drawing } from "@hearth/protocol";
import { expect, it } from "vitest";
import { changeTextBox, hitDrawing } from "./drawingEditing";

const line: Drawing = {
  id: "line",
  version: 1,
  shape: "line",
  visibility: "shared",
  color: "#72b7e2",
  startX: 10,
  startY: 10,
  endX: 100,
  endY: 100,
};
it("hits actual strokes rather than empty bounding-box interiors and prefers the GM layer", () => {
  expect(hitDrawing([line], { x: 50, y: 50 }, 4)?.id).toBe("line");
  expect(hitDrawing([line], { x: 15, y: 90 }, 4)).toBeUndefined();
  const rectangle = { ...line, id: "rect", shape: "rectangle" as const };
  expect(hitDrawing([rectangle], { x: 50, y: 50 }, 4)).toBeUndefined();
  expect(hitDrawing([rectangle], { x: 10, y: 50 }, 4)?.id).toBe("rect");
  const stroke = {
    ...line,
    id: "stroke",
    shape: "freehand" as const,
    points: [
      { x: 10, y: 10 },
      { x: 100, y: 10 },
      { x: 10, y: 10 },
    ],
  };
  expect(hitDrawing([stroke], { x: 50, y: 10 }, 4)?.id).toBe("stroke");
  expect(hitDrawing([stroke], { x: 50, y: 50 }, 4)).toBeUndefined();
  const privateLine = { ...line, id: "private", visibility: "dm" as const };
  expect(hitDrawing([privateLine, line], { x: 50, y: 50 }, 4)?.id).toBe("private");
  const text = { ...line, id: "text", shape: "text" as const, text: "Gate" };
  expect(hitDrawing([text, line], { x: 50, y: 50 }, 4)?.id).toBe("text");
});
it("moves and resizes a text box inside the scene without violating minimum dimensions", () => {
  const box = { start: { x: 20, y: 30 }, end: { x: 260, y: 126 } };
  expect(changeTextBox(box, 1000, 1000, 400, 300, false)).toEqual({
    start: { x: 160, y: 204 },
    end: { x: 400, y: 300 },
  });
  expect(changeTextBox(box, -1000, -1000, 400, 300, true)).toEqual({
    start: { x: 20, y: 30 },
    end: { x: 60, y: 62 },
  });
  expect(changeTextBox(box, 1000, 1000, 400, 300, true)).toEqual({
    start: { x: 20, y: 30 },
    end: { x: 400, y: 300 },
  });
});
