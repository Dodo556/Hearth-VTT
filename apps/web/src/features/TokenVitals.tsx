import { type Token, type TokenCommand, TokenCommandSchema } from "@hearth/protocol";
import { Button, ErrorMessage } from "@hearth/ui";
import { useEffect, useRef, useState } from "react";
import { tokenStatusCatalog } from "./tokenStatusCatalog";

type Props = {
  token: Token;
  dm: boolean;
  disabled: boolean;
  send: (command: TokenCommand) => Promise<void>;
};
type Status = NonNullable<Token["statuses"]>[number];
type Draft = {
  version: number;
  actorId: string | null;
  actorVersion: number | null;
  hp: string;
  maxHp: string;
  hpVisibility: "controllers" | "shared";
  statuses: Status[];
};
function initial(token: Token, v: NonNullable<Token["vitals"]>): Draft {
  return {
    version: v.version,
    actorId: token.actorId,
    actorVersion: v.actorVersion ?? null,
    hp: v.hp === null ? "" : String(v.hp),
    maxHp: v.maxHp === null ? "" : String(v.maxHp),
    hpVisibility: v.hpVisibility,
    statuses: [...(token.statuses ?? [])],
  };
}
function StatusSummary({ token }: { token: Token }) {
  return (
    <div className="token-status-summary">
      {tokenStatusCatalog
        .filter((s) => token.statuses?.includes(s.id))
        .map((s) => (
          <span key={s.id}>
            <s.Icon size={14} aria-hidden="true" />
            {s.label}
          </span>
        ))}
    </div>
  );
}
export function TokenVitals(props: Props) {
  return props.token.vitals ? (
    <EditableVitals {...props} resource={props.token.vitals} />
  ) : (
    <section className="token-vitals">
      <h3>Health & status</h3>
      <p className="muted">
        {props.token.health
          ? `${props.token.health.hp} / ${props.token.health.maxHp} HP`
          : "HP is not shared for this token."}
      </p>
      <StatusSummary token={props.token} />
    </section>
  );
}
function EditableVitals({
  token,
  dm,
  disabled,
  send,
  resource: v,
}: Props & { resource: NonNullable<Token["vitals"]> }) {
  const [draft, setDraft] = useState(() => initial(token, v));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) setDraft(initial(token, v));
  }, [token, v, dirty]);
  const stale =
    dirty &&
    (draft.version !== v.version ||
      draft.actorId !== token.actorId ||
      draft.actorVersion !== (v.actorVersion ?? null));
  const command: TokenCommand = {
    type: "token.vitals.update",
    payload: {
      tokenId: token.id,
      expectedVersion: draft.version,
      expectedActorId: draft.actorId,
      expectedActorVersion: draft.actorVersion,
      hp: draft.hp === "" ? null : Number(draft.hp),
      maxHp: draft.maxHp === "" ? null : Number(draft.maxHp),
      hpVisibility: draft.hpVisibility,
      statuses: draft.statuses,
    },
  };
  const valid = TokenCommandSchema.safeParse(command).success;
  const blocked = disabled || pending || stale || !dirty || !valid;
  function change(values: Partial<Draft>) {
    setDraft((old) => ({ ...old, ...values }));
    setDirty(true);
    setError(null);
  }
  function reload() {
    setDraft(initial(token, v));
    setDirty(false);
    setError(null);
  }
  async function save() {
    if (blocked) return;
    setPending(true);
    setError(null);
    try {
      await send(command);
      if (mounted.current) setDirty(false);
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e
            : new Error("Health and status could not be saved. Your draft is kept."),
        );
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  return (
    <section className="token-vitals" aria-label="Token health and status">
      <h3>Health & status</h3>
      <p className="panel-hint">
        {token.actorId
          ? "Linked HP: changes here update the character sheet. Independent HP is stored separately."
          : "Set both HP values to add a bar. Clear both to remove it."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {stale && !pending && (
          <div className="notice" role="status">
            <p>This token or linked sheet changed. Your draft is kept.</p>
            <Button type="button" onClick={reload}>
              Reload health & status
            </Button>
          </div>
        )}
        <div className="token-hp-fields">
          <label>
            Current HP
            <input
              aria-label="Current HP"
              type="number"
              min={0}
              max={1000000}
              step={1}
              value={draft.hp}
              placeholder="Not set"
              disabled={pending}
              onChange={(e) => change({ hp: e.target.value })}
            />
          </label>
          <label>
            Maximum HP
            <input
              aria-label="Maximum HP"
              type="number"
              min={1}
              max={1000000}
              step={1}
              value={draft.maxHp}
              placeholder="Not set"
              disabled={pending}
              onChange={(e) => change({ maxHp: e.target.value })}
            />
          </label>
        </div>
        {dm && (
          <label>
            Map HP visibility
            <select
              aria-label="Map HP visibility"
              value={draft.hpVisibility}
              disabled={pending}
              onChange={(e) => change({ hpVisibility: e.target.value as Draft["hpVisibility"] })}
            >
              <option value="controllers">GMs & controllers</option>
              <option value="shared">Everyone with token access</option>
            </select>
          </label>
        )}
        <p className="panel-hint">
          {dm
            ? "Sharing a bar also requires access to a linked sheet."
            : "The GM controls who can see the map HP bar."}
        </p>
        <fieldset className="token-marker-picker">
          <legend>Status markers</legend>
          {tokenStatusCatalog.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={draft.statuses.includes(s.id)}
              disabled={pending}
              onClick={() =>
                change({
                  statuses: draft.statuses.includes(s.id)
                    ? draft.statuses.filter((x) => x !== s.id)
                    : [...draft.statuses, s.id],
                })
              }
            >
              <s.Icon size={16} aria-hidden="true" />
              <span>{s.label}</span>
            </button>
          ))}
        </fieldset>
        <p className="panel-hint">
          Markers are visible with the token. They do not apply game rules.
        </p>
        {!valid && (
          <p className="error-message">
            Set both HP values, with current HP between zero and maximum HP.
          </p>
        )}
        <ErrorMessage error={error} />
        <div className="dialog-actions">
          <Button type="button" disabled={pending || !dirty} onClick={reload}>
            Reset changes
          </Button>
          <Button type="submit" disabled={blocked}>
            {pending ? "Saving…" : "Save health & status"}
          </Button>
        </div>
      </form>
    </section>
  );
}
