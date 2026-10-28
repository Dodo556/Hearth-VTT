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
