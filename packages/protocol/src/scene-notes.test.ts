import { expect, it } from "vitest";
import { TokenCommandSchema } from "./index";

it("accepts scoped scene note saves with a guarded initial version", () => {
  const payload = {
    sceneId: "12345678-1234-4234-8234-123456789abc",
    visibility: "dm",
    body: "<b>Literal 🐉</b>\n\tWait",
    expectedVersion: 0,
  };
  const parse = (extra: object = {}) =>
    TokenCommandSchema.safeParse({ type: "scene.notes.update", payload: { ...payload, ...extra } })
      .success;
  expect(parse()).toBe(true);
  expect(parse({ body: "🐉".repeat(1000), visibility: "shared", expectedVersion: 2 })).toBe(true);
  for (const extra of [
    { body: "a".repeat(1001) },
    { body: "bad\u0001" },
    { body: "bad\u0085" },
    { expectedVersion: -1 },
    { expectedVersion: Number.MAX_SAFE_INTEGER },
    { expectedVersion: 0.5 },
    { visibility: "player" },
    { owner: true },
  ])
    expect(parse(extra)).toBe(false);
  expect(parse({ body: "" })).toBe(true);
});
