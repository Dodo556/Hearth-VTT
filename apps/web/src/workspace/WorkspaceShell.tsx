import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Dices,
  Layers2,
  MessageSquare,
  Swords,
  Users,
  UsersRound,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";
import type { PanelId } from "./preferences";
export const workspacePanels = [
  { id: "chat", label: "Chat", title: "Chat log", icon: MessageSquare },
  { id: "combat", label: "Combat", title: "Combat tracker", icon: Swords },
  { id: "actors", label: "Characters", title: "Character directory", icon: Users },
  { id: "journal", label: "Journal", title: "Journal directory", icon: BookOpen },
  { id: "dice", label: "Dice", title: "Dice roller", icon: Dices },
  { id: "scene", label: "Scene", title: "Scene & token controls", icon: Layers2 },
  { id: "people", label: "People", title: "Campaign members", icon: UsersRound },
] as const;
export function WorkspaceShell({
  open,
  width,
  onWidth,
  onToggle,
  panel,
  onPanel,
  dm,
  header,
  navigation,
  tools,
  bottom,
  status,
  sidebar,
  sidebarActions,
  windows,
  children,
}: {
  open: boolean;
  width: number;
  onWidth: (width: number) => void;
  onToggle: () => void;
  panel: PanelId;
  onPanel: (panel: PanelId) => void;
  dm: boolean;
  header: ReactNode;
  navigation: ReactNode;
  tools: ReactNode;
  bottom: ReactNode;
  status: ReactNode;
  sidebar: ReactNode;
  sidebarActions?: ReactNode;
  windows: ReactNode;
  children: ReactNode;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const definition = workspacePanels.find((p) => p.id === panel);
  return (
    <main
      className={`vtt-workspace ${open ? "sidebar-open" : "sidebar-collapsed"}`}
      style={{ "--sidebar-width": `${width}px` } as CSSProperties}
    >
      <header className="workspace-header table-header">{header}</header>
      <div className="workspace-body">
        <div className="workspace-stage">
          <section className="map-area" aria-label="Scene">
            {children}
          </section>
          <nav className="workspace-scenes" aria-label="Scene navigation">
            {navigation}
          </nav>
          <nav className="workspace-tools" aria-label="Tabletop tools">
            {tools}
          </nav>
          <div className="workspace-bottom">{bottom}</div>
          <div className="workspace-windows">{windows}</div>
        </div>
        <aside className={`vtt-sidebar ${open ? "" : "collapsed"}`} aria-label="Workspace sidebar">
          {open && (
            <hr
              className="sidebar-resizer"
              aria-orientation="vertical"
              aria-label="Sidebar width"
              aria-valuemin={320}
              aria-valuemax={520}
              aria-valuenow={width}
              tabIndex={0}
              onKeyDown={(e) => {
                const n =
                  e.key === "ArrowLeft"
                    ? width + 20
                    : e.key === "ArrowRight"
                      ? width - 20
                      : e.key === "Home"
                        ? 320
                        : e.key === "End"
                          ? 520
                          : null;
                if (n !== null) {
                  e.preventDefault();
                  onWidth(Math.max(320, Math.min(520, n)));
                }
              }}
              onPointerDown={(e) => {
                drag.current = { x: e.clientX, width };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (drag.current)
                  onWidth(
                    Math.max(320, Math.min(520, drag.current.width + drag.current.x - e.clientX)),
                  );
              }}
              onPointerUp={(e) => {
                drag.current = null;
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            />
          )}
          <div className="workspace-tabs" role="tablist" aria-label="Workspace">
            {workspacePanels
              .filter((p) => dm || p.id !== "people")
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-label={label}
                  title={label}
                  aria-selected={panel === id}
                  aria-controls="workspace-panel"
                  className={panel === id ? "active" : ""}
                  onClick={() => {
                    onPanel(id);
                    if (!open) onToggle();
                  }}
                >
                  <Icon size={17} />
                  <span className="sr-only">{label}</span>
                </button>
              ))}
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
              title={open ? "Collapse sidebar · Shift+B" : "Expand sidebar · Shift+B"}
              onClick={onToggle}
            >
              {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          <div className="vtt-sidebar-content" hidden={!open}>
            <div className="workspace-panel-heading">
              <h2>{definition?.title}</h2>
              <div>{sidebarActions}</div>
            </div>
            <div
              id="workspace-panel"
              className="workspace-panel"
              role="tabpanel"
              aria-label={definition?.label}
            >
              {sidebar}
            </div>
          </div>
        </aside>
      </div>
      <footer className="workspace-status">{status}</footer>
    </main>
  );
}
