import { expect, it } from "vitest";
import { TokenCommandSchema } from "./index";

const id = "12345678-1234-4234-8234-123456789abc";
it("accepts only bounded actor copy references and an independent name", () => {
  const payload = { sourceActorId: id, expectedVersion: 1, actorId: id, name: "Private NPC" };
  expect(TokenCommandSchema.safeParse({ type: "actor.copy", payload }).success).toBe(true);
  for (const extra of [
    { visibility: "shared" },
    { permissions: [] },
    { hp: 999 },
    { assetId: id },
    { dmNotes: "forged" },
    { sourceActorId: "bad" },
    { expectedVersion: 0 },
    { expectedVersion: Number.MAX_SAFE_INTEGER },
    { name: " " },
    { name: "x".repeat(81) },
  ])
    expect(
      TokenCommandSchema.safeParse({ type: "actor.copy", payload: { ...payload, ...extra } })
        .success,
    ).toBe(false);
});
