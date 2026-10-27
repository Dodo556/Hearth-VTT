// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BackupRecovery } from "./BackupRecovery";

const summary = {
  formatVersion: 1,
  schemaVersion: 10,
  appVersion: "0.0.10",
  createdAt: 100,
  counts: {
    users: 3,
    campaigns: 1,
    scenes: 2,
    tokens: 3,
    actors: 3,
    journals: 2,
    messages: 4,
    rolls: 1,
    encounters: 1,
    assets: 1,
  },
};
const backup = {
  id: "cbff59be-bf0b-4ce0-b25c-44eea113961d",
  byteSize: 65536,
  sha256: "a".repeat(64),
  summary,
};
const originalShow = HTMLDialogElement.prototype.showModal,
  originalClose = HTMLDialogElement.prototype.close;
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  HTMLDialogElement.prototype.showModal = originalShow;
  HTMLDialogElement.prototype.close = originalClose;
});
function Example() {
  const [open, setOpen] = useState(true);
  return open ? <BackupRecovery onClose={() => setOpen(false)} /> : null;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Example />
    </QueryClientProvider>,
  );
  return client;
}
const state = {
  schemaVersion: 1,
  dataDirectory: "/fictional/hearth",
  prepared: null,
  verified: null,
  lastRestore: null,
};
it("changing the chosen file invalidates its previous verification even when status retains the old receipt", async () => {
  let checks = 0;
  let verified: unknown = null;
  vi.stubGlobal("fetch", async (path: string) => {
    if (path.endsWith("/verify")) {
      checks++;
      if (checks === 2)
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            error: { code: "INVALID_BACKUP", message: "Invalid backup" },
          }),
          { status: 422 },
        );
      verified = { ...backup, expiresAt: 253402300799 };
      return Response.json({ schemaVersion: 1, verification: verified });
    }
    return Response.json({ ...state, verified });
  });
  mount();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Prepare host backup" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Backup file"), {
    target: { files: [new File(["valid"], "first.hearthbackup")] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify backup" }));
  await screen.findByRole("heading", { name: "Verified backup" });
  expect(
    screen.getByRole("button", { name: "Create recovery copy" }).hasAttribute("disabled"),
  ).toBe(false);
  fireEvent.change(screen.getByLabelText("Backup file"), {
    target: { files: [new File(["invalid"], "second.hearthbackup")] },
  });
  expect(screen.queryByRole("heading", { name: "Verified backup" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Create recovery copy" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Verify backup" }));
  await screen.findByText("Invalid backup");
  expect(
    screen.getByRole("button", { name: "Create recovery copy" }).hasAttribute("disabled"),
  ).toBe(true);
});
it("keeps the modal open during preparation and offers the real download only after a host receipt", async () => {
  let resolve: (r: Response) => void = () => {};
  let prepared: unknown = null;
  vi.stubGlobal("fetch", async (_path: string, options?: RequestInit) => {
    if (options?.method === "POST")
      return new Promise<Response>((done) => {
        resolve = (r) => {
          prepared = backup;
          done(r);
        };
      });
    return Response.json({ ...state, prepared });
  });
  mount();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Prepare host backup" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Prepare host backup" }));
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Download backup" })).toBeNull();
  await act(async () => resolve(Response.json({ schemaVersion: 1, backup })));
  expect((await screen.findByRole("link", { name: "Download backup" })).getAttribute("href")).toBe(
    `/api/host/backups/${backup.id}`,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("does not adopt another window's verification after reopening or polling", async () => {
  const verified = { ...backup, expiresAt: 253402300799 };
  vi.stubGlobal("fetch", async () => Response.json({ ...state, verified }));
  const client = mount();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Prepare host backup" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(
    screen.getByRole("button", { name: "Create recovery copy" }).hasAttribute("disabled"),
  ).toBe(true);
  await act(async () =>
    client.setQueryData(["host-recovery"], {
      ...state,
      verified: { ...verified, id: "f6371e14-962e-4639-8be0-638258d8cd97" },
    }),
  );
  expect(screen.queryByRole("heading", { name: "Verified backup" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Create recovery copy" }).hasAttribute("disabled"),
  ).toBe(true);
});
it("keeps the selected file receipt bound and disables recovery when another window replaces it", async () => {
  const verified = { ...backup, expiresAt: 253402300799 };
  vi.stubGlobal("fetch", async (path: string) =>
    Response.json(
      path.endsWith("/verify")
        ? { schemaVersion: 1, verification: verified }
        : { ...state, verified },
    ),
  );
  const client = mount();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Prepare host backup" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Backup file"), {
    target: { files: [new File(["valid"], "intended.hearthbackup")] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify backup" }));
  await screen.findByRole("heading", { name: "Verified backup" });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Create recovery copy" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  await act(async () =>
    client.setQueryData(["host-recovery"], {
      ...state,
      verified: { ...verified, id: "f6371e14-962e-4639-8be0-638258d8cd97" },
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Create recovery copy" }).hasAttribute("disabled"),
    ).toBe(true),
  );
  expect((screen.getByLabelText("Backup file") as HTMLInputElement).files?.[0]?.name).toBe(
    "intended.hearthbackup",
  );
});
