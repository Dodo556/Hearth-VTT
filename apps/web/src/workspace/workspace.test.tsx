// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PanelPortal } from "./PanelPortal";
import { useWorkspacePreferences } from "./preferences";
import { CanvasTools } from "./WorkspaceChrome";
import { WorkspaceShell } from "./WorkspaceShell";
import { WorkspaceWindow } from "./WorkspaceWindow";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it("clamps corrupt layout preferences and isolates campaign/user state", () => {
  localStorage.setItem(
    "hearth:workspace:alice:one",
    JSON.stringify({ width: 9000, open: true, panel: "missing" }),
  );
  const { result, rerender } = renderHook(
    ({ user, campaign }) => useWorkspacePreferences(user, campaign),
    { initialProps: { user: "alice", campaign: "one" } },
  );
  expect(result.current.prefs.width).toBe(520);
  expect(result.current.prefs.panel).toBe("chat");
  act(() => result.current.update({ panel: "dice", open: false }));
  rerender({ user: "bob", campaign: "two" });
  expect(result.current.prefs.panel).toBe("chat");
  expect(result.current.prefs.open).toBe(true);
});
function ShellExample() {
  const [open, setOpen] = useState(true),
    [width, setWidth] = useState(360),
    [draft, setDraft] = useState("Private draft");
  return (
    <WorkspaceShell
      open={open}
      width={width}
      onWidth={setWidth}
      onToggle={() => setOpen((s) => !s)}
      panel="chat"
      onPanel={() => {}}
      dm
      header="Header"
      navigation="Scenes"
      tools="Tools"
      bottom="Quick dice"
      status="Connected"
      windows={null}
      sidebar={
        <input
          aria-label="Private draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      }
    >
      Map
    </WorkspaceShell>
  );
}
it("resizes with keyboard and keeps a private draft mounted while the sidebar is collapsed", () => {
  render(<ShellExample />);
  fireEvent.keyDown(screen.getByRole("separator", { name: "Sidebar width" }), { key: "ArrowLeft" });
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("380");
  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect((screen.getByLabelText("Private draft") as HTMLInputElement).value).toBe("Private draft");
});
it("moves a nonmodal inspector by keyboard and closes it with Escape", () => {
  let closed = false;
  render(
    <WorkspaceWindow
      title="Token inspector"
      id="token"
      onClose={() => {
        closed = true;
      }}
    >
      Fields
    </WorkspaceWindow>,
  );
  const window = screen.getByRole("region", { name: "Token inspector" });
  const before = Number.parseFloat(window.style.left);
  fireEvent.keyDown(screen.getByRole("button", { name: "Move Token inspector" }), {
    key: "ArrowRight",
    shiftKey: true,
  });
  expect(Number.parseFloat(window.style.left)).toBeGreaterThan(before);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(closed).toBe(true);
});
function PortalExample() {
  const [floating, setFloating] = useState(false);
  const dock = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null);
  return (
    <>
      <button type="button" onClick={() => setFloating((s) => !s)}>
        Move panel
      </button>
      <div ref={dock} />
      <div ref={popup} />
      <PanelPortal target={floating ? popup : dock}>
        <input aria-label="Pending HP" defaultValue="12" />
      </PanelPortal>
    </>
  );
}
it("moves the same panel DOM between docks without losing its draft", () => {
  render(<PortalExample />);
  const field = screen.getByLabelText("Pending HP") as HTMLInputElement;
  fireEvent.change(field, { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: "Move panel" }));
  expect(screen.getByLabelText("Pending HP")).toBe(field);
  expect(field.value).toBe("9");
});

it("clamps floating windows when their stage shrinks without resizing the window itself", () => {
  let stageWidth = 1200;
  const callbacks = new Map<Element, () => void>();
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.dataset.testid === "window-stage" ? stageWidth : 332;
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(332);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(450);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: () => void) {}
      observe(target: Element) {
        callbacks.set(target, this.callback);
      }
      disconnect() {
        callbacks.clear();
      }
    },
  );
  render(
    <div data-testid="window-stage">
      <WorkspaceWindow id="tracker" title="Tracker" x={800} onClose={() => {}}>
        Content
      </WorkspaceWindow>
    </div>,
  );
  const popup = screen.getByRole("region", { name: "Tracker" });
  expect(popup.style.left).toBe("800px");
  stageWidth = 700;
  act(() => callbacks.get(screen.getByTestId("window-stage"))?.());
  expect(popup.style.left).toBe("360px");
});

it("offers separate ruler and ping tools in the tabletop toolbar", () => {
  render(
    <CanvasTools
      scene={undefined}
      isDm={false}
      disabled={false}
      panOnly={false}
      paintTool="select"
      mapTool={null}
      onMapTool={() => {}}
      onPan={() => {}}
      onFog={() => {}}
      onAddToken={() => {}}
      onPanel={() => {}}
      onHelp={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "Measure distance" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ping map" })).toBeTruthy();
});

it("offers a drawing mode to the GM but not to a player", () => {
  const props = {
    scene: undefined,
    disabled: false,
    panOnly: false,
    paintTool: "select" as const,
    mapTool: null,
    onPan: () => {},
    onFog: () => {},
    onMapTool: () => {},
    onAddToken: () => {},
    onPanel: () => {},
    onHelp: () => {},
  };
  const view = render(<CanvasTools {...props} isDm={true} />);
  expect(screen.getByRole("button", { name: "Draw on map" })).toBeTruthy();
  view.rerender(<CanvasTools {...props} isDm={false} />);
  expect(screen.queryByRole("button", { name: "Draw on map" })).toBeNull();
});
