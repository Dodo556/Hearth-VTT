import type { Scene, TokenCommand } from "@hearth/protocol";
import { Button, ErrorMessage } from "@hearth/ui";
import { LockKeyhole, UserMinus } from "lucide-react";
import { api } from "../api";
import { t } from "../i18n/en";
import { FogControls } from "./FogControls";
import type { FogTool } from "./fog";
export function ScenePanel({
  scene,
  scenes,
  dm,
  disabled,
  selectedId,
  onScene,
  onSelect,
  onRename,
  onDelete,
  fogTool,
  onFogTool,
  send,
}: {
  scene: Scene | undefined;
  scenes: Scene[];
  dm: boolean;
  disabled: boolean;
  selectedId: string | null;
  onScene: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: () => void;
  onDelete: () => void;
  fogTool: FogTool;
  onFogTool: (tool: FogTool) => void;
  send: (command: TokenCommand) => Promise<void>;
}) {
  return (
    <section className="scene-directory" aria-label="Scene controls">
      {dm && (
        <label className="compact-field">
          {t.preparedScene}
          <select
            aria-label={t.preparedScene}
            value={scene?.id ?? ""}
            onChange={(e) => onScene(e.target.value)}
          >
            {!scene && <option value="">{t.noScenes}</option>}
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {scene && (
        <>
          <div className="scene-summary">
            <strong>{scene.name}</strong>
            <span>
              {scene.width} × {scene.height} · {scene.gridSize}px grid
            </span>
            <small>{scene.active ? t.onPlayerTable : t.privatePreparation}</small>
          </div>
          {dm && (
            <div className="compact-actions">
              <Button disabled={disabled} onClick={onRename}>
                {t.renameScene}
              </Button>
              <Button disabled={disabled} onClick={onDelete}>
                {t.deleteScene}
              </Button>
            </div>
          )}
          <h3>
            Scene tokens <span>{scene.tokens.length}</span>
          </h3>
          <ul className="token-list">
            {scene.tokens.map((token) => (
              <li key={token.id}>
                <img src={api.asset(scene.campaignId, token.assetId)} alt="" />
                <button
                  type="button"
                  className="text-button token-select"
                  aria-pressed={selectedId === token.id}
                  onClick={() => onSelect(token.id)}
                >
                  {token.name}
                </button>
                {token.visibility === "dm" && <LockKeyhole size={12} aria-label={t.dmOnly} />}
              </li>
            ))}
          </ul>
          {dm && (
            <>
              <h3>Fog of war</h3>
              <FogControls
                key={scene.id}
                scene={scene}
                disabled={disabled}
                tool={fogTool}
                onTool={onFogTool}
                send={send}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
export function PeoplePanel({
  members,
  userId,
  revokeId,
  onRevokeId,
  onRevoke,
  disabled,
  error,
}: {
  members: { id: string; displayName: string; role: string }[];
  userId: string;
  revokeId: string | null;
  onRevokeId: (id: string | null) => void;
  onRevoke: (id: string) => void;
  disabled: boolean;
  error: unknown;
}) {
  return (
    <section className="members-list" aria-label="Campaign members">
      <p className="panel-hint">
        Members of this campaign. This list does not indicate online presence.
      </p>
      {members.map((member) => (
        <div key={member.id} className="member-entry">
          <div className="member-row">
            <span className="avatar">{member.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{member.displayName}</strong>
              <small>{member.role === "dm" ? t.dm : t.player}</small>
            </div>
            {member.id !== userId && (
              <button
                type="button"
                className="mini-action"
                aria-label={`${t.revokeAccess} · ${member.displayName}`}
                title={t.revokeAccess}
                onClick={() => onRevokeId(revokeId === member.id ? null : member.id)}
              >
                <UserMinus size={15} />
              </button>
            )}
          </div>
          {revokeId === member.id && (
            <div className="revoke-confirm">
              <p>{t.revokeWarning}</p>
              <Button onClick={() => onRevokeId(null)}>{t.cancel}</Button>
              <Button className="danger" disabled={disabled} onClick={() => onRevoke(member.id)}>
                {t.revokeAccess}
              </Button>
            </div>
          )}
        </div>
      ))}
      <ErrorMessage error={error} />
    </section>
  );
}
