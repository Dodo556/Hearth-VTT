// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { Journal, TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { Journals } from "./Journals";

afterEach(cleanup);
const page: Journal = {
  id: "12345678-1234-4234-8234-123456789abc",
  title: "Clue",
  body: "<script>secret()</script>\nNext line",
  visibility: "dm",
  version: 1,
};
it("keeps a stale journal draft until explicit reload and blocks stale saves", () => {
  const props = {
    journals: [page],
    dm: true,
    disabled: false,
    send: async (_: TokenCommand) => {},
  };
  const { rerender, container } = render(createElement(Journals, props));
  expect(container.querySelector("script")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
  fireEvent.change(screen.getByLabelText("Page text"), { target: { value: "Local draft" } });
  rerender(
    createElement(Journals, { ...props, journals: [{ ...page, version: 2, body: "Remote edit" }] }),
  );
  expect((screen.getByLabelText("Page text") as HTMLTextAreaElement).value).toBe("Local draft");
  expect(screen.getByRole("button", { name: "Save private page" }).hasAttribute("disabled")).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
  expect((screen.getByLabelText("Page text") as HTMLTextAreaElement).value).toBe("Remote edit");
  expect(screen.getByRole("button", { name: "Save private page" }).hasAttribute("disabled")).toBe(
    false,
  );
});
it("creates private pages and exposes errors without losing the draft", async () => {
  const sent: TokenCommand[] = [];
  const send = async (command: TokenCommand) => {
    sent.push(command);
    throw new Error("Host unavailable");
  };
  render(createElement(Journals, { journals: [], dm: true, disabled: false, send }));
  fireEvent.click(screen.getByRole("button", { name: "New page" }));
  fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "New clue" } });
  fireEvent.change(screen.getByLabelText("Page text"), { target: { value: "Keep this draft" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create private page" }));
  });
  expect(sent[0]).toMatchObject({
    type: "journal.create",
    payload: { title: "New clue", body: "Keep this draft" },
  });
  expect(screen.getByRole("alert").textContent).toContain("Host unavailable");
  expect((screen.getByLabelText("Page text") as HTMLTextAreaElement).value).toBe("Keep this draft");
});
it("filters authorized page content and offers private folder organization only to GMs", () => {
  const folders = [
    { id: "22345678-1234-4234-8234-123456789abc", parentId: null, name: "GM secrets", version: 1 },
  ];
  const props = {
    journals: [page],
    folders,
    dm: true,
    disabled: false,
    send: async (_: TokenCommand) => {},
  };
  const { rerender } = render(createElement(Journals, props));
  expect(screen.getByRole("button", { name: "New folder" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Search pages"), { target: { value: "not present" } });
  expect(screen.getByText("No matching pages.")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Search pages"), { target: { value: "next line" } });
  expect(screen.getByRole("heading", { name: "Clue" })).toBeVisible();
  rerender(createElement(Journals, { ...props, folders: [], dm: false }));
  expect(screen.queryByRole("button", { name: "New folder" })).toBeNull();
  expect(screen.queryByText("GM secrets")).toBeNull();
});
it("retains a new page draft when its selected folder is deleted", () => {
  const folder = {
    id: "22345678-1234-4234-8234-123456789abc",
    parentId: null,
    name: "Temporary",
    version: 1,
  };
  const props = {
    journals: [],
    folders: [folder],
    dm: true,
    disabled: false,
    send: async (_: TokenCommand) => {},
  };
  const { rerender } = render(createElement(Journals, props));
  fireEvent.click(screen.getByRole("button", { name: "New page" }));
  fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "Kept title" } });
  fireEvent.change(screen.getByLabelText("Page folder"), { target: { value: folder.id } });
  rerender(createElement(Journals, { ...props, folders: [] }));
  expect(screen.getByRole("option", { name: "Removed folder" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Create private page" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Page folder"), { target: { value: "" } });
  expect(screen.getByLabelText("Page title")).toHaveValue("Kept title");
  expect(screen.getByRole("button", { name: "Create private page" })).toBeEnabled();
});
