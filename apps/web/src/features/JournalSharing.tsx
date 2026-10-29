import type { Journal, Participant, TokenCommand } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useState } from "react";
import { t } from "../i18n/en";
import { Recipients, selectionUnavailable } from "./Recipients";
export type JournalAudience = Journal["visibility"];
export function readersUnavailable(
  scope: JournalAudience,
  ids: string[],
  players: Participant[],
  available: boolean,
) {
  return scope === "selected" && selectionUnavailable(ids, players, "", available);
}
export function JournalAudienceFields({
  scope,
  ids,
  players,
  available,
  disabled,
  onChange,
  label = "Page visibility",
  imageChanged = false,
}: {
  scope: JournalAudience;
  ids: string[];
  players: Participant[];
  available: boolean;
  disabled: boolean;
  onChange: (scope: JournalAudience, ids: string[]) => void;
  label?: string;
  imageChanged?: boolean;
}) {
  return (
    <>
      <label>
        {label}
        <select
          aria-label={label}
          value={scope}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value as JournalAudience, e.target.value === "selected" ? ids : [])
          }
        >
          <option value="dm">{t.dmOnly}</option>
          <option value="shared" disabled={imageChanged}>
            {t.shared}
          </option>
          <option value="selected" disabled={imageChanged}>
            Selected players
          </option>
        </select>
      </label>
      {scope === "selected" && (
        <Recipients
          participants={players}
          userId=""
          selected={ids}
          onChange={(value) => onChange(scope, value)}
          disabled={disabled}
          available={available}
        />
      )}
    </>
  );
}
export function JournalSharing({
  page,
  current,
  participants,
  available,
  disabled,
  send,
  onClose,
}: {
  page: Journal;
  current?: Journal;
  participants: Participant[];
  available: boolean;
  disabled: boolean;
  send: (c: TokenCommand) => Promise<void>;
  onClose: () => void;
}) {
  const [base, setBase] = useState(page),
    [scope, setScope] = useState(page.visibility),
    [ids, setIds] = useState(page.recipientIds ?? []);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const players = participants.filter((p) => p.role === "player");
  const stale = current?.version !== base.version;
  const blocked =
    disabled || pending || stale || readersUnavailable(scope, ids, players, available);
  function reload() {
    if (current) {
      setBase(current);
      setScope(current.visibility);
      setIds(current.recipientIds ?? []);
      setError(null);
    }
  }
  return (
    <Dialog
      title="Share page"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <p>{base.title}</p>
      <p className="muted">
        GMs can always read this page. Choose everyone, specific players, or GM-only. Hiding cannot
        recall content already received or independent image grants.
      </p>
      {stale && (
        <div role="status">
          <p>
            {current
              ? "This page changed. Reload before sharing; your selection is kept."
              : "This page was removed."}
          </p>
          {current && (
            <Button type="button" disabled={pending} onClick={reload}>
              Reload sharing
            </Button>
          )}
        </div>
      )}
      <JournalAudienceFields
        label="Share with"
        scope={scope}
        ids={ids}
        players={players}
        available={available}
        disabled={pending}
        onChange={(s, r) => {
          setScope(s);
          setIds(r);
        }}
      />
      <ErrorMessage error={error} />
      <div className="dialog-actions">
        <Button type="button" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={blocked}
          onClick={() => {
            if (blocked) return;
            setPending(true);
            setError(null);
            void send({
              type: "journal.update",
              payload: {
                journalId: base.id,
                expectedVersion: base.version,
                title: base.title,
                body: base.body,
                assetId: base.assetId ?? null,
                visibility: scope,
                recipientIds: scope === "selected" ? ids : [],
              },
            })
              .then(onClose)
              .catch((reason) =>
                setError(reason instanceof Error ? reason : new Error("Sharing failed.")),
              )
              .finally(() => setPending(false));
          }}
        >
          Save sharing
        </Button>
      </div>
    </Dialog>
  );
}
