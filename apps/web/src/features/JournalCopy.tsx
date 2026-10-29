import { type Journal, type TokenCommand, TokenCommandSchema } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useEffect, useRef, useState } from "react";

export function JournalCopy({
  page,
  current,
  disabled,
  full,
  send,
  onClose,
  onCopied,
}: {
  page: Journal;
  current?: Journal;
  disabled: boolean;
  full: boolean;
  send: (command: TokenCommand) => Promise<void>;
  onClose: () => void;
  onCopied: (id: string) => void;
}) {
  const [base, setBase] = useState(page),
    [title, setTitle] = useState(page.title),
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
  const command: TokenCommand = {
    type: "journal.copy",
    payload: { sourceJournalId: base.id, expectedVersion: base.version, journalId: id, title },
  };
  const stale = current?.version !== base.version;
  const valid = TokenCommandSchema.safeParse(command).success;
  const blocked = disabled || pending || full || stale || !valid;
  return (
    <Dialog
      title="Use page as template"
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
          void send(command)
            .then(() => {
              if (mounted.current) onCopied(id);
            })
            .catch((reason) => {
              if (mounted.current)
                setError(reason instanceof Error ? reason : new Error("Copy failed."));
            })
            .finally(() => {
              if (mounted.current) setPending(false);
            });
        }}
      >
        <p>Template: {base.title}</p>
        <p className="muted">
          Create a GM-only page at Top level with the saved text, formatting and image. Player
          sharing and folder placement are not copied. The original page stays intact.
        </p>
        {base.assetId && (
          <p className="muted">
            The image is reused. Existing image access through other pages or records still applies.
          </p>
        )}
        {stale && (
          <div role="status">
            <p>
              {current
                ? "This template changed. Reload before copying; your title is kept."
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
        )}
        <label>
          Copy title
          <input
            aria-label="Copy title"
            value={title}
            required
            maxLength={160}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <p className="muted">
          Use 1–80 characters. Copies count toward the 16-page campaign limit.
        </p>
        {full && <p role="status">This campaign already has 16 journal pages.</p>}
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
