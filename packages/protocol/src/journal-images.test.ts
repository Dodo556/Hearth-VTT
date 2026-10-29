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
