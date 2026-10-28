import type { Journal, JournalFolder, TokenCommand } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { FolderPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/en";
import { folderChoices, JournalDirectory } from "./JournalDirectory";
import { JournalFolderManager } from "./JournalFolderManager";

type Draft = {
  id: string;
  version: number | null;
  title: string;
  body: string;
  visibility: "dm" | "shared";
  folderId?: string;
};
export function Journals({
  journals,
  folders = [],
  dm,
  disabled,
  send,
}: {
  journals: Journal[];
  folders?: JournalFolder[];
  dm: boolean;
  disabled: boolean;
  send: (command: TokenCommand) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [manager, setManager] = useState<{ folder?: JournalFolder; page?: Journal } | null>(null);
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
  const visibleFolders = dm ? folders : [];
  const matches = journals.filter((p) =>
    `${p.title}\n${p.body}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const page = matches.find((p) => p.id === selected) ?? matches[0];
  const destinationGone = !!draft?.folderId && !visibleFolders.some((f) => f.id === draft.folderId);
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
      <label className="journal-search">
        Search pages
        <input
          type="search"
          aria-label="Search pages"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="journal-directory-actions">
        {dm && (
          <Button
            type="button"
            disabled={disabled || pending || !!draft || folders.length >= 16}
            onClick={() => setManager({})}
          >
            <FolderPlus size={15} aria-hidden="true" />
            New folder
          </Button>
        )}
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
      </div>
      {!draft && (
        <>
          <JournalDirectory
            journals={matches}
            folders={visibleFolders}
            selected={page?.id}
            searching={!!search.trim()}
            onSelect={(id) => {
              setSelected(id);
              setError(null);
            }}
            onManage={dm ? (folder) => setManager({ folder }) : undefined}
          />
          {!matches.length && journals.length > 0 && <p className="muted">No matching pages.</p>}
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
                    disabled={disabled || pending}
                    onClick={() => setManager({ page })}
                  >
                    Move page
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
            !journals.length && <p className="muted">{t.noJournals}</p>
          )}
        </>
      )}
      {draft && dm && (
        <form
          className="journal-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled || pending || stale || (draft.version === null && destinationGone)) return;
            const fields = { journalId: draft.id, title: draft.title, body: draft.body };
            void submit(
              draft.version === null
                ? {
                    type: "journal.create",
                    payload: { ...fields, folderId: draft.folderId ?? null },
                  }
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
          {draft.version === null && (
            <label>
              Folder
              <select
                aria-label="Page folder"
                value={draft.folderId ?? ""}
                disabled={pending}
                onChange={(e) => setDraft({ ...draft, folderId: e.target.value || undefined })}
              >
                <option value="">Top level</option>
                {destinationGone && (
                  <option value={draft.folderId} disabled>
                    Removed folder
                  </option>
                )}
                {folderChoices(visibleFolders).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {draft.version === null && destinationGone && (
            <p role="status">
              The selected folder was removed. Choose another folder; your page draft is kept.
            </p>
          )}
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
            <Button
              type="submit"
              disabled={disabled || pending || stale || (draft.version === null && destinationGone)}
            >
              {draft.version === null
                ? t.createPrivateJournal
                : draft.visibility === "shared"
                  ? t.saveSharedJournal
                  : t.savePrivateJournal}
            </Button>
          </div>
        </form>
      )}
      {manager && dm && (
        <JournalFolderManager
          {...manager}
          folders={visibleFolders}
          journals={journals}
          disabled={disabled}
          send={send}
          onClose={() => setManager(null)}
        />
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
