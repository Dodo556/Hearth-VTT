// @vitest-environment jsdom
import type { Token } from "@hearth/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TokenContextMenu } from "./TokenContextMenu";

afterEach(cleanup);
afterEach(() => vi.restoreAllMocks());
const token: Token = {
  actorId: null,
  id: "t",
  name: "Warden",
  x: 50,
  y: 50,
  size: 40,
  color: "#aabbcc",
  assetId: "art",
  visibility: "shared",
  controllerUserId: null,
  canMove: false,
};
it("exposes only authorized actions and supports keyboard navigation and Escape", () => {
  const closed: boolean[] = [];
  render(
    <TokenContextMenu
      token={token}
      dm={false}
      disabled={false}
      x={10}
      y={10}
      onAction={() => {}}
      onClose={(restore) => closed.push(restore)}
    />,
  );
  expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Token controls" }));
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(closed).toEqual([true]);
});
it("routes GM actions and keeps ordinary outside focus destinations", () => {
  const actions: string[] = [];
  const closed: boolean[] = [];
  render(
    <>
      <button type="button">Outside</button>
      <TokenContextMenu
        token={token}
        dm
        disabled={false}
        x={10}
        y={10}
        onAction={(action) => actions.push(action)}
        onClose={(restore) => closed.push(restore)}
      />
    </>,
  );
  fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete token…" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit appearance" }));
  expect(actions).toEqual(["appearance"]);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  expect(closed.at(-1)).toBe(false);
});
it("keeps the last action above the stage footer", () => {
  const stage = document.createElement("div");
  stage.className = "workspace-stage";
  document.body.append(stage);
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 900,
    top: 90,
    bottom: 450,
    width: 900,
    height: 360,
    x: 0,
    y: 90,
    toJSON: () => ({}),
  });
  render(
    <TokenContextMenu
      token={token}
      dm
      disabled={false}
      x={400}
      y={440}
      onAction={() => {}}
      onClose={() => {}}
    />,
  );
  expect(Number.parseFloat(screen.getByRole("menu").style.top) + 178).toBeLessThanOrEqual(442);
  stage.remove();
});
