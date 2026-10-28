import type { Journal, JournalFolder, TokenCommand } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useEffect, useRef, useState } from "react";
import { folderChoices } from "./JournalDirectory";

type Props = {
  folder?: JournalFolder;
  page?: Journal;
  folders: JournalFolder[];
  journals: Journal[];
  disabled: boolean;
  send: (c: TokenCommand) => Promise<void>;
  onClose: () => void;
};
export function JournalFolderManager({
  folder,
  page,
  folders,
  journals,
  disabled,
  send,
  onClose,
}: Props) {
  const [base, setBase] = useState(folder?.version ?? page?.version ?? null);
  const [name, setName] = useState(folder?.name ?? "");
  const [parent, setParent] = useState(folder?.parentId ?? page?.folderId ?? "");
  const [deleting, setDeleting] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const id = useRef(folder?.id ?? page?.id ?? crypto.randomUUID());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = folder
    ? folders.find((f) => f.id === folder.id)
    : page
      ? journals.find((p) => p.id === page.id)
      : undefined;
  const stale = base !== null && current?.version !== base;
  const destinationGone = !!parent && !folders.some((f) => f.id === parent);
  const choices = folderChoices(folders, folder?.id, !page);
  const destinationUnavailable = !!parent && !choices.some((f) => f.id === parent);
  const blocked = disabled || pending || stale || destinationUnavailable;
  async function save(remove = false) {
    if (blocked) return;
    const command: TokenCommand = page
      ? {
          type: "journal.move",
          payload: { journalId: id.current, expectedVersion: base ?? 0, folderId: parent || null },
        }
      : remove
        ? {
            type: "journal.folder.delete",
            payload: { folderId: id.current, expectedVersion: base ?? 0 },
          }
        : base === null
          ? {
              type: "journal.folder.create",
              payload: { folderId: id.current, name, parentId: parent || null },
            }
          : {
              type: "journal.folder.update",
              payload: {
                folderId: id.current,
                expectedVersion: base,
                name,
                parentId: parent || null,
              },
            };
    setPending(true);
    setError(null);
    try {
      await send(command);
      if (mounted.current) onClose();
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e
            : new Error("Organization could not be saved. Your draft is kept."),
        );
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  const title = page ? "Move page" : folder ? "Manage folder" : "New folder";
  return (
    <Dialog
      title={title}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="journal-folder-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {stale && (
          <div role="status" className="notice">
            <p>
              {current
                ? "This record changed. Your draft is kept."
                : "This record was removed. Cancel to return to the directory."}
            </p>
            {current && (
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  setBase(current.version);
                  setParent(("parentId" in current ? current.parentId : current.folderId) ?? "");
                  if ("name" in current) setName(current.name);
                  setDeleting(false);
                  setError(null);
                }}
              >
                Reload organization
              </Button>
            )}
          </div>
        )}
        {page ? (
          <p>
            Move <strong>{page.title}</strong> without changing its content or sharing.
          </p>
        ) : (
          <label>
            Folder name
            <input
              aria-label="Folder name"
              value={name}
              required
              disabled={pending}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          {page ? "Destination folder" : "Parent folder"}
          <select
            aria-label={page ? "Destination folder" : "Parent folder"}
            disabled={pending || deleting}
            value={parent}
            onChange={(e) => setParent(e.target.value)}
          >
            <option value="">Top level</option>
            {destinationGone && (
              <option value={parent} disabled>
                Removed folder
              </option>
            )}
            {!destinationGone && destinationUnavailable && (
              <option value={parent} disabled>
                Unavailable folder
              </option>
            )}
            {choices.map((f) => (
              <option value={f.id} key={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {!page && <p className="panel-hint">Folder names use up to 60 characters.</p>}
        {destinationGone && (
          <p role="status">The destination was removed. Choose another folder.</p>
        )}
        {!destinationGone && destinationUnavailable && (
          <p role="status">
            This parent is no longer available at the current depth or position. Choose another
            folder; your draft is kept.
          </p>
        )}
        <p className="panel-hint">
          Folders organize GM preparation. Players see shared pages in a flat list; folder names
          stay private.
        </p>
        <ErrorMessage error={error} />
        {deleting && (
          <div className="notice">
            <p>
              Delete this folder? Pages and child folders move to its saved parent. No pages will be
              deleted.
            </p>
            <Button
              type="button"
              className="danger"
              disabled={blocked}
              onClick={() => void save(true)}
            >
              Confirm folder deletion
            </Button>
          </div>
        )}
        <div className="dialog-actions">
          <Button type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          {folder && !deleting && (
            <Button
              type="button"
              className="danger"
              disabled={blocked}
              onClick={() => setDeleting(true)}
            >
              Delete folder
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              blocked ||
              deleting ||
              (!page && (!name.trim() || Array.from(name.trim()).length > 60))
            }
          >
            {page ? "Move page" : base === null ? "Create folder" : "Save folder"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
