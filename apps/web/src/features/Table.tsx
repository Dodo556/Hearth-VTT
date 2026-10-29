import { newRequestId, type User } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ellipsis,
  Layers2,
  PanelTopOpen,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  Users,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { t } from "../i18n/en";
import { PanelPortal } from "../workspace/PanelPortal";
import { type PanelId, useWorkspacePreferences } from "../workspace/preferences";
import {
  CampaignBar,
  CanvasTools,
  SceneNavigation,
  TableBottom,
} from "../workspace/WorkspaceChrome";
import { WorkspaceShell } from "../workspace/WorkspaceShell";
import { WorkspaceWindow } from "../workspace/WorkspaceWindow";
import "../workspace/workspace.css";
import { Chat } from "./Chat";
import { Dice } from "./Dice";
import type { DrawingSettings } from "./DrawingControls";
import { InviteDialog } from "./dialogs";
import type { FogTool } from "./fog";
import { Journals } from "./Journals";
import { CampaignEditor } from "./Library";
import type { MapTool } from "./mapTools";
import { NewSceneDialog, TokenEditor } from "./SceneAuthoring";
import { SceneNotes } from "./SceneNotes";
import { PeoplePanel, ScenePanel } from "./TablePanels";
import { TokenContextMenu } from "./TokenContextMenu";
import { TokenInspector } from "./TokenInspector";
import { useCampaignStream } from "./useCampaignStream";

const Actors = lazy(() => import("./Actors").then((module) => ({ default: module.Actors })));
const BackupRecovery = lazy(() =>
  import("./BackupRecovery").then((module) => ({ default: module.BackupRecovery })),
);
const Combat = lazy(() => import("./Combat").then((module) => ({ default: module.Combat })));
const SceneCanvas = lazy(() =>
  import("./SceneCanvas").then((module) => ({ default: module.SceneCanvas })),
);
const compactTools = (sidebarWidth: number) =>
  window.innerWidth <= 640 || window.innerWidth - sidebarWidth < 320;

