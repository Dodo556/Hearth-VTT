import {
  type Combatant,
  type Encounter,
  newRequestId,
  type Scene,
  type TokenCommand,
} from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { Check, ChevronRight, Flag, Heart, Plus, RotateCcw, Swords, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";

type Run = (command: TokenCommand) => Promise<boolean>;
function CombatantRow({
  entry,
  active,
  disabled,
  dm,
  campaignId,
  run,
  onFocus,
  onRemove,
}: {
  entry: Combatant;
  active: boolean;
  disabled: boolean;
  dm: boolean;
  campaignId: string;
  run: Run;
  onFocus: () => void;
  onRemove: () => void;
}) {
  const [initiative, setInitiative] = useState({
    value: entry.initiative === null ? "" : String(entry.initiative),
    version: entry.version,
    dirty: false,
  });
  const [health, setHealth] = useState({
    value: String(entry.hp ?? ""),
    actorId: entry.actorId,
    version: entry.actorVersion,
    dirty: false,
  });
  useEffect(() => {
    if (!initiative.dirty)
      setInitiative({
        value: entry.initiative === null ? "" : String(entry.initiative),
        version: entry.version,
        dirty: false,
      });
  }, [entry.initiative, entry.version, initiative.dirty]);
  useEffect(() => {
    if (!health.dirty)
      setHealth({
        value: String(entry.hp ?? ""),
        actorId: entry.actorId,
        version: entry.actorVersion,
        dirty: false,
      });
  }, [entry.hp, entry.actorId, entry.actorVersion, health.dirty]);
  const staleInitiative = initiative.dirty && initiative.version !== entry.version;
  const staleHealth =
    health.dirty && (health.actorId !== entry.actorId || health.version !== entry.actorVersion);
  return (
    <article
      className={`combatant-row ${active ? "current" : ""}`}
      data-testid="combatant"
      data-combatant-id={entry.id}
      aria-current={active ? "step" : undefined}
    >
      <div className="combatant-main">
        {entry.canEditInitiative ? (
          <form
            className="initiative-editor"
            onSubmit={(e) => {
              e.preventDefault();
              if (disabled || staleInitiative) return;
              void run({
                type: "combat.initiative",
                payload: {
                  combatantId: entry.id,
                  expectedVersion: initiative.version,
                  initiative: initiative.value === "" ? null : Number(initiative.value),
                },
              }).then((saved) => {
                if (saved) setInitiative((old) => ({ ...old, dirty: false }));
              });
            }}
          >
            <input
              aria-label={`Initiative for ${entry.name}`}
              title="Initiative"
              type="number"
              min={-1000}
              max={1000}
              value={initiative.value}
              placeholder="—"
              disabled={disabled}
              onChange={(e) => setInitiative({ ...initiative, value: e.target.value, dirty: true })}
            />
            {initiative.dirty && (
              <button
                className="mini-action"
                type="submit"
                aria-label={`Set initiative for ${entry.name}`}
                title="Set initiative"
                disabled={disabled || staleInitiative}
              >
                <Check size={12} />
              </button>
            )}
            {staleInitiative && (
              <button
                type="button"
                className="mini-action"
                aria-label={`Reload initiative for ${entry.name}`}
                title="Changed elsewhere · reload initiative"
                onClick={() =>
                  setInitiative({
                    value: entry.initiative === null ? "" : String(entry.initiative),
                    version: entry.version,
                    dirty: false,
                  })
                }
              >
                <RotateCcw size={12} />
              </button>
            )}
          </form>
        ) : (
          <span className="initiative-value">{entry.initiative ?? "—"}</span>
        )}
        {campaignId ? (
          <img src={api.asset(campaignId, entry.assetId)} alt="" />
        ) : (
          <span className="combatant-initial">{entry.name.slice(0, 1)}</span>
        )}
        <button
          type="button"
          className="combatant-name"
          onClick={onFocus}
          title="Select token on the map"
        >
          <strong>{entry.name}</strong>
          <small>{active ? "Current turn" : entry.actorId ? "Linked character" : "Token"}</small>
        </button>
        {dm && (
          <button
            type="button"
            className="mini-action combatant-remove"
            aria-label={`Remove ${entry.name} from combat`}
            title="Remove from encounter"
            disabled={disabled}
            onClick={onRemove}
          >
            <X size={12} />
          </button>
        )}
      </div>
      {entry.hp !== undefined && entry.maxHp !== undefined && (
        <div className="combatant-health">
          <Heart size={11} />
          {entry.canEditHp && entry.actorVersion !== undefined ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (disabled || staleHealth || health.version === undefined || !health.actorId)
                  return;
                void run({
                  type: "combat.hp",
                  payload: {
                    combatantId: entry.id,
                    expectedActorId: health.actorId,
                    expectedActorVersion: health.version,
                    hp: Number(health.value),
                  },
                }).then((saved) => {
                  if (saved) setHealth((old) => ({ ...old, dirty: false }));
                });
              }}
            >
              <input
                aria-label={`HP for ${entry.name}`}
                type="number"
                min={0}
                max={entry.maxHp}
                required
                value={health.value}
                disabled={disabled}
                onChange={(e) => setHealth({ ...health, value: e.target.value, dirty: true })}
              />
              <span>/ {entry.maxHp}</span>
              {health.dirty && (
                <button
                  type="submit"
                  className="mini-action"
                  aria-label={`Save HP for ${entry.name}`}
                  title="Save HP"
                  disabled={disabled || staleHealth}
                >
                  <Check size={12} />
                </button>
              )}
              {staleHealth && (
                <button
                  type="button"
                  className="mini-action"
                  aria-label={`Reload HP for ${entry.name}`}
                  title="Changed elsewhere · reload HP"
                  onClick={() =>
                    setHealth({
                      value: String(entry.hp),
                      actorId: entry.actorId,
                      version: entry.actorVersion,
                      dirty: false,
                    })
                  }
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </form>
          ) : (
            <span>
              {entry.hp} / {entry.maxHp}
            </span>
          )}
          <meter
            min={0}
            max={entry.maxHp}
            value={entry.hp}
            aria-label={`Hit points for ${entry.name}`}
          />
        </div>
      )}
      {(staleHealth || staleInitiative) && (
        <small className="combat-stale" role="status">
          Changed elsewhere. Reload the marked field; your draft is kept.
        </small>
      )}
    </article>
  );
}
export function Combat({
  encounter,
  scene,
  dm,
  disabled,
  send,
  onFocusToken,
  campaignId = "",
}: {
  encounter: Encounter | null;
  scene: Scene | undefined;
  dm: boolean;
  disabled: boolean;
  send: (command: TokenCommand) => Promise<void>;
  onFocusToken: (id: string) => void;
  campaignId?: string;
}) {
  const [name, setName] = useState("Encounter"),
    [tokenId, setTokenId] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const [confirmation, setConfirmation] = useState<{
    action: "end" | "clear" | "remove";
    id: string;
    encounterId: string;
    version: number;
    name: string;
  } | null>(null);
  const blocked = disabled || pending;
  const run: Run = async (command) => {
    setError(null);
    setPending(true);
    try {
      await send(command);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("The encounter could not be updated."));
      return false;
    } finally {
      setPending(false);
    }
  };
  if (!encounter)
    return (
      <section className="combat-panel combat-empty" aria-label="Combat tracker">
        <Swords size={34} />
        <h3>No encounter prepared</h3>
        <p>
          {dm
            ? "Choose a scene, prepare an encounter and add its tokens to the turn order."
            : "Your GM can prepare an encounter for this scene."}
        </p>
        {dm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (scene && !blocked)
                void run({
                  type: "combat.create",
                  payload: {
                    clientEncounterId: newRequestId(),
                    sceneId: scene.id,
                    name: name.trim(),
                  },
                });
            }}
          >
            <label>
              Encounter name
              <input
                aria-label="Encounter name"
                value={name}
                maxLength={80}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button type="submit" className="primary" disabled={blocked || !scene || !name.trim()}>
              <Plus size={14} />
              Prepare encounter
            </Button>
          </form>
        )}
        <ErrorMessage error={error} />
      </section>
    );
  const active = encounter.combatants.find((e) => e.id === encounter.activeCombatantId);
  const available =
    scene?.id === encounter.sceneId
      ? scene.tokens.filter((t) => !encounter.combatants.some((e) => e.tokenId === t.id))
      : [];
  const chosen = available.some((t) => t.id === tokenId) ? tokenId : (available[0]?.id ?? "");
  const control = (type: "combat.start" | "combat.next") =>
    void run({ type, payload: { encounterId: encounter.id, expectedVersion: encounter.version } });
  const confirm = (action: "end" | "clear") => {
    setError(null);
    setConfirmation({
      action,
      id: encounter.id,
      encounterId: encounter.id,
      version: encounter.version,
      name: encounter.name,
    });
  };
  return (
    <section className="combat-panel" aria-label="Combat tracker">
      <div className="combat-overview">
        <span className="combat-round">
          {encounter.status === "preparing"
            ? "SETUP"
            : encounter.status === "ended"
              ? "ENDED"
              : `ROUND ${encounter.round}`}
        </span>
        <h3>{encounter.name}</h3>
        <small>{scene?.name}</small>
      </div>
      {encounter.status === "active" && (
        <div className="current-turn">
          <span className="turn-indicator" />
          <span>{active?.name ?? "Awaiting GM"}</span>
          <small>{active ? "Taking a turn" : "Turn updates from the GM"}</small>
        </div>
      )}
      <div className="combat-column-labels">
        <span>INIT</span>
        <span>COMBATANT</span>
      </div>
      <div className="combatant-list">
        {encounter.combatants.map((entry) => (
          <CombatantRow
            key={entry.id}
            entry={entry}
            active={entry.id === encounter.activeCombatantId}
            disabled={blocked}
            dm={dm}
            campaignId={campaignId}
            run={run}
            onFocus={() => onFocusToken(entry.tokenId)}
            onRemove={() => {
              setError(null);
              setConfirmation({
                action: "remove",
                id: entry.id,
                encounterId: encounter.id,
                version: encounter.version,
                name: entry.name,
              });
            }}
          />
        ))}
      </div>
      {!encounter.combatants.length && (
        <p className="empty-note">No visible combatants in this encounter.</p>
      )}
      {dm && encounter.status !== "ended" && (
        <form
          className="combat-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!chosen || blocked) return;
            void run({
              type: "combat.add",
              payload: {
                encounterId: encounter.id,
                expectedVersion: encounter.version,
                clientCombatantId: newRequestId(),
                tokenId: chosen,
              },
            });
          }}
        >
          <select
            aria-label="Add combatant"
            value={chosen}
            disabled={blocked || !available.length}
            onChange={(e) => setTokenId(e.target.value)}
          >
            {!available.length && <option value="">All scene tokens added</option>}
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="button"
            aria-label="Add to encounter"
            title="Add token to encounter"
            disabled={blocked || !chosen}
          >
            <Plus size={15} />
          </button>
        </form>
      )}
      {dm && (
        <div className="combat-controls">
          {encounter.status === "preparing" && (
            <Button
              className="primary"
              disabled={blocked || !encounter.combatants.length}
              onClick={() => control("combat.start")}
            >
              <Swords size={14} />
              Begin combat
            </Button>
          )}
          {encounter.status === "active" && (
            <>
              <Button
                className="primary"
                disabled={blocked || !encounter.combatants.length}
                onClick={() => control("combat.next")}
              >
                Next turn
                <ChevronRight size={15} />
              </Button>
              <Button disabled={blocked} onClick={() => confirm("end")}>
                <Flag size={13} />
                End combat
              </Button>
            </>
          )}
          <button
            type="button"
            className="mini-action"
            aria-label="Clear encounter"
            title="Clear encounter"
            disabled={blocked}
            onClick={() => confirm("clear")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      {!confirmation && <ErrorMessage error={error} />}
      {confirmation && (
        <Dialog
          title={
            confirmation.action === "remove"
              ? "Remove combatant"
              : confirmation.action === "end"
                ? "End combat"
                : "Clear encounter"
          }
          onClose={() => {
            if (!pending) {
              setConfirmation(null);
              setError(null);
            }
          }}
        >
          <p>
            {confirmation.action === "remove"
              ? `Remove “${confirmation.name}” from the turn order? The token and character remain.`
              : confirmation.action === "end"
                ? `End “${confirmation.name}”? The turn order and character HP are retained.`
                : `Clear “${confirmation.name}” and its turn order? Character HP is retained.`}
          </p>
          {(confirmation.encounterId !== encounter.id ||
            confirmation.version !== encounter.version) && (
            <p className="notice">
              The encounter changed. Close this confirmation and review the latest state.
            </p>
          )}
          <ErrorMessage error={error} />
          <div className="dialog-actions">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirmation(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="danger"
              disabled={
                blocked ||
                confirmation.encounterId !== encounter.id ||
                confirmation.version !== encounter.version
              }
              onClick={() => {
                const action =
                  confirmation.action === "remove"
                    ? {
                        type: "combat.remove" as const,
                        payload: {
                          combatantId: confirmation.id,
                          expectedVersion: confirmation.version,
                        },
                      }
                    : {
                        type:
                          confirmation.action === "end"
                            ? ("combat.end" as const)
                            : ("combat.clear" as const),
                        payload: {
                          encounterId: confirmation.id,
                          expectedVersion: confirmation.version,
                        },
                      };
                void run(action).then((saved) => {
                  if (saved) setConfirmation(null);
                });
              }}
            >
              {confirmation.action === "remove"
                ? "Remove combatant"
                : confirmation.action === "end"
                  ? "Confirm end combat"
                  : "Confirm clear encounter"}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
