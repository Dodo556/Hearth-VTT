import { expect, it } from "vitest";
import { formatJournalSelection } from "./journalFormatting";

it("formats only the selected text and returns the editable inner range", () => {
  expect(formatJournalSelection("Meet Alice", 5, 10, "Bold")).toEqual({
    body: "Meet **Alice**",
    start: 7,
    end: 12,
  });
  expect(formatJournalSelection("", 0, 0, "Italic")).toEqual({ body: "*text*", start: 1, end: 5 });
});
it("formats complete lines without losing surrounding text or Unicode", () => {
  expect(formatJournalSelection("Keep\n🧙 one\ntwo\nLast", 6, 14, "Bullet list")?.body).toBe(
    "Keep\n- 🧙 one\n- two\nLast",
  );
  expect(formatJournalSelection("one\ntwo", 0, 7, "Checklist")?.body).toBe("- [ ] one\n- [ ] two");
});
it("refuses markup that exceeds the persisted Unicode limit without truncating", () => {
  expect(formatJournalSelection("🧙".repeat(998), 0, 0, "Bold")).toBeNull();
  expect(formatJournalSelection("🧙".repeat(996), 0, 1992, "Bold")?.body).toBe(
    `**${"🧙".repeat(996)}**`,
  );
});
