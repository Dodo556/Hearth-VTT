import { expect, it } from "vitest";
import { RollSchema, ServerFrameSchema, TokenCommandSchema } from "./index";

const id = "cbff59be-bf0b-4ce0-b25c-44eea113961d";
it("accepts only dice input fields and bounded four-scope results", () => {
  const command = {
    type: "dice.roll",
    payload: { clientRollId: id, expression: "(2d6+3)*2", visibility: "blind" },
  };
  expect(TokenCommandSchema.safeParse(command).success).toBe(true);
  for (const payload of [
    { ...command.payload, total: 20 },
    { ...command.payload, rollerId: id },
    { ...command.payload, visibility: "everyone" },
    { ...command.payload, expression: "d".repeat(121) },
  ])
    expect(TokenCommandSchema.safeParse({ ...command, payload }).success).toBe(false);
  const result = {
    id,
    rollerId: id,
    rollerName: "Alice",
    expression: "2d6+3",
    normalizedExpression: "2d6+3",
    visibility: "gm",
    createdAt: 1,
    revision: 1,
    total: 7,
    dice: [{ count: 2, sides: 6, faces: [1, 3], subtotal: 4 }],
  };
  expect(RollSchema.safeParse(result).success).toBe(true);
  expect(RollSchema.safeParse({ ...result, total: Number.POSITIVE_INFINITY }).success).toBe(false);
  expect(
    ServerFrameSchema.safeParse({
      kind: "snapshot",
      schemaVersion: 1,
      streamId: id,
      revision: 1,
      role: "player",
      scenes: [],
      journals: [],
      actors: [],
      rolls: [result],
      serverTime: 1,
    }).success,
  ).toBe(true);
});
