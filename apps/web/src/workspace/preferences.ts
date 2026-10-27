import { useEffect, useMemo, useState } from "react";
export const panelIds = ["chat", "combat", "dice", "journal", "actors", "scene", "people"] as const;
export type PanelId = (typeof panelIds)[number];
export type WorkspacePreferences = { width: number; open: boolean; panel: PanelId };
const defaults: WorkspacePreferences = { width: 368, open: true, panel: "chat" };
function sanitize(value: unknown): WorkspacePreferences {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    width:
      typeof v.width === "number" && Number.isFinite(v.width)
        ? Math.max(320, Math.min(520, v.width))
        : defaults.width,
    open: typeof v.open === "boolean" ? v.open : true,
    panel: panelIds.includes(v.panel as PanelId) ? (v.panel as PanelId) : "chat",
  };
}
function read(key: string) {
  try {
    return sanitize(JSON.parse(localStorage.getItem(key) ?? "null"));
  } catch {
    return { ...defaults };
  }
}
export function useWorkspacePreferences(user: string, campaign: string) {
  const key = `hearth:workspace:${user}:${campaign}`;
  const initial = useMemo(() => read(key), [key]);
  const [override, setOverride] = useState<{ key: string; prefs: WorkspacePreferences } | null>(
    null,
  );
  const prefs = override?.key === key ? override.prefs : initial;
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(prefs));
      } catch {
        /* Layout storage is optional. */
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [key, prefs]);
  const update = (change: Partial<WorkspacePreferences>) =>
    setOverride((old) => ({
      key,
      prefs: sanitize({ ...(old?.key === key ? old.prefs : initial), ...change }),
    }));
  return { prefs, update };
}
