import { describe, expect, it } from "vitest";
import { DrawingSchema, TokenCommandSchema } from "./index";

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

describe("literal text drawings", () => {
  const id = "8f834642-e1a2-42f2-9c5b-a80b91991344";
  const payload = {
    sceneId: id,
    clientDrawingId: id,
    shape: "text",
    visibility: "shared",
    color: "#72b7e2",
    startX: 20,
    startY: 20,
    endX: 220,
    endY: 120,
    text: "<b>Keep</b> 🐉\nNorth gate",
  };
  const parse = (changes: Record<string, unknown>) =>
    TokenCommandSchema.safeParse({ type: "drawing.create", payload: { ...payload, ...changes } });
  it("preserves literal multiline text and counts Unicode scalars", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ text: "🐉".repeat(120) }).success).toBe(true);
    expect(parse({ text: "🐉".repeat(121) }).success).toBe(false);
    const { sceneId: _, clientDrawingId: __, ...saved } = payload;
    expect(DrawingSchema.parse({ id, ...saved }).text).toBe(payload.text);
  });
  it("rejects blank/control/too-many-line text and foreign shape fields", () => {
    for (const text of [undefined, "", " \n ", "bad\tlabel", "bad\u0000label", "a\nb\nc\nd\ne"])
      expect(parse({ text }).success).toBe(false);
    expect(parse({ text: "a\nb\nc\nd" }).success).toBe(true);
    expect(parse({ shape: "line" }).success).toBe(false);
    expect(
      parse({
        points: [
          { x: 20, y: 20 },
          { x: 200, y: 100 },
        ],
      }).success,
    ).toBe(false);
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
