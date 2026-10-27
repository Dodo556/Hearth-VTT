import { describe, expect, it } from "vitest";
import { TokenCommandSchema } from "./index";

describe("drawing commands", () => {
  const id = "8f834642-e1a2-42f2-9c5b-a80b91991344";
  const create = {
    type: "drawing.create",
    payload: {
      sceneId: id,
      clientDrawingId: id,
      shape: "line",
      visibility: "shared",
      color: "#e8bc6a",
      startX: 10,
      startY: 20,
      endX: 100,
      endY: 140,
    },
  };
  it("accepts a line or rectangle and a scene-scoped undo", () => {
    expect(TokenCommandSchema.safeParse(create).success).toBe(true);
    expect(
      TokenCommandSchema.safeParse({
        ...create,
        payload: { ...create.payload, shape: "rectangle", visibility: "dm" },
      }).success,
    ).toBe(true);
    expect(
      TokenCommandSchema.safeParse({ type: "drawing.undo", payload: { sceneId: id } }).success,
    ).toBe(true);
  });
  it("rejects malformed drawing requests", () => {
    for (const payload of [
      { ...create.payload, sceneId: "invalid" },
      { ...create.payload, shape: "freehand" },
      { ...create.payload, color: "javascript:bad" },
      { ...create.payload, startX: Infinity },
      { ...create.payload, extra: true },
    ])
      expect(TokenCommandSchema.safeParse({ ...create, payload }).success).toBe(false);
  });
});

describe("freehand geometry", () => {
  const id = "8f834642-e1a2-42f2-9c5b-a80b91991344";
  const payload = {
    sceneId: id,
    clientDrawingId: id,
    shape: "freehand",
    visibility: "shared",
    color: "#72b7e2",
    startX: 10,
    startY: 10,
    endX: 10,
    endY: 10,
    points: [
      { x: 10, y: 10 },
      { x: 40, y: 50 },
      { x: 10, y: 10 },
    ],
  };
  it("accepts closed paths and rejects missing, excessive, nonfinite or foreign geometry", () => {
    expect(TokenCommandSchema.safeParse({ type: "drawing.create", payload }).success).toBe(true);
    for (const points of [
      undefined,
      [],
      [{ x: 1, y: 1 }],
      Array.from({ length: 129 }, () => ({ x: 1, y: 1 })),
      [
        { x: 1, y: 1 },
        { x: Infinity, y: 2 },
      ],
      [
        { x: 1, y: 1, extra: true },
        { x: 2, y: 2 },
      ],
    ]) {
      expect(
        TokenCommandSchema.safeParse({ type: "drawing.create", payload: { ...payload, points } })
          .success,
      ).toBe(false);
    }
    expect(
      TokenCommandSchema.safeParse({
        type: "drawing.create",
        payload: { ...payload, shape: "line" },
      }).success,
    ).toBe(false);
  });
});
