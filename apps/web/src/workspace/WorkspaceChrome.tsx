import type { Campaign, Participant, Scene } from "@hearth/protocol";
import {
  CircleHelp,
  Dices,
  Eye,
  EyeOff,
  Flame,
  Hand,
  HardDrive,
  Layers2,
  LockKeyhole,
  MapPin,
  MousePointer2,
  NotebookPen,
  Pencil,
  Plus,
  Ruler,
  ScanEye,
  Settings2,
  SlidersHorizontal,
  Swords,
  UserPlus,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { FogTool } from "../features/fog";
import type { MapTool } from "../features/mapTools";
import { t } from "../i18n/en";
import type { PanelId } from "./preferences";
import { ToolButton } from "./ToolButton";
export function CampaignBar({
  world,
  scene,
  isDm,
  status,
  onEdit,
  onInvite,
  onRecovery,
}: {
  world: Pick<Campaign, "name" | "archived">;
  scene: Scene | undefined;
  isDm: boolean;
  status: keyof typeof t.connectionStates;
  onEdit: () => void;
  onInvite: () => void;
  onRecovery?: () => void;
}) {
  return (
    <>
      <Link to="/" className="workspace-brand" aria-label={t.backLibrary} title="Campaign library">
        <Flame size={18} />
        <span>HEARTH</span>
      </Link>
      <span className="workspace-divider" />
      <div className="table-title">
        <strong>{world.name}</strong>
        <span>{scene?.name ?? t.sceneInfo}</span>
      </div>
      <span className="role-badge static">{isDm ? t.dm : t.player}</span>
      {world.archived && <span className="workspace-archived">Archived · view only</span>}
      <span className={`connection-state ${status}`} role="status" data-testid="connection-status">
        {t.connectionStates[status]}
      </span>
      <div className="workspace-header-actions">
        {onRecovery && (
          <button
            type="button"
            className="workspace-icon"
            title="Backup & recovery"
            aria-label="Backup & recovery"
            onClick={onRecovery}
          >
            <HardDrive size={15} />
          </button>
        )}
        {isDm && (
          <>
            <button
              type="button"
              className="workspace-icon"
              title={t.editCampaign}
              aria-label={t.editCampaign}
              onClick={() => onEdit()}
            >
              <Settings2 size={15} />
            </button>
            <button
              type="button"
              className="workspace-invite"
              title={t.invitePlayers}
              aria-label={t.invitePlayers}
              onClick={() => onInvite()}
            >
              <UserPlus size={14} />
              <span>Invite</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}
export function SceneNavigation({
  scene,
  scenes,
  isDm,
  disabled,
  onScene,
  onCreate,
  onPublish,
  onNotes,
  notesOpen,
}: {
  onNotes?: () => void;
  notesOpen?: boolean;
  scene: Scene | undefined;
  scenes: Scene[];
  isDm: boolean;
  disabled: boolean;
  onScene: (id: string) => void;
  onCreate: () => void;
  onPublish: (id: string, active: boolean) => void;
}) {
  return (
    <>
      <span className="scene-navigation-label">
        <Layers2 size={13} />
        SCENES
      </span>
      <div className="scene-tabs">
        {scenes.map((item) =>
          isDm ? (
            <button
              type="button"
              key={item.id}
              className={`${scene?.id === item.id ? "selected" : ""} ${item.active ? "published" : ""}`}
              aria-pressed={scene?.id === item.id}
              title={
                item.active
                  ? `${item.name} · on players' table`
                  : `${item.name} · private preparation`
              }
              onClick={() => onScene(item.id)}
            >
              {item.active ? <span className="scene-live-dot" /> : <LockKeyhole size={10} />}
              <span>{item.name}</span>
            </button>
          ) : (
            <span key={item.id} className="player-scene-name">
              <span className="scene-live-dot" />
              {item.name}
            </span>
          ),
        )}
      </div>
      {isDm && (
        <>
          <button
            type="button"
            className="workspace-icon"
            aria-label={t.newScene}
            title={t.newScene}
            disabled={disabled}
            onClick={() => onCreate()}
          >
            <Plus size={15} />
          </button>
          {scene && (
            <button
              type="button"
              className={`scene-publish ${scene.active ? "published" : ""}`}
              disabled={disabled}
              aria-label={scene.active ? t.takeScenePrivate : t.showScene}
              title={scene.active ? t.takeScenePrivate : t.showScene}
              onClick={() => onPublish(scene.id, scene.active)}
            >
              {scene.active ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>{scene.active ? "On players' table" : "Show to players"}</span>
            </button>
          )}
        </>
      )}
      {scene && onNotes && (
        <ToolButton
          id="scene-notes-trigger"
          label="Scene notes"
          icon={NotebookPen}
          pressed={notesOpen}
          aria-expanded={notesOpen}
          aria-controls={`scene-notes-${scene.id}`}
          onClick={onNotes}
          className="scene-notes-trigger"
        />
      )}
    </>
  );
}
export function CanvasTools({
  scene,
  isDm,
  disabled,
  panOnly,
  paintTool,
  mapTool,
  onPan,
  onFog,
  onMapTool,
  onAddToken,
  onPanel,
  onHelp,
}: {
  scene: Scene | undefined;
  isDm: boolean;
  disabled: boolean;
  panOnly: boolean;
  paintTool: FogTool;
  mapTool: MapTool;
  onPan: (pan: boolean) => void;
  onFog: (tool: FogTool) => void;
  onMapTool: (tool: MapTool) => void;
  onAddToken: () => void;
  onPanel: (panel: PanelId) => void;
  onHelp: () => void;
}) {
  return (
    <>
      <ToolButton
        type="button"
        label="Select tokens"
        title="Select tokens"
        className={!panOnly && paintTool === "select" && !mapTool ? "active" : ""}
        aria-pressed={!panOnly && paintTool === "select" && !mapTool}
        onClick={() => {
          onPan(false);
          onFog("select");
        }}
      >
        <MousePointer2 size={18} />
      </ToolButton>
      <ToolButton
        type="button"
        label="Pan canvas"
        title="Pan canvas"
        className={panOnly ? "active" : ""}
        aria-pressed={panOnly}
        onClick={() => {
          onFog("select");
          onPan(true);
        }}
      >
        <Hand size={18} />
      </ToolButton>
      <ToolButton
        type="button"
        label="Measure distance"
        title="Measure distance in grid squares"
        aria-pressed={mapTool === "measure"}
        className={mapTool === "measure" ? "active" : ""}
        disabled={!scene}
        onClick={() => onMapTool("measure")}
      >
        <Ruler size={18} />
      </ToolButton>
      <ToolButton
        type="button"
        label="Ping map"
        title="Ping a revealed point on the active scene"
        aria-pressed={mapTool === "ping"}
        className={mapTool === "ping" ? "active" : ""}
        disabled={disabled || !scene?.active || scene.visibility !== "shared"}
        onClick={() => onMapTool("ping")}
      >
        <MapPin size={18} />
      </ToolButton>
      <span className="tool-divider" />
      {isDm && (
        <>
          <ToolButton
            type="button"
            label="Draw on map"
            title="Draw on map"
            aria-pressed={mapTool === "draw"}
            className={mapTool === "draw" ? "active" : ""}
            disabled={disabled || !scene}
            onClick={() => onMapTool("draw")}
          >
            <Pencil size={18} />
          </ToolButton>
          <ToolButton
            type="button"
            label={t.addToken}
            title={t.addToken}
            disabled={disabled || !scene}
            onClick={() => onAddToken()}
          >
            <Plus size={19} />
          </ToolButton>
          <ToolButton
            type="button"
            label="Reveal fog tool"
            title="Reveal fog · enable in Scene controls"
            className={paintTool === "reveal" ? "active" : ""}
            disabled={disabled || !scene?.fog.enabled}
            onClick={() => onFog("reveal")}
          >
            <ScanEye size={18} />
          </ToolButton>
          <ToolButton
            type="button"
            label="Hide fog tool"
            title="Hide fog · enable in Scene controls"
            className={paintTool === "hide" ? "active" : ""}
            disabled={disabled || !scene?.fog.enabled}
            onClick={() => onFog("hide")}
          >
            <EyeOff size={18} />
          </ToolButton>
        </>
      )}
      <ToolButton
        type="button"
        label="Open scene controls"
        title="Scene controls"
        onClick={() => onPanel("scene")}
      >
        <SlidersHorizontal size={18} />
      </ToolButton>
      <span className="tool-divider" />
      <ToolButton
        type="button"
        label="Open dice roller"
        title="Dice roller · Shift+D"
        onClick={() => onPanel("dice")}
      >
        <Dices size={18} />
      </ToolButton>
      <ToolButton
        type="button"
        label="Open combat tracker"
        title="Combat tracker · Shift+I"
        onClick={() => onPanel("combat")}
      >
        <Swords size={18} />
      </ToolButton>
      <ToolButton
        type="button"
        label="Tabletop help"
        title="Tabletop help"
        onClick={() => onHelp()}
      >
        <CircleHelp size={18} />
      </ToolButton>
    </>
  );
}
export function TableBottom({
  participants,
  userId,
  onPrepare,
}: {
  participants: Participant[];
  userId: string;
  onPrepare: (sides: number) => void;
}) {
  return (
    <>
      <div className="workspace-party">
        <span className="party-label">
          <Users size={12} />
          PARTY
        </span>
        {participants.slice(0, 5).map((p) => (
          <span
            key={p.id}
            className={`party-member ${p.role}`}
            title={`${p.displayName} · ${p.role === "dm" ? "GM" : "member"}`}
          >
            <span>{p.displayName.slice(0, 1).toUpperCase()}</span>
            <small>{p.id === userId ? "You" : p.displayName}</small>
          </span>
        ))}
      </div>
      <fieldset className="workspace-hotbar" aria-label="Quick dice preparation">
        <span>
          <Dices size={13} />
          QUICK DICE
        </span>
        {[4, 6, 8, 10, 12, 20, 100].map((sides) => (
          <button
            key={sides}
            type="button"
            title={`Prepare d${sides} · keeps roll privacy`}
            aria-label={`Prepare d${sides} roll`}
            onClick={() => onPrepare(sides)}
          >{`d${sides}`}</button>
        ))}
      </fieldset>
    </>
  );
}
