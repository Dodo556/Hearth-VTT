// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { Journal, TokenCommand } from "@hearth/protocol";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Journals } from "./Journals";

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
  vi.unstubAllGlobals();
});
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
it("reveals a saved image only through a versioned journal save and retains failed scope", async () => {
  const sent: TokenCommand[] = [];
  render(
    createElement(Journals, {
      journals: [{ ...page, assetId: page.id }],
      dm: true,
      disabled: false,
      send: async (c: TokenCommand) => {
        sent.push(c);
        throw new Error("Share failed");
      },
    }),
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Reveal to players" }));
  });
  expect(sent[0]).toMatchObject({
    type: "journal.update",
    payload: { journalId: page.id, expectedVersion: 1, visibility: "shared", assetId: page.id },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Share failed");
  expect(screen.getByRole("button", { name: "Reveal to players" })).toBeEnabled();
});

it("keeps uploaded image changes private and preserves the draft after a rejected save", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            asset: { id: page.id, width: 160, height: 160, byteSize: 1024 },
          }),
          { status: 200 },
        ),
    ),
  );
  const sent: TokenCommand[] = [];
  render(
    createElement(Journals, {
      campaignId: page.id,
      journals: [{ ...page, visibility: "shared" }],
      dm: true,
      disabled: false,
      send: async (c: TokenCommand) => {
        sent.push(c);
        throw new Error("Save rejected");
      },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Handout image"), {
      target: { files: [new File(["fixture"], "clue.png", { type: "image/png" })] },
    });
  });
  expect(screen.getByLabelText("Page visibility")).toHaveValue("dm");
  expect(screen.getByRole("option", { name: "Shared with players" })).toBeDisabled();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save private page" }));
  });
  expect(sent[0]).toMatchObject({
    payload: { assetId: page.id, visibility: "dm", expectedVersion: 1 },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Save rejected");
  expect(screen.getByLabelText("Page title")).toHaveValue("Clue");
  fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
  expect(screen.queryByRole("img", { name: "Handout preview" })).toBeNull();
});

it("reuses only a saved source reference and keeps a failed private-copy title", async () => {
  const sent: TokenCommand[] = [];
  render(
    createElement(Journals, {
      journals: [{ ...page, visibility: "selected", recipientIds: [page.id] }],
      dm: true,
      disabled: false,
      send: async (c: TokenCommand) => {
        sent.push(c);
        throw new Error("Copy rejected");
      },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Use as template" }));
  fireEvent.change(screen.getByLabelText("Copy title"), { target: { value: "Independent clue" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create private copy" }));
  });
  expect(sent[0]).toEqual({
    type: "journal.copy",
    payload: {
      sourceJournalId: page.id,
      expectedVersion: 1,
      journalId: expect.any(String),
      title: "Independent clue",
    },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Copy rejected");
  expect(screen.getByLabelText("Copy title")).toHaveValue("Independent clue");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create private copy" }));
  });
  expect(sent[1]).toEqual(sent[0]);
});
it("requires explicit template reload after source changes and preserves the copy title", async () => {
  const sent: TokenCommand[] = [];
  const props = {
    journals: [page],
    dm: true,
    disabled: false,
    send: async (c: TokenCommand) => {
      sent.push(c);
    },
  };
  const { rerender } = render(createElement(Journals, props));
  fireEvent.click(screen.getByRole("button", { name: "Use as template" }));
  fireEvent.change(screen.getByLabelText("Copy title"), { target: { value: "Kept name" } });
  rerender(createElement(Journals, { ...props, journals: [{ ...page, version: 2 }] }));
  expect(screen.getByRole("button", { name: "Create private copy" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reload template" }));
  expect(screen.getByLabelText("Copy title")).toHaveValue("Kept name");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create private copy" }));
  });
  expect(sent[0]).toMatchObject({
    type: "journal.copy",
    payload: { expectedVersion: 2, title: "Kept name" },
  });
});
it("never offers reuse to players and blocks it when offline or full", () => {
  const props = {
    journals: [page],
    dm: false,
    disabled: false,
    send: async (_: TokenCommand) => {},
  };
  const { rerender } = render(createElement(Journals, props));
  expect(screen.queryByRole("button", { name: "Use as template" })).toBeNull();
  rerender(createElement(Journals, { ...props, dm: true, disabled: true }));
  expect(screen.getByRole("button", { name: "Use as template" })).toBeDisabled();
  rerender(
    createElement(Journals, {
      ...props,
      dm: true,
      journals: Array.from({ length: 16 }, (_, i) => ({ ...page, id: `${i}` })),
    }),
  );
  expect(screen.getByRole("button", { name: "Use as template" })).toBeDisabled();
});
it("keeps a copy title when its template disappears or the campaign fills", () => {
  const props = {
    journals: [page],
    dm: true,
    disabled: false,
    send: async (_: TokenCommand) => {},
  };
  const { rerender } = render(createElement(Journals, props));
  fireEvent.click(screen.getByRole("button", { name: "Use as template" }));
  fireEvent.change(screen.getByLabelText("Copy title"), { target: { value: "Kept copy" } });
  rerender(createElement(Journals, { ...props, journals: [] }));
  expect(screen.getByRole("status")).toHaveTextContent("removed");
  expect(screen.queryByRole("button", { name: "Reload template" })).toBeNull();
  expect(screen.getByRole("button", { name: "Create private copy" })).toBeDisabled();
  rerender(
    createElement(Journals, {
      ...props,
      journals: [page, ...Array.from({ length: 15 }, (_, i) => ({ ...page, id: `${i}` }))],
    }),
  );
  expect(screen.getByLabelText("Copy title")).toHaveValue("Kept copy");
  expect(screen.getByRole("button", { name: "Create private copy" })).toBeDisabled();
});
it("opens a committed copy after uncertain confirmation even when its source disappears", async () => {
  const sent: TokenCommand[] = [];
  const props = {
    journals: [page],
    dm: true,
    disabled: false,
    send: async (c: TokenCommand) => {
      sent.push(c);
      throw new Error("Confirmation timed out");
    },
  };
  const { rerender } = render(createElement(Journals, props));
  fireEvent.click(screen.getByRole("button", { name: "Use as template" }));
  fireEvent.change(screen.getByLabelText("Copy title"), {
    target: { value: "Saved despite timeout" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create private copy" }));
  });
  const command = sent[0];
  if (command?.type !== "journal.copy") throw new Error("Expected journal copy");
  const copied = { ...page, id: command.payload.journalId, title: "Saved despite timeout" };
  rerender(
    createElement(Journals, {
      ...props,
      disabled: true,
      journals: [copied, ...Array.from({ length: 15 }, (_, i) => ({ ...page, id: `other-${i}` }))],
    }),
  );
  expect(screen.getByLabelText("Copy title")).toHaveValue("Saved despite timeout");
  expect(screen.getByRole("button", { name: "Create private copy" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Open saved copy" }));
  expect(sent).toHaveLength(1);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", { name: "Saved despite timeout" })).toBeVisible();
});
