// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { Journal, TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { JournalSharing } from "./JournalSharing";

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
afterEach(cleanup);
const page: Journal = {
  id: "12345678-1234-4234-8234-123456789abc",
  version: 1,
  title: "Clue",
  body: "Private",
  visibility: "dm",
};
const alice = {
  id: "22345678-1234-4234-8234-123456789abc",
  displayName: "Alice",
  role: "player" as const,
};
it("retains a failed selected audience and blocks saving when that reader is unavailable", async () => {
  const sent: TokenCommand[] = [];
  const props = {
    page,
    current: page,
    participants: [alice],
    available: true,
    disabled: false,
    onClose: () => {},
    send: async (c: TokenCommand) => {
      sent.push(c);
      throw new Error("Host offline");
    },
  };
  const { rerender } = render(createElement(JournalSharing, props));
  fireEvent.change(screen.getByLabelText("Share with"), { target: { value: "selected" } });
  expect(screen.getByRole("button", { name: "Save sharing" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Alice" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save sharing" })));
  expect(sent[0]).toMatchObject({
    type: "journal.update",
    payload: { visibility: "selected", recipientIds: [alice.id], expectedVersion: 1 },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Host offline");
  rerender(createElement(JournalSharing, { ...props, participants: [] }));
  expect(screen.getByRole("button", { name: "Save sharing" })).toBeDisabled();
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.change(screen.getByLabelText("Share with"), { target: { value: "dm" } });
  expect(screen.getByRole("button", { name: "Save sharing" })).toBeEnabled();
});
it("blocks stale sharing until explicit reload without overwriting the selection", () => {
  const props = {
    page,
    current: page,
    participants: [alice],
    available: true,
    disabled: false,
    onClose: () => {},
    send: async () => {},
  };
  const { rerender } = render(createElement(JournalSharing, props));
  fireEvent.change(screen.getByLabelText("Share with"), { target: { value: "selected" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Alice" }));
  rerender(
    createElement(JournalSharing, {
      ...props,
      current: { ...page, version: 2, visibility: "shared" },
    }),
  );
  expect(screen.getByRole("button", { name: "Save sharing" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Alice" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Reload sharing" }));
  expect(screen.getByLabelText("Share with")).toHaveValue("shared");
  expect(screen.getByRole("button", { name: "Save sharing" })).toBeEnabled();
});
