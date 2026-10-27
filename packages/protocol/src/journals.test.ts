import { expect, it } from "vitest";
import { JournalSchema, TokenCommandSchema } from "./index";

it("accepts versioned journal edits and rejects unguarded or forged sharing", () => {
  const id = "12345678-1234-4234-8234-123456789abc";
  expect(
    JournalSchema.parse({ id, title: "Page", body: "", visibility: "dm", version: 3 }).version,
  ).toBe(3);
  const payload = {
    journalId: id,
    expectedVersion: 3,
    title: "Page",
    body: "line\ntext",
    visibility: "shared",
  };
  expect(TokenCommandSchema.safeParse({ type: "journal.update", payload }).success).toBe(true);
  expect(
    TokenCommandSchema.safeParse({
      type: "journal.update",
      payload: { ...payload, expectedVersion: 0 },
    }).success,
  ).toBe(false);
  expect(
    TokenCommandSchema.safeParse({
      type: "journal.create",
      payload: { journalId: id, title: "Page", body: "", visibility: "shared" },
    }).success,
  ).toBe(false);
});
