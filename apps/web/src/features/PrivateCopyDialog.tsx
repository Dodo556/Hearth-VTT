import { type TokenCommand, TokenCommandSchema } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useEffect, useRef, useState } from "react";

type CopySource = { id: string; version: number; label: string };
export function PrivateCopyDialog({
  source,
  records,
  title,
  nameLabel,
  description,
  limitMessage,
  disabled,
  full,
  commandFor,
  send,
  onClose,
  onCopied,
}: {
  source: CopySource;
  records: CopySource[];
  title: string;
  nameLabel: string;
  description: string;
  limitMessage: string;
  disabled: boolean;
  full: boolean;
  commandFor: (source: CopySource, id: string, name: string) => TokenCommand;
  send: (command: TokenCommand) => Promise<void>;
  onClose: () => void;
  onCopied: (id: string) => void;
}) {
  const [base, setBase] = useState(source),
    [name, setName] = useState(source.label),
    [id] = useState(() => crypto.randomUUID()),
    [pending, setPending] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = records.find((r) => r.id === base.id),
    saved = records.some((r) => r.id === id),
    stale = current?.version !== base.version,
    command = commandFor(base, id, name),
    blocked =
      disabled ||
      pending ||
      full ||
      stale ||
      saved ||
      !TokenCommandSchema.safeParse(command).success;
  return (
    <Dialog
      title={title}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (blocked) return;
          setPending(true);
          setError(null);
          void sendCopy();
          async function sendCopy() {
            try {
              await send(command);
              if (mounted.current) onCopied(id);
            } catch (reason) {
              if (mounted.current)
                setError(reason instanceof Error ? reason : new Error("Copy failed."));
            } finally {
              if (mounted.current) setPending(false);
            }
          }
        }}
      >
        <p>Template: {base.label}</p>
        <p className="muted">{description}</p>
        <p className="muted">Existing artwork access through other records still applies.</p>
        {saved ? (
          <div role="status">
            <p>The copy is already saved. Open it to continue.</p>
            <Button type="button" disabled={pending} onClick={() => onCopied(id)}>
              Open saved copy
            </Button>
          </div>
        ) : (
          stale && (
            <div role="status">
              <p>
                {current
                  ? "This template changed. Reload before copying; your name is kept."
                  : "This template was removed."}
              </p>
              {current && (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setBase(current);
                    setError(null);
                  }}
                >
                  Reload template
                </Button>
              )}
            </div>
          )
        )}
        <label>
          {nameLabel}
          <input
            aria-label={nameLabel}
            required
            maxLength={160}
            value={name}
            disabled={pending || saved}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="muted">Use 1–80 characters. {limitMessage}</p>
        {full && !saved && <p role="status">The campaign has reached its record limit.</p>}
        <ErrorMessage error={error} />
        <div className="dialog-actions">
          <Button type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={blocked}>
            {pending ? "Creating copy…" : "Create private copy"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
