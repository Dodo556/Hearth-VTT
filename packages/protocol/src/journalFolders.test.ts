import { expect, it } from "vitest";
import { TokenCommandSchema } from "./index";

const id = "12345678-1234-4234-8234-123456789abc";
it("accepts guarded folder commands and requires explicit nullable destinations", () => {
  const command = {
    type: "journal.folder.create",
    payload: { folderId: id, name: "Locations", parentId: null },
  };
  expect(TokenCommandSchema.safeParse(command).success).toBe(true);
  for (const payload of [
    { folderId: id, name: "Locations" },
    { ...command.payload, name: " " },
    { ...command.payload, name: "x".repeat(61) },
    { ...command.payload, unknown: true },
  ])
    expect(TokenCommandSchema.safeParse({ ...command, payload }).success).toBe(false);
  expect(
    TokenCommandSchema.safeParse({
      type: "journal.move",
      payload: { journalId: id, expectedVersion: 1, folderId: null },
    }).success,
  ).toBe(true);
  expect(
    TokenCommandSchema.safeParse({
      type: "journal.move",
      payload: { journalId: id, expectedVersion: 1 },
    }).success,
  ).toBe(false);
});