export function Table({ user }: { user: User }) {
  const { id = "" } = useParams();
  return <TableSession key={`${user.id}:${id}`} user={user} id={id} />;
}
function TableSession({ user, id }: { user: User; id: string }) {
  const client = useQueryClient();
  const campaign = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api.campaign(id),
    refetchInterval: 5000,
  });
  const scenes = useQuery({
    queryKey: ["scenes", id],
    queryFn: () => api.scenes(id),
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const journals = useQuery({
    queryKey: ["journals", id],
    queryFn: () => api.journals(id),
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const actors = useQuery({
    queryKey: ["actors", id],
    queryFn: () => api.actors(id),
    enabled: false,
    staleTime: Infinity,
  });
  const rolls = useQuery({
    queryKey: ["rolls", id],
    queryFn: () => api.rolls(id),
    enabled: false,
    staleTime: Infinity,
  });
  const messages = useQuery({
    queryKey: ["chat", id],
    queryFn: () => api.chat(id),
    enabled: false,
    staleTime: Infinity,
  });
  const participants = useQuery({
    queryKey: ["participants", id],
    queryFn: () => api.participants(id),
    enabled: !!campaign.data,
    refetchInterval: 5000,
  });
  const [actorId, setActorId] = useState<string | null>(null);
  const [sceneAction, setSceneAction] = useState<"rename" | "delete" | null>(null);
  const [sceneTarget, setSceneTarget] = useState<string | null>(null);
  const [sceneName, setSceneName] = useState("");
  const [sceneOriginalName, setSceneOriginalName] = useState("");
  const stream = useCampaignStream(id, !!campaign.data && !campaign.error);
  const [fogTool, setFogTool] = useState<{ sceneId: string; tool: FogTool } | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [newScene, setNewScene] = useState(false);
  const [tokenEditor, setTokenEditor] = useState<"new" | "edit" | null>(null);
  const [editorTargetId, setEditorTargetId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [authorError, setAuthorError] = useState<Error | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorSection, setInspectorSection] = useState<"details" | "vitals">("details");
  const [tokenContext, setTokenContext] = useState<{
    sceneId: string;
    tokenId: string;
    x: number;
    y: number;
  } | null>(null);
  const isDm = campaign.data?.campaign.role === "dm";
  const members = useQuery({
    queryKey: ["members", id],
    queryFn: () => api.members(id),
    enabled: isDm,
    refetchInterval: 5000,
  });
  const layout = useWorkspacePreferences(user.id, id);
  const tab = layout.prefs.panel;
  const setTab = (panel: PanelId) => {
    if (compactTools(layout.prefs.width)) setMapTool(null);
    if (window.innerWidth <= 800 || compactTools(layout.prefs.width)) {
      setNotesOpen(false);
      setInspectorOpen(false);
    }
    layout.update({ panel, open: true });
  };
  const [visited, setVisited] = useState<Set<PanelId>>(() => new Set(["chat"]));
  useEffect(() => {
    if (!visited.has(tab)) setVisited((old) => new Set([...old, tab]));
  }, [tab, visited]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [combatPopout, setCombatPopout] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [panOnly, setPanOnly] = useState(false);
  const [mapTool, setMapTool] = useState<MapTool>(null);
  const [drawing, setDrawing] = useState<DrawingSettings>({
    shape: "line",
    visibility: "shared",
    color: "#e8bc6a",
  });
  useEffect(() => {
    const keepEditorVisible = () => {
      if (
        layout.prefs.open &&
        ((mapTool === "draw" && compactTools(layout.prefs.width)) ||
          ((notesOpen || inspectorOpen) &&
            (window.innerWidth <= 800 || compactTools(layout.prefs.width))))
      )
        layout.update({ open: false });
    };
    keepEditorVisible();
    window.addEventListener("resize", keepEditorVisible);
    return () => window.removeEventListener("resize", keepEditorVisible);
  }, [mapTool, notesOpen, inspectorOpen, layout]);
  useEffect(() => {
    const visible = scenes.data?.scenes.flatMap((item) => item.tokens) ?? [];
    if (
      tokenContext &&
      !scenes.data?.scenes.some(
        (item) =>
          item.id === tokenContext.sceneId &&
          item.tokens.some((t) => t.id === tokenContext.tokenId),
      )
    )
      setTokenContext(null);
    if (selectedId && !visible.some((t) => t.id === selectedId)) {
      setSelectedId(null);
      setInspectorOpen(false);
      setDeleteConfirm(false);
    }
  }, [scenes.data, tokenContext, selectedId]);
  const [preparedRoll, setPreparedRoll] = useState<{ formula: string; sequence: number }>();
  const combatDock = useRef<HTMLDivElement>(null),
    combatFloat = useRef<HTMLDivElement>(null);
  const encounter = useQuery({
    queryKey: ["combat", id],
    queryFn: () => api.combat(id),
    enabled: false,
    staleTime: Infinity,
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || !campaign.data || campaign.error)
        return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input, textarea, select, [contenteditable=true]")
      )
        return;
      if (document.querySelector("dialog[open]")) return;
      const panels: Record<string, PanelId> = { c: "chat", d: "dice", i: "combat", j: "journal" };
      const target = panels[e.key.toLowerCase()];
      if (target) {
        e.preventDefault();
        if (compactTools(layout.prefs.width)) setMapTool(null);
        if (window.innerWidth <= 800 || compactTools(layout.prefs.width)) {
          setNotesOpen(false);
          setInspectorOpen(false);
        }
        layout.update({ panel: target, open: true });
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (!layout.prefs.open && compactTools(layout.prefs.width)) setMapTool(null);
        if (!layout.prefs.open && (window.innerWidth <= 800 || compactTools(layout.prefs.width))) {
          setNotesOpen(false);
          setInspectorOpen(false);
        }
        layout.update({ open: !layout.prefs.open });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [layout, campaign.data, campaign.error]);
  const [invite, setInvite] = useState(false);
  const [editing, setEditing] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const revoke = useMutation({
    mutationFn: (userId: string) => api.revokeMember(id, userId),
    onSuccess: async () => {
      setRevokeId(null);
      await client.invalidateQueries({ queryKey: ["members", id] });
    },
  });
  if (campaign.isPending)
    return (
      <main className="centered-state" role="status">
        {t.loading}
      </main>
    );
  if (campaign.error || !campaign.data || stream.status === "denied")
    return (
      <main className="centered-state">
        <ErrorMessage error={campaign.error ?? stream.error} />
        <Link className="button" to="/">
          {t.backLibrary}
        </Link>
      </main>
    );
  const world = campaign.data.campaign;
  const allScenes = scenes.data?.scenes ?? [];
  const scene =
    (isDm && allScenes.find((item) => item.id === sceneId)) ||
    allScenes.find((item) => item.active) ||
    allScenes[0];
  const selected = scene?.tokens.find((token) => token.id === selectedId);
  const disabled = stream.status !== "live" || stream.busy || world.archived;
  const effectivePanel = tab === "people" && !isDm ? "chat" : tab;
  const currentEncounter = encounter.data?.encounter ?? null;
  const encounterScene = allScenes.find((s) => s.id === currentEncounter?.sceneId) ?? scene;
  const paintTool = fogTool && fogTool.sceneId === scene?.id ? fogTool.tool : "select";
  const activeMapTool =
    mapTool === "ping" && (disabled || !scene?.active || scene.visibility !== "shared")
      ? null
      : mapTool;
  const select = (tokenId: string, inspect = false, section: "details" | "vitals" = "details") => {
    setDeleteConfirm(false);
    setSelectedId(tokenId);
    if (inspect) {
      setInspectorSection(section);
      setInspectorOpen(true);
      if (window.innerWidth <= 800 || compactTools(layout.prefs.width)) {
        layout.update({ open: false });
        setNotesOpen(false);
      }
      requestAnimationFrame(() => {
        const window = document.querySelector<HTMLElement>('[data-window-id="token-inspector"]');
        (
          window?.querySelector<HTMLElement>(
            section === "vitals" ? ".token-vitals input" : ".token-coordinates input",
          ) ?? window?.querySelector<HTMLElement>(".window-drag-handle")
        )?.focus();
      });
    }
  };
  const chooseScene = (target: string) => {
    setTokenContext(null);
    setSceneId(target);
    setSelectedId(null);
    setInspectorOpen(false);
    setDeleteConfirm(false);
    setPanOnly(false);
    setMapTool(null);
  };
  const change = (command: Parameters<typeof stream.send>[0]) => {
    setAuthorError(null);
    void stream.send(command).catch((error: Error) => setAuthorError(error));
  };
  const fog = (tool: FogTool) => {
    if (scene) {
      setFogTool({ sceneId: scene.id, tool });
      setPanOnly(false);
      setMapTool(null);
    }
  };
  const sceneActionOpen = (action: "rename" | "delete") => {
    if (!scene) return;
    setSceneTarget(scene.id);
    setSceneName(scene.name);
    setSceneOriginalName(scene.name);
    setAuthorError(null);
    setSceneAction(action);
  };
  const openTokenContext = (tokenId: string, x: number, y: number) => {
    if (!scene?.tokens.some((t) => t.id === tokenId)) return;
    setSelectedId(tokenId);
    setDeleteConfirm(false);
    setTokenContext({ sceneId: scene.id, tokenId, x, y });
    if (window.innerWidth <= 800 || compactTools(layout.prefs.width))
      layout.update({ open: false });
  };
  const closeTokenContext = (restore: boolean) => {
    setTokenContext(null);
    if (restore) document.querySelector<HTMLCanvasElement>(".map-area canvas")?.focus();
  };
  const menuToken =
    tokenContext?.sceneId === scene?.id
      ? scene?.tokens.find((t) => t.id === tokenContext?.tokenId)
      : undefined;
  const header = (
    <CampaignBar
      world={world}
      scene={scene}
      isDm={isDm}
      status={stream.status}
      onEdit={() => setEditing(true)}
      onInvite={() => setInvite(true)}
      onRecovery={user.isOwner ? () => setRecoveryOpen(true) : undefined}
    />
  );
  const openNotes = () => {
    setMapTool(null);
    if (window.innerWidth <= 800 || compactTools(layout.prefs.width))
      layout.update({ open: false });
    if (window.innerWidth <= 800 || compactTools(layout.prefs.width)) setInspectorOpen(false);
    setNotesOpen(true);
  };
  const closeNotes = () => {
    setNotesOpen(false);
    document.getElementById("scene-notes-trigger")?.focus();
  };
  const navigation = (
    <SceneNavigation
      scene={scene}
      scenes={allScenes}
      isDm={isDm}
      disabled={disabled}
      notesOpen={notesOpen}
      onNotes={() => (notesOpen ? closeNotes() : openNotes())}
      onScene={chooseScene}
      onCreate={() => setNewScene(true)}
      onPublish={(sceneId, active) =>
        change({ type: active ? "scene.conceal" : "scene.activate", payload: { sceneId } })
      }
    />
  );
  const tools = (
    <CanvasTools
      scene={scene}
      isDm={isDm}
      disabled={disabled}
      panOnly={panOnly}
      paintTool={paintTool}
      mapTool={activeMapTool}
      onPan={(pan) => {
        setMapTool(null);
        setPanOnly(pan);
      }}
      onFog={fog}
      onMapTool={(tool) => {
        if (scene) setFogTool({ sceneId: scene.id, tool: "select" });
        setPanOnly(false);
        setMapTool(tool === "draw" && mapTool === "draw" ? null : tool);
        if (tool === "draw" && compactTools(layout.prefs.width)) layout.update({ open: false });
      }}
      onAddToken={() => setTokenEditor("new")}
      onPanel={setTab}
      onHelp={() => setHelpOpen(true)}
    />
  );
  const bottom = (
    <TableBottom
      participants={participants.data?.participants ?? []}
      userId={user.id}
      onPrepare={(sides) => {
        setPreparedRoll((old) => ({ formula: `1d${sides}`, sequence: (old?.sequence ?? 0) + 1 }));
        setTab("dice");
      }}
    />
  );
  const windows = (
    <>
      {allScenes.map((item) => (
        <SceneNotes
          key={item.id}
          scene={item}
          dm={isDm}
          open={notesOpen && item.id === scene?.id}
          disabled={disabled}
          onClose={closeNotes}
          send={stream.send}
        />
      ))}
      {selected && (
        <div className="selected-token-hud">
          <span className="token-hud-name">{selected.name}</span>
          <button
            type="button"
            aria-label="Inspect selected token"
            title="Token inspector"
            onClick={() => select(selected.id, true, "details")}
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            type="button"
            aria-label="Token actions"
            title="Token actions · right-click or Shift+F10"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              openTokenContext(selected.id, box.left, box.bottom + 4);
            }}
          >
            <Ellipsis size={16} />
          </button>
          {selected.actorId && (
            <button
              type="button"
              aria-label={t.openSheet}
              title={t.openSheet}
              onClick={() => {
                setActorId(selected.actorId);
                setTab("actors");
              }}
            >
              <Users size={14} />
            </button>
          )}
          <button
            type="button"
            aria-label="Clear token selection"
            title="Clear selection"
            onClick={() => {
              setSelectedId(null);
              setInspectorOpen(false);
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {inspectorOpen && selected && scene && (
        <WorkspaceWindow
          id="token-inspector"
          title="Token inspector"
          onClose={() => setInspectorOpen(false)}
          x={76}
          y={92}
          height={600}
        >
          {isDm && inspectorSection === "details" && (
            <div className="token-author-actions">
              <Button
                disabled={disabled}
                onClick={() => {
                  setEditorTargetId(selected.id);
                  setTokenEditor("edit");
                }}
              >
                {t.editToken}
              </Button>
              <Button disabled={disabled} onClick={() => setDeleteConfirm(true)}>
                {t.deleteToken}
              </Button>
              {deleteConfirm && (
                <div className="notice">
                  <p>{t.deleteTokenWarning}</p>
                  <Button onClick={() => setDeleteConfirm(false)}>{t.cancel}</Button>
                  <Button
                    className="danger"
                    disabled={disabled}
                    onClick={() => {
                      change({ type: "token.delete", payload: { tokenId: selected.id } });
                      setDeleteConfirm(false);
                    }}
                  >
                    {t.confirmDelete}
                  </Button>
                </div>
              )}
            </div>
          )}
          <TokenInspector
            key={selected.id}
            token={selected}
            section={inspectorSection}
            onSection={setInspectorSection}
            dm={isDm}
            disabled={disabled}
            width={scene.width}
            height={scene.height}
            actors={actors.data?.actors ?? []}
            onOpenActor={(actor) => {
              setActorId(actor);
              setTab("actors");
            }}
            players={members.data?.members ?? []}
            send={stream.send}
          />
        </WorkspaceWindow>
      )}
      {combatPopout && (
        <WorkspaceWindow
          id="combat-tracker"
          title="Combat tracker"
          onClose={() => setCombatPopout(false)}
          x={450}
          y={92}
          width={326}
          height={548}
        >
          <div className="combat-floating-target" ref={combatFloat} />
        </WorkspaceWindow>
      )}
      {menuToken && tokenContext && (
        <TokenContextMenu
          token={menuToken}
          dm={isDm}
          disabled={disabled}
          x={tokenContext.x}
          y={tokenContext.y}
          onClose={closeTokenContext}
          onAction={(action) => {
            if (action === "inspect") select(menuToken.id, true, "vitals");
            else if (action === "sheet" && menuToken.actorId) {
              setActorId(menuToken.actorId);
              setTab("actors");
            } else if (action === "appearance") {
              setEditorTargetId(menuToken.id);
              setTokenEditor("edit");
            } else if (action === "visibility")
              change({
                type: "token.visibility",
                payload: {
                  tokenId: menuToken.id,
                  visibility: menuToken.visibility === "shared" ? "dm" : "shared",
                },
              });
            else if (action === "delete") {
              select(menuToken.id, true, "details");
              setDeleteConfirm(true);
            }
          }}
        />
      )}
      {(authorError || stream.error) && (
        <div className="workspace-toast">
          <ErrorMessage error={authorError ?? stream.error} />
        </div>
      )}
    </>
  );
  const sidebar = (
    <>
      <div className="feature-panel chat-feature" hidden={effectivePanel !== "chat"}>
        <Chat
          key={id}
          userId={user.id}
          messages={messages.data?.messages ?? []}
          rolls={rolls.data?.rolls ?? []}
          participants={participants.data?.participants ?? []}
          participantsAvailable={!!participants.data && !participants.error}
          disabled={disabled}
          send={stream.send}
        />
      </div>
      <div className="feature-panel" hidden={effectivePanel !== "combat"}>
        <div ref={combatDock} />
        {combatPopout && (
          <div className="panel-empty-popout">
            <Swords size={28} />
            <p>The tracker is open in a floating window.</p>
            <Button onClick={() => setCombatPopout(false)}>Dock tracker</Button>
          </div>
        )}
      </div>
      <div className="feature-panel" hidden={effectivePanel !== "dice"}>
        <Dice
          key={id}
          rolls={rolls.data?.rolls ?? []}
          preparedRoll={preparedRoll}
          participants={participants.data?.participants ?? []}
          participantsAvailable={!!participants.data && !participants.error}
          userId={user.id}
          disabled={disabled}
          send={stream.send}
        />
      </div>
      <div className="feature-panel" hidden={effectivePanel !== "actors"}>
        {(visited.has("actors") || effectivePanel === "actors") && (
          <Suspense fallback={<p role="status">Loading characters…</p>}>
            <Actors
              campaignId={id}
              actors={actors.data?.actors ?? []}
              dm={isDm}
              disabled={disabled}
              members={members.data?.members ?? []}
              send={stream.send}
              selectedId={actorId}
              onSelect={setActorId}
            />
          </Suspense>
        )}
      </div>
      <div className="feature-panel" hidden={effectivePanel !== "journal"}>
        <Journals
          participants={participants.data?.participants ?? []}
          participantsAvailable={!!participants.data && !participants.error}
          campaignId={id}
          key={id}
          journals={journals.data?.journals ?? []}
          folders={journals.data?.folders ?? []}
          dm={isDm}
          disabled={disabled}
          send={stream.send}
        />
        <ErrorMessage error={journals.error} />
      </div>
      {isDm && (
        <div className="feature-panel" hidden={effectivePanel !== "people"}>
          <PeoplePanel
            members={members.data?.members ?? []}
            userId={user.id}
            revokeId={revokeId}
            onRevokeId={setRevokeId}
            onRevoke={(target) => revoke.mutate(target)}
            disabled={revoke.isPending}
            error={members.error ?? revoke.error}
          />
        </div>
      )}
      <div className="feature-panel" hidden={effectivePanel !== "scene"}>
        <ScenePanel
          scene={scene}
          scenes={allScenes}
          dm={isDm}
          disabled={disabled}
          selectedId={selectedId}
          onScene={chooseScene}
          onSelect={(target) => select(target, true)}
          onNotes={openNotes}
          onRename={() => sceneActionOpen("rename")}
          onDelete={() => sceneActionOpen("delete")}
          fogTool={paintTool}
          onFogTool={fog}
          send={stream.send}
        />
      </div>
    </>
  );
  return (
    <>
      <WorkspaceShell
        open={layout.prefs.open}
        width={layout.prefs.width}
        onWidth={(width) => layout.update({ width })}
        onToggle={() => {
          if (!layout.prefs.open && compactTools(layout.prefs.width)) setMapTool(null);
          if (
            !layout.prefs.open &&
            (window.innerWidth <= 800 || compactTools(layout.prefs.width))
          ) {
            setNotesOpen(false);
            setInspectorOpen(false);
          }
          layout.update({ open: !layout.prefs.open });
        }}
        panel={effectivePanel}
        onPanel={setTab}
        dm={isDm}
        header={header}
        navigation={navigation}
        tools={tools}
        bottom={bottom}
        windows={windows}
        sidebar={sidebar}
        sidebarActions={
          effectivePanel === "combat" && !combatPopout ? (
            <button
              type="button"
              className="workspace-icon"
              title="Pop out combat tracker"
              aria-label="Pop out combat tracker"
              onClick={() => setCombatPopout(true)}
            >
              <PanelTopOpen size={14} />
            </button>
          ) : null
        }
        status={
          <>
            <span className="workspace-connection">
              <span className={`connection-led ${stream.status}`} />
              {stream.busy
                ? "Saving on host…"
                : stream.status === "live"
                  ? "Connected to your host"
                  : t.connectionStates[stream.status]}
            </span>
            <span className="workspace-map-disclosure" title={t.mapPrivacy}>
              <ShieldCheck size={11} />
              Map artwork is downloadable
            </span>
            <span className="workspace-version">{t.foundation}</span>
          </>
        }
      >
        {scene ? (
          <Suspense fallback={<p role="status">{t.loading}</p>}>
            <SceneCanvas
              scene={scene}
              onTokenContext={openTokenContext}
              online={stream.status === "live"}
              busy={disabled}
              isDm={isDm}
              fogTool={paintTool}
              mapTool={activeMapTool}
              pings={stream.pings}
              drawing={drawing}
              onDrawingSettings={setDrawing}
              onCloseDrawing={() => setMapTool(null)}
              onDraw={async (settings, start, end, points) => {
                await stream.send({
                  type: "drawing.create",
                  payload: {
                    sceneId: scene.id,
                    clientDrawingId: newRequestId(),
                    shape: settings.shape,
                    visibility: settings.visibility,
                    color: settings.color,
                    ...(settings.shape === "text"
                      ? { text: settings.text?.trim(), fontSize: settings.fontSize ?? 24 }
                      : {}),
                    ...(points ? { points } : {}),
                    startX: start.x,
                    startY: start.y,
                    endX: end.x,
                    endY: end.y,
                  },
                });
              }}
              onSaveText={async (draft) => {
                const fields = {
                  sceneId: scene.id,
                  text: draft.text.trim(),
                  color: draft.color,
                  fontSize: draft.fontSize,
                  visibility: draft.visibility,
                  startX: draft.start.x,
                  startY: draft.start.y,
                  endX: draft.end.x,
                  endY: draft.end.y,
                };
                if (draft.drawingId)
                  await stream.send({
                    type: "drawing.updateText",
                    payload: {
                      ...fields,
                      drawingId: draft.drawingId,
                      expectedVersion: draft.expectedVersion ?? 1,
                    },
                  });
                else
                  await stream.send({
                    type: "drawing.create",
                    payload: { ...fields, shape: "text", clientDrawingId: newRequestId() },
                  });
              }}
              onEraseDrawing={async (drawing) => {
                await stream.send({
                  type: "drawing.delete",
                  payload: {
                    sceneId: scene.id,
                    drawingId: drawing.id,
                    expectedVersion: drawing.version,
                  },
                });
              }}
              onUndoDrawing={() => change({ type: "drawing.undo", payload: { sceneId: scene.id } })}
              onPing={(x, y) => stream.ping(scene.id, x, y)}
              panOnly={panOnly}
              onFog={async (rect, mode) => {
                await stream
                  .send({ type: "fog.paint", payload: { sceneId: scene.id, ...rect, mode } })
                  .catch(() => {});
              }}
              selectedId={selectedId}
              onSelect={(target) => select(target)}
              onMove={async (tokenId, x, y) => {
                // The stream exposes command errors in the workspace. Event callbacks
                // must also settle when navigation interrupts a pending drag.
                await stream
                  .send({ type: "token.move", payload: { tokenId, x, y } })
                  .catch(() => {});
              }}
            />
          </Suspense>
        ) : (
          <div className="empty-state waiting-scene">
            <Layers2 size={28} />
            <h2>{isDm ? t.noScenes : t.waitingScene}</h2>
            <p>{isDm ? t.noScenesDetail : t.waitingSceneDetail}</p>
            <ErrorMessage error={scenes.error} />
          </div>
        )}
      </WorkspaceShell>
      <PanelPortal target={combatPopout ? combatFloat : combatDock}>
        {(visited.has("combat") || effectivePanel === "combat" || combatPopout) && (
          <Suspense fallback={<p role="status">Loading combat…</p>}>
            <Combat
              campaignId={id}
              encounter={currentEncounter}
              scene={encounterScene}
              dm={isDm}
              disabled={disabled}
              send={stream.send}
              onFocusToken={(target) => {
                if (currentEncounter) setSceneId(currentEncounter.sceneId);
                select(target, true);
              }}
            />
          </Suspense>
        )}
      </PanelPortal>
      {user.isOwner && recoveryOpen && (
        <Suspense fallback={<p role="status">Loading host tools…</p>}>
          <BackupRecovery onClose={() => setRecoveryOpen(false)} />
        </Suspense>
      )}
      {helpOpen && (
        <Dialog title="Tabletop controls" onClose={() => setHelpOpen(false)}>
          <div className="shortcut-help">
            <p>
              Drag empty canvas or use Pan to move the view. Scroll to zoom; Fit scene centers the
              map. Select a controlled token to move it, or open its inspector for precise
              coordinates.
            </p>
            <dl>
              <div>
                <dt>Shift+C</dt>
                <dd>Chat</dd>
              </div>
              <div>
                <dt>Shift+D</dt>
                <dd>Dice roller</dd>
              </div>
              <div>
                <dt>Shift+I</dt>
                <dd>Combat tracker</dd>
              </div>
              <div>
                <dt>Shift+J</dt>
                <dd>Journal</dd>
              </div>
              <div>
                <dt>Shift+B</dt>
                <dd>Toggle sidebar</dd>
              </div>
              <div>
                <dt>Arrow keys</dt>
                <dd>Move focused token, sidebar divider or window handle</dd>
              </div>
            </dl>
            <p>
              Bottom quick dice prepares a roll without changing its privacy. The party strip lists
              campaign members, not online presence. Map artwork can be downloaded by authorized
              participants.
            </p>
          </div>
        </Dialog>
      )}
      {sceneAction && sceneTarget && scenes.data?.scenes.some((s) => s.id === sceneTarget) && (
        <Dialog
          title={sceneAction === "rename" ? t.renameScene : t.deleteScene}
          onClose={() => setSceneAction(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void stream
                .send(
                  sceneAction === "rename"
                    ? {
                        type: "scene.rename",
                        payload: {
                          sceneId: sceneTarget,
                          expectedName: sceneOriginalName,
                          name: sceneName.trim(),
                        },
                      }
                    : { type: "scene.delete", payload: { sceneId: sceneTarget } },
                )
                .then(() => setSceneAction(null))
                .catch((error: Error) => setAuthorError(error));
            }}
          >
            {sceneAction === "rename" &&
              scenes.data?.scenes.find((s) => s.id === sceneTarget)?.name !== sceneOriginalName && (
                <div className="notice">
                  <p>{t.sceneNameUpdated}</p>
                  <Button
                    type="button"
                    onClick={() => {
                      const latest = scenes.data?.scenes.find((s) => s.id === sceneTarget);
                      if (latest) {
                        setSceneName(latest.name);
                        setSceneOriginalName(latest.name);
                        setAuthorError(null);
                      }
                    }}
                  >
                    {t.reloadSceneName}
                  </Button>
                </div>
              )}
            {sceneAction === "rename" ? (
              <label>
                {t.sceneName}
                <input
                  aria-label={t.sceneName}
                  value={sceneName}
                  required
                  maxLength={80}
                  onChange={(e) => setSceneName(e.target.value)}
                />
              </label>
            ) : (
              <p>{t.deleteSceneHint}</p>
            )}
            <ErrorMessage error={authorError} />
            <div className="dialog-actions">
              <Button type="button" onClick={() => setSceneAction(null)}>
                {t.cancel}
              </Button>
              <Button
                type="submit"
                className={sceneAction === "delete" ? "danger" : "primary"}
                disabled={disabled || (sceneAction === "rename" && !sceneName.trim())}
              >
                {sceneAction === "rename" ? t.saveSceneName : t.confirmSceneDelete}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {newScene && (
        <NewSceneDialog
          campaignId={id}
          send={stream.send}
          onCreated={(created) => {
            setSceneId(created);
            setSelectedId(null);
            setTab("scene");
          }}
          onClose={() => setNewScene(false)}
        />
      )}
      {tokenEditor &&
        scene &&
        (tokenEditor === "new" || scene.tokens.some((token) => token.id === editorTargetId)) && (
          <TokenEditor
            key={`${scene.id}:${tokenEditor}:${editorTargetId}`}
            mode={tokenEditor === "edit" ? "edit" : "create"}
            scene={scene}
            token={
              tokenEditor === "edit"
                ? scene.tokens.find((token) => token.id === editorTargetId)
                : undefined
            }
            send={stream.send}
            onCreated={(created) => select(created, true)}
            onClose={() => setTokenEditor(null)}
          />
        )}
      {invite && <InviteDialog campaignId={id} onClose={() => setInvite(false)} />}{" "}
      {editing && <CampaignEditor campaign={world} onClose={() => setEditing(false)} />}
    </>
  );
}
