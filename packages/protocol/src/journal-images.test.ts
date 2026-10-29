import { expect, it } from "vitest";
import { JournalSchema, TokenCommandSchema } from "./index";

const id = "12345678-1234-4234-8234-123456789abc";
it("retains authorized journal images and accepts bounded image references", () => {
  expect(
    JournalSchema.parse({ id, title: "Clue", body: "", visibility: "dm", version: 1, assetId: id })
      .assetId,
  ).toBe(id);
  expect(
    TokenCommandSchema.safeParse({
      type: "journal.create",
      payload: { journalId: id, title: "Clue", body: "", assetId: id },
    }).success,
  ).toBe(true);
  expect(
    TokenCommandSchema.safeParse({
      type: "journal.update",
      payload: {
        journalId: id,
        expectedVersion: 1,
        title: "Clue",
        body: "",
        visibility: "dm",
        assetId: "https://elsewhere/image.svg",
      },
    }).success,
  ).toBe(false);
});
it("accepts selected journal readers only as a bounded nonempty distinct selection", () => {
  const payload = {
    journalId: id,
    expectedVersion: 1,
    title: "Clue",
    body: "",
    visibility: "selected",
    recipientIds: [id],
  };
  expect(TokenCommandSchema.safeParse({ type: "journal.update", payload }).success).toBe(true);
  for (const recipientIds of [[], [id, id], Array(9).fill(id)])
    expect(
      TokenCommandSchema.safeParse({
        type: "journal.update",
        payload: { ...payload, recipientIds },
      }).success,
    ).toBe(false);
  expect(
    TokenCommandSchema.safeParse({
      type: "journal.update",
      payload: { ...payload, visibility: "shared" },
    }).success,
  ).toBe(false);
});
it("accepts explicit journal formatting while retaining old plain payloads", () => {
  const payload = {
    journalId: id,
    title: "Clue",
    body: "# Heading\n**Bold**",
    bodyFormat: "markdown",
  };
  expect(TokenCommandSchema.safeParse({ type: "journal.create", payload }).success).toBe(true);
  expect(
    TokenCommandSchema.safeParse({
      type: "journal.create",
      payload: { ...payload, bodyFormat: "html" },
    }).success,
  ).toBe(false);
  expect(JournalSchema.parse({ ...payload, id, visibility: "dm", version: 1 }).bodyFormat).toBe(
    "markdown",
  );
});
