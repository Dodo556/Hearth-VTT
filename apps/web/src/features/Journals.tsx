import type { Journal, TokenCommand } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { BookOpen, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/en";

type Draft = {
  id: string;
  version: number | null;
  title: string;
  body: string;
  visibility: "dm" | "shared";
};
export function Journals({
  journals,
  dm,
  disabled,
  send,
}: {
  journals: Journal[];
  dm: boolean;
  disabled: boolean;
  send: (command: TokenCommand) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Journal | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const page = journals.find((p) => p.id === selected) ?? journals[0];
  const current = draft && journals.find((p) => p.id === draft.id);
  const stale = draft?.version !== null && !!draft && current?.version !== draft.version;
  const deleteStale =
    !!deleting && !journals.some((p) => p.id === deleting.id && p.version === deleting.version);
  function edit(p: Journal) {
    setError(null);
    setDraft({ ...p });
  }
  async function submit(command: TokenCommand, next: () => void) {
    setPending(true);
    setError(null);
    try {
      await send(command);
      if (mounted.current) next();
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e : new Error(t.journalSaveFailed));
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  return (
    <>
      <span className="eyebrow">{t.journal}</span>
      {dm && (
        <Button
          type="button"
          disabled={disabled || pending || !!draft || journals.length >= 16}
          onClick={() => {
            setError(null);
            setDraft({
              id: crypto.randomUUID(),
              version: null,
              title: "",
              body: "",
              visibility: "dm",
            });
          }}
        >
          {t.newJournal}
        </Button>
      )}
      {!draft && (
        <>
          <div className="journal-pages">
            {journals.map((p) => (
              <button
                className={page?.id === p.id ? "selected" : ""}
                type="button"
                key={p.id}
                onClick={() => {
                  setSelected(p.id);
                  setError(null);
                }}
              >
                {p.visibility === "dm" ? <LockKeyhole size={15} /> : <BookOpen size={15} />}
                <span>{p.title}</span>
              </button>
            ))}
          </div>
          {page ? (
            <article className="journal-page">
              <span className={`visibility-label ${page.visibility}`}>
                {page.visibility === "dm" ? t.dmOnly : t.shared}
              </span>
              <h2>{page.title}</h2>
              <p>{page.body}</p>
              <footer>{t.journalPlainText}</footer>
              {dm && (
                <div className="dialog-actions">
                  <Button type="button" disabled={disabled || pending} onClick={() => edit(page)}>
                    {t.editJournal}
                  </Button>
                  <Button
                    type="button"
                    className="danger"
                    disabled={disabled || pending}
                    onClick={() => {
                      setError(null);
                      setDeleting(page);
                    }}
                  >
                    {t.deleteJournal}
                  </Button>
                </div>
              )}
            </article>
          ) : (
            <p className="muted">{t.noJournals}</p>
          )}
        </>
      )}
      {draft && dm && (
        <form
          className="journal-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled || pending || stale) return;
            const fields = { journalId: draft.id, title: draft.title, body: draft.body };
            void submit(
              draft.version === null
                ? { type: "journal.create", payload: fields }
                : {
                    type: "journal.update",
                    payload: {
                      ...fields,
                      expectedVersion: draft.version,
                      visibility: draft.visibility,
                    },
                  },
              () => {
                setSelected(draft.id);
                setDraft(null);
              },
            );
          }}
        >
          {stale && (
            <div role="status">
              <p>{current ? t.journalChanged : t.journalGone}</p>
              {current && (
                <Button type="button" disabled={pending} onClick={() => edit(current)}>
                  {t.reloadJournal}
                </Button>
              )}
            </div>
          )}
          <label>
            {t.journalTitle}
            <input
              aria-label={t.journalTitle}
              disabled={pending}
              value={draft.title}
              maxLength={80}
              required
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            {t.journalBody}
            <textarea
              aria-label={t.journalBody}
              disabled={pending}
              value={draft.body}
              rows={10}
              maxLength={1000}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          {draft.version !== null ? (
            <label>
              {t.journalVisibility}
              <select
                aria-label={t.journalVisibility}
                disabled={pending}
                value={draft.visibility}
                onChange={(e) =>
                  setDraft({ ...draft, visibility: e.target.value as Draft["visibility"] })
                }
              >
                <option value="dm">{t.dmOnly}</option>
                <option value="shared">{t.shared}</option>
              </select>
            </label>
          ) : (
            <p className="muted">{t.journalPrivateFirst}</p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              {t.cancel}
            </Button>
            <Button type="submit" disabled={disabled || pending || stale}>
              {draft.version === null
                ? t.createPrivateJournal
                : draft.visibility === "shared"
                  ? t.saveSharedJournal
                  : t.savePrivateJournal}
            </Button>
          </div>
        </form>
      )}
      {!deleting && <ErrorMessage error={error} />}
      {deleting && (
        <Dialog
          title={t.deleteJournal}
          onClose={() => {
            if (!pending) {
              setDeleting(null);
              setError(null);
            }
          }}
        >
          <p>{t.deleteJournalPrompt(deleting.title)}</p>
          {deleteStale && <p role="status">{t.journalDeleteChanged}</p>}
          <ErrorMessage error={error} />
          <div className="dialog-actions">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setDeleting(null);
                setError(null);
              }}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              className="danger"
              disabled={disabled || pending || deleteStale}
              onClick={() => {
                void submit(
                  {
                    type: "journal.delete",
                    payload: { journalId: deleting.id, expectedVersion: deleting.version },
                  },
                  () => setDeleting(null),
                );
              }}
            >
              {t.confirmDeleteJournal}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
