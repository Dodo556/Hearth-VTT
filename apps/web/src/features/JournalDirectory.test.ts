import { expect, it } from "vitest";
import { folderChoices } from "./JournalDirectory";

const folders = [
  { id: "a", parentId: null, name: "A", version: 1 },
  { id: "b", parentId: "a", name: "B", version: 1 },
  { id: "c", parentId: "b", name: "C", version: 1 },
  { id: "d", parentId: "c", name: "D", version: 1 },
  { id: "other", parentId: null, name: "Other", version: 1 },
];
it("keeps depth-four folders available for pages but not another folder level", () => {
  expect(folderChoices(folders).map((f) => f.id)).toContain("d");
  expect(folderChoices(folders, undefined, true).map((f) => f.id)).not.toContain("d");
});
it("excludes descendants and destinations too deep for a moved subtree", () => {
  expect(folderChoices(folders, "a", true)).toEqual([]);
  expect(folderChoices(folders, "c", true).map((f) => f.id)).toEqual(["a", "b", "other"]);
});
