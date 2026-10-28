// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { JournalFolderManager } from "./JournalFolderManager";

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
});
it("keeps a removed draft destination explicit and allows choosing Top level", () => {
  const folder = {
    id: "12345678-1234-4234-8234-123456789abc",
    parentId: null,
    name: "Transient",
    version: 1,
  };
  const props = {
    folders: [folder],
    journals: [],
    disabled: false,
    send: async () => {},
    onClose: () => {},
  };
  const { rerender } = render(<JournalFolderManager {...props} />);
  fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Draft folder" } });
  fireEvent.change(screen.getByLabelText("Parent folder"), { target: { value: folder.id } });
  rerender(<JournalFolderManager {...props} folders={[]} />);
  expect(screen.getByRole("option", { name: "Removed folder" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Create folder" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Parent folder"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Create folder" })).toBeEnabled();
  expect(screen.getByLabelText("Folder name")).toHaveValue("Draft folder");
});
it("shows a still-existing parent that becomes ineligible after another GM moves it", () => {
  const folders = [
    { id: "a", parentId: null, name: "A", version: 1 },
    { id: "b", parentId: "a", name: "B", version: 1 },
    { id: "c", parentId: "b", name: "C", version: 1 },
    { id: "d", parentId: null, name: "Destination", version: 1 },
  ];
  const props = { folders, journals: [], disabled: false, send: async () => {}, onClose: () => {} };
  const { rerender } = render(<JournalFolderManager {...props} />);
  fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Keep this draft" } });
  fireEvent.change(screen.getByLabelText("Parent folder"), { target: { value: "d" } });
  rerender(
    <JournalFolderManager
      {...props}
      folders={folders.map((f) => (f.id === "d" ? { ...f, parentId: "c", version: 2 } : f))}
    />,
  );
  expect(screen.getByRole("option", { name: "Unavailable folder" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Create folder" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Parent folder"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Create folder" })).toBeEnabled();
  expect(screen.getByLabelText("Folder name")).toHaveValue("Keep this draft");
});
it("blocks a draft parent that becomes a descendant without changing the source version", () => {
  const folder = { id: "moving", parentId: null, name: "Source", version: 1 };
  const destination = { id: "destination", parentId: null, name: "Destination", version: 1 };
  const props = {
    folder,
    folders: [folder, destination],
    journals: [],
    disabled: false,
    send: async () => {},
    onClose: () => {},
  };
  const { rerender } = render(<JournalFolderManager {...props} />);
  fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Rename draft" } });
  fireEvent.change(screen.getByLabelText("Parent folder"), { target: { value: destination.id } });
  rerender(
    <JournalFolderManager
      {...props}
      folders={[folder, { ...destination, parentId: folder.id, version: 2 }]}
    />,
  );
  expect(screen.getByRole("option", { name: "Unavailable folder" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save folder" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Parent folder"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Save folder" })).toBeEnabled();
  expect(screen.getByLabelText("Folder name")).toHaveValue("Rename draft");
});
