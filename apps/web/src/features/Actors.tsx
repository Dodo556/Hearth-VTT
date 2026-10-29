import { type Actor, newRequestId, type TokenCommand } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { t } from "../i18n/en";
import { PrivateCopyDialog } from "./PrivateCopyDialog";

type Send = (c: TokenCommand) => Promise<void>;
type Member = { id: string; displayName: string; role: string };
export function Actors({
  campaignId,
  actors,
  dm,
  disabled,
  members,
  send,
  selectedId,
  onSelect,
}: {
  campaignId: string;
  actors: Actor[];
  dm: boolean;
  disabled: boolean;
  members: Member[];
  send: Send;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [copying, setCopying] = useState<Actor | null>(null);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const selected = actors.find((a) => a.id === selectedId) ?? actors[0];
  const edited = actors.find((a) => a.id === editId);
  const run = (c: TokenCommand) => {
    setError(null);
    void send(c).catch((e: Error) => setError(e));
  };
  return (
    <section aria-label={t.characters} className="actors-dock">
      <div className="actor-actions">
        <span className="eyebrow">{t.characters}</span>
        {dm && (
          <Button disabled={disabled || actors.length >= 16} onClick={() => setCreating(true)}>
            {t.newActor}
          </Button>
        )}
      </div>
      <div className="actor-list">
        {actors.map((a) => (
          <button
            key={a.id}
            className={a.id === selected?.id ? "selected" : ""}
            type="button"
            onClick={() => {
              onSelect(a.id);
              setConfirm(null);
            }}
          >
            <img src={api.asset(campaignId, a.assetId)} alt="" />
            <span>{a.name}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <article className="actor-sheet">
          <span className="visibility-label">
            {selected.kind === "npc" ? t.npc : t.character} ·{" "}
            {selected.visibility === "dm" ? t.privateActor : t.shared}
          </span>
          <img
            className="actor-portrait"
            src={api.asset(campaignId, selected.assetId)}
            alt={selected.name}
          />
          <h2>{selected.name}</h2>
          <div className="actor-health">
            <span>{t.hitPoints}</span>
            <strong data-testid="actor-hp">
              {selected.hp} / {selected.maxHp}
            </strong>
          </div>
          <p className="actor-biography">{selected.biography || t.noBiography}</p>
          <dl className="actor-properties">
            {Object.entries(selected.attributes).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {dm && (
            <details className="actor-dm-notes">
              <summary>{t.dmNotes}</summary>
              <p>{selected.dmNotes || t.noDmNotes}</p>
            </details>
          )}
          <div className="actor-actions">
            {selected.canEdit && (
              <Button disabled={disabled} onClick={() => setEditId(selected.id)}>
                {t.editSheet}
              </Button>
            )}
            {dm && (
              <Button
                disabled={disabled || actors.length >= 16}
                onClick={() => setCopying(selected)}
              >
                Use as template
              </Button>
            )}
            {dm && (
              <Button disabled={disabled} onClick={() => setConfirm(selected.id)}>
                {t.deleteActor}
              </Button>
            )}
          </div>
          {dm && (
            <div className="actor-permissions">
              <h3>{t.actorPermissions}</h3>
              <p className="muted">{t.actorPermissionHint}</p>
              <label>
                {t.actorVisibility}
                <select
                  aria-label={t.actorVisibility}
                  value={selected.visibility}
                  disabled={disabled}
                  onChange={(e) =>
                    run({
                      type: "actor.visibility",
                      payload: {
                        actorId: selected.id,
                        visibility: e.target.value as "dm" | "shared",
                      },
                    })
                  }
                >
                  <option value="dm">{t.privateActor}</option>
                  <option value="shared">{t.shared}</option>
                </select>
              </label>
              {members
                .filter((m) => m.role === "player")
                .map((m) => (
                  <label key={m.id}>
                    {m.displayName}
                    <select
                      aria-label={`${t.permissionFor} ${m.displayName}`}
                      value={
                        selected.permissions?.find((g) => g.userId === m.id)?.permission ?? "none"
                      }
                      disabled={disabled}
                      onChange={(e) =>
                        run({
                          type: "actor.permission",
                          payload: {
                            actorId: selected.id,
                            userId: m.id,
                            permission: e.target.value as "none" | "observer" | "owner",
                          },
                        })
                      }
                    >
                      <option value="none">{t.noActorAccess}</option>
                      <option value="observer">{t.observerPermission}</option>
                      <option value="owner">{t.ownerPermission}</option>
                    </select>
                  </label>
                ))}
            </div>
          )}
          {confirm === selected.id && (
            <div className="notice">
              <p>{t.deleteActorHint}</p>
              <Button onClick={() => setConfirm(null)}>{t.cancel}</Button>
              <Button
                className="danger"
                disabled={disabled}
                onClick={() => {
                  run({ type: "actor.delete", payload: { actorId: selected.id } });
                  setConfirm(null);
                }}
              >
                {t.confirmActorDelete}
              </Button>
            </div>
          )}
        </article>
      ) : (
        <p className="muted">{t.noActors}</p>
      )}
      {copying && dm && (
        <PrivateCopyDialog
          key={copying.id}
          source={{ id: copying.id, version: copying.version, label: copying.name }}
          records={actors.map((a) => ({ id: a.id, version: a.version, label: a.name }))}
          title="Use actor as template"
          nameLabel="Copy name"
          description="Create a GM-only actor with the saved type, portrait, biography, GM notes, current HP and custom properties. Ownership, token links and combat entries are not copied. The original actor stays intact."
          limitMessage="Copies count toward the 16-actor campaign limit."
          disabled={disabled}
          full={actors.length >= 16}
          send={send}
          onClose={() => setCopying(null)}
          onCopied={(id) => {
            onSelect(id);
            setCopying(null);
          }}
          commandFor={(base, id, name) => ({
            type: "actor.copy",
            payload: { sourceActorId: base.id, expectedVersion: base.version, actorId: id, name },
          })}
        />
      )}
      <ErrorMessage error={error} />
      {(creating || (edited?.canEdit && editId)) && (
        <ActorEditor
          key={creating ? "new" : editId}
          campaignId={campaignId}
          actor={creating ? undefined : edited}
          dm={dm}
          disabled={disabled}
          send={send}
          onClose={() => {
            setCreating(false);
            setEditId(null);
          }}
          onCreated={onSelect}
        />
      )}
    </section>
  );
}
function ActorEditor({
  campaignId,
  actor,
  dm,
  disabled,
  send,
  onClose,
  onCreated,
}: {
  campaignId: string;
  actor?: Actor;
  dm: boolean;
  disabled: boolean;
  send: Send;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const client = useQueryClient();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [target] = useState(actor?.id);
  const [version, setVersion] = useState(actor?.version ?? 1);
  const [name, setName] = useState(actor?.name ?? "");
  const [kind, setKind] = useState<"character" | "npc">(actor?.kind ?? "character");
  const [bio, setBio] = useState(actor?.biography ?? "");
  const [notes, setNotes] = useState(actor?.dmNotes ?? "");
  const [hp, setHp] = useState(actor?.hp ?? 12);
  const [maxHp, setMaxHp] = useState(actor?.maxHp ?? 20);
  const [assetId, setAssetId] = useState(actor?.assetId ?? "token-warden");
  const rows = (attributes: Record<string, string>): [string, string, string][] =>
    Object.entries(attributes).map(([key, value]) => [newRequestId(), key, value]);
  const [properties, setProperties] = useState<[string, string, string][]>(() =>
    rows(actor?.attributes ?? {}),
  );
  const [uploaded, setUploaded] = useState<string | null>(null);
  const assets = useQuery({
    queryKey: ["assets", campaignId],
    queryFn: () => api.assets(campaignId),
    enabled: dm,
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadAsset(campaignId, file),
    onSuccess: async (r) => {
      if (alive.current) {
        setAssetId(r.asset.id);
        setUploaded(r.asset.id);
      }
      await client.invalidateQueries({ queryKey: ["assets", campaignId] });
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (target && (!actor || actor.id !== target || !actor.canEdit))
        throw new Error(t.actorUnavailable);
      if (
        properties.some(([, key]) => !key.trim()) ||
        new Set(properties.map(([, key]) => key.trim())).size !== properties.length
      )
        throw new Error(t.uniqueProperties);
      const attributes = Object.fromEntries(
        properties.map(([, key, value]) => [key.trim(), value]),
      );
      const actorId = target ?? newRequestId();
      if (target)
        await send({
          type: "actor.update",
          payload: {
            actorId,
            expectedVersion: version,
            name: name.trim(),
            biography: bio,
            hp,
            maxHp,
            attributes,
            ...(dm ? { assetId, dmNotes: notes } : {}),
          },
        });
      else
        await send({
          type: "actor.create",
          payload: {
            actorId,
            name: name.trim(),
            kind,
            assetId,
            biography: bio,
            dmNotes: notes,
            hp,
            maxHp,
            attributes,
          },
        });
      return actorId;
    },
    onSuccess: (id) => {
      if (alive.current) {
        onCreated(id);
        onClose();
      }
    },
  });
  const reload = () => {
    if (actor) {
      setVersion(actor.version);
      setName(actor.name);
      setBio(actor.biography);
      setNotes(actor.dmNotes ?? "");
      setHp(actor.hp);
      setMaxHp(actor.maxHp);
      setAssetId(actor.assetId);
      setProperties(rows(actor.attributes));
      save.reset();
    }
  };
  return (
    <Dialog title={target ? t.editSheet : t.newActor} onClose={onClose}>
      <form
        className="form-stack actor-editor"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {actor && actor.version !== version && (
          <div className="notice">
            <p>{t.sheetUpdateAvailable}</p>
            <Button type="button" onClick={reload}>
              {t.reloadSheet}
            </Button>
          </div>
        )}
        <label>
          {t.actorName}
          <input
            aria-label={t.actorName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            autoFocus
          />
        </label>
        {!target && (
          <label>
            {t.actorKind}
            <select
              aria-label={t.actorKind}
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="character">{t.character}</option>
              <option value="npc">{t.npc}</option>
            </select>
          </label>
        )}
        {dm && (
          <>
            <label>
              {t.portraitUpload}
              <input
                aria-label={t.portraitUpload}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={upload.isPending || save.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                }}
              />
            </label>
            {uploaded && <p className="muted">{t.portraitUploaded}</p>}
            <label>
              {t.portraitArt}
              <select
                aria-label={t.portraitArt}
                value={assetId}
                disabled={upload.isPending}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="token-warden">{t.wardenArt}</option>
                <option value="token-scout">{t.scoutArt}</option>
                <option value="vault-sentinel">{t.sentinelArt}</option>
                {assets.data?.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {t.uploadedArt} {a.id.slice(0, 8)}
                  </option>
                ))}
                {uploaded && !assets.data?.assets.some((a) => a.id === uploaded) && (
                  <option value={uploaded}>{t.uploadedArt}</option>
                )}
              </select>
            </label>
          </>
        )}
        <label>
          {t.biography}
          <textarea
            aria-label={t.biography}
            value={bio}
            maxLength={1000}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <div className="token-coordinates">
          <label>
            {t.currentHp}
            <input
              aria-label={t.currentHp}
              type="number"
              min={0}
              max={maxHp}
              value={hp}
              required
              onChange={(e) => setHp(Number(e.target.value))}
            />
          </label>
          <label>
            {t.maxHp}
            <input
              aria-label={t.maxHp}
              type="number"
              min={1}
              max={1000000}
              value={maxHp}
              required
              onChange={(e) => setMaxHp(Number(e.target.value))}
            />
          </label>
        </div>
        <fieldset className="actor-property-editor">
          <legend>{t.customProperties}</legend>
          {properties.map(([id, key, value], i) => (
            <div className="actor-property-row" key={id}>
              <input
                aria-label={`${t.propertyName} ${i + 1}`}
                placeholder={t.propertyName}
                value={key}
                maxLength={40}
                required
                onChange={(e) =>
                  setProperties((old) =>
                    old.map((p) => (p[0] === id ? [id, e.target.value, p[2]] : p)),
                  )
                }
              />
              <input
                aria-label={`${t.propertyValue} ${i + 1}`}
                placeholder={t.propertyValue}
                value={value}
                maxLength={120}
                onChange={(e) =>
                  setProperties((old) =>
                    old.map((p) => (p[0] === id ? [id, p[1], e.target.value] : p)),
                  )
                }
              />
              <Button
                type="button"
                aria-label={`${t.removeProperty} ${i + 1}`}
                onClick={() => setProperties((old) => old.filter((p) => p[0] !== id))}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            type="button"
            disabled={properties.length >= 8}
            onClick={() => setProperties((old) => [...old, [newRequestId(), "", ""]])}
          >
            {t.addProperty}
          </Button>
        </fieldset>
        {dm && (
          <label>
            {t.dmNotes}
            <textarea
              aria-label={t.dmNotes}
              value={notes}
              rows={3}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
            />
            <small>{t.dmNotesHint}</small>
          </label>
        )}
        <ErrorMessage error={save.error ?? upload.error ?? assets.error} />
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            className="primary"
            disabled={disabled || upload.isPending || save.isPending || !name.trim()}
          >
            {target ? t.saveSheet : t.createActor}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
