// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { TokenEditor } from "./SceneAuthoring";

afterEach(cleanup);
it("an edit target disappearing cannot turn its existing dialog into token creation", () => {
  // jsdom does not implement the native dialog's presentation methods.
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
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["assets", "camp"], { schemaVersion: 1, assets: [] });
  const token = {
    id: "token",
    name: "Hero",
    x: 90,
    y: 90,
    size: 52,
    color: "gold",
    assetId: "token-warden",
    visibility: "shared" as const,
    controllerUserId: null,
    actorId: null,
    canMove: true,
  };
  const scene = {
    id: "scene",
    campaignId: "camp",
    name: "Map",
    width: 600,
    height: 600,
    gridSize: 60,
    backgroundAssetId: "amber-map",
    fog: { enabled: false, columns: 10, rows: 10, revealed: "00".repeat(13) },
    visibility: "shared" as const,
    active: true,
    tokens: [token],
  };
  const props = {
    scene,
    token,
    mode: "edit" as const,
    send: async () => {},
    onClose: () => {},
    onCreated: () => {},
  };
  const view = (target: typeof token | undefined) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(TokenEditor, { ...props, token: target }),
    );
  const { rerender } = render(view(token));
  expect(screen.getByRole("button", { name: "Save token" })).toBeTruthy();
  rerender(view(undefined));
  expect(screen.queryByRole("button", { name: "Place token" })).toBeNull();
  expect(screen.getByRole("button", { name: "Save token" }).hasAttribute("disabled")).toBe(true);
});

it("cancelled scene completion cannot change later selection", async () => {
  const { NewSceneDialog } = await import("./SceneAuthoring");
  const { fireEvent, act } = await import("@testing-library/react");
  const { vi } = await import("vitest");
  const c = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  c.setQueryData(["assets", "camp"], { schemaVersion: 1, assets: [] });
  let finish: () => void = () => {};
  const onCreated = vi.fn();
  const send = () =>
    new Promise<void>((r) => {
      finish = r;
    });
  const { unmount } = render(
    createElement(
      QueryClientProvider,
      { client: c },
      createElement(NewSceneDialog, { campaignId: "camp", send, onCreated, onClose: () => {} }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Scene name", { exact: true }), {
    target: { value: "Draft" },
  });
  fireEvent.change(screen.getByLabelText("Use existing artwork", { exact: true }), {
    target: { value: "amber-map" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create scene" }));
  });
  unmount();
  await act(async () => {
    finish();
    await Promise.resolve();
  });
  expect(onCreated).not.toHaveBeenCalled();
});
