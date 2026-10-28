import { type Scene, SceneNoteBodySchema, type TokenCommand } from "@hearth/protocol";
import { Button, ErrorMessage } from "@hearth/ui";
import { Eye, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WorkspaceWindow } from "../workspace/WorkspaceWindow";

type Scope = "dm" | "shared";
type Draft = { body: string; version: number };
const empty: Draft = { body: "", version: 0 };

/** Kept mounted by scene so closing the window or preparing another scene retains drafts. */
export function SceneNotes({
  scene,
  dm,
  open,
  disabled,
  onClose,
  send,
}: {
  scene: Scene;
  dm: boolean;
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  send: (command: TokenCommand) => Promise<void>;
}) {
  const [tab, setTab] = useState<Scope>("dm");
  const scope = dm ? tab : "shared";
  const [drafts, setDrafts] = useState<Partial<Record<Scope, Draft>>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const saved = scene.notes?.[scope] ?? empty;
  const draft = drafts[scope];
  const editing = !!draft;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scope switches replace the content reached by these focus refs.
  useEffect(() => {
    if (open) (editing ? input.current : heading.current)?.focus();
  }, [open, editing, scope]);
  const stale = !!draft && draft.version !== saved.version;
  const label = scope === "dm" ? "GM notes" : "Player briefing";
  const valid = !!draft && SceneNoteBodySchema.safeParse(draft.body).success;
  const blocked = disabled || pending || stale || !valid;
  const saveLabel =
    scope === "dm"
      ? "Save GM notes"
      : !draft?.body.trim() && saved.body.trim()
        ? "Clear player briefing"
        : saved.body.trim()
          ? "Update player briefing"
          : "Share player briefing";
  function edit() {
    setError(null);
    setDrafts((old) => ({ ...old, [scope]: { ...saved } }));
  }
  function cancel() {
    setError(null);
    setDrafts((old) => ({ ...old, [scope]: undefined }));
  }
  async function save() {
    if (!dm || !draft || blocked) return;
    setPending(true);
    setError(null);
    try {
      await send({
        type: "scene.notes.update",
        payload: {
          sceneId: scene.id,
          visibility: scope,
          body: draft.body,
          expectedVersion: draft.version,
        },
      });
      if (mounted.current) setDrafts((old) => ({ ...old, [scope]: undefined }));
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e : new Error("The note could not be saved. Your draft is kept."),
        );
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  if (!open) return null;
  return (
    <WorkspaceWindow
      id="scene-notes"
      title={`Scene notes · ${scene.name}`}
      width={380}
      height={540}
      x={76}
      y={88}
      onClose={onClose}
    >
      <div className="scene-notes" id={`scene-notes-${scene.id}`}>
        {dm && (
          <div className="scene-note-tabs" role="tablist" aria-label="Note visibility">
            {(["dm", "shared"] as const).map((target) => (
              <button
                key={target}
                type="button"
                role="tab"
                aria-selected={scope === target}
                aria-controls={`scene-note-panel-${scene.id}`}
                id={`scene-note-tab-${scene.id}-${target}`}
                disabled={pending}
                onClick={() => {
                  setTab(target);
                  setError(null);
                }}
              >
                {target === "dm" ? <LockKeyhole size={14} /> : <Eye size={14} />}
                {target === "dm" ? "GM notes" : "Player briefing"}
                {drafts[target] && (
                  <span aria-hidden="true" title="Unsaved draft" className="note-draft-dot" />
                )}
              </button>
            ))}
          </div>
        )}
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: Both tabpanel and region support aria-labelledby. */}
        <div
          role={dm ? "tabpanel" : "region"}
          id={`scene-note-panel-${scene.id}`}
          aria-labelledby={
            dm ? `scene-note-tab-${scene.id}-${scope}` : `scene-note-heading-${scene.id}`
          }
        >
          <h2 id={`scene-note-heading-${scene.id}`} ref={heading} tabIndex={-1}>
            {label}
          </h2>
          <p className="panel-hint">
            {scope === "dm"
              ? "Private preparation. Only GMs can read these notes."
              : dm
                ? "Shared with players while this scene is on their table. Publish only what they should know."
                : "Shared by the GM for the current scene."}
          </p>
          {draft && dm ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey) &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void save();
                }
              }}
            >
              {stale && !pending && (
                <div className="scene-note-conflict" role="status">
                  <p>This note changed elsewhere. Your draft is kept.</p>
                  <Button type="button" onClick={edit}>
                    Reload saved note
                  </Button>
                </div>
              )}
              <label>
                {scope === "dm" ? "GM note text" : "Player briefing text"}
                <textarea
                  ref={input}
                  value={draft.body}
                  rows={8}
                  maxLength={2000}
                  disabled={pending}
                  onChange={(event) =>
                    setDrafts((old) => ({
                      ...old,
                      [scope]: { ...draft, body: event.target.value },
                    }))
                  }
                />
              </label>
              <div className="scene-note-meta">
                <span>{[...draft.body].length}/1000 characters</span>
                <span>Plain text</span>
              </div>
              {!valid && (
                <p className="error-message">
                  Use up to 1000 characters. Line breaks and tabs are allowed.
                </p>
              )}
              <ErrorMessage error={error} />
              <div className="dialog-actions">
                <Button type="button" disabled={pending} onClick={cancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={blocked}>
                  {pending ? "Saving…" : saveLabel}
                </Button>
              </div>
              <p className="panel-hint">
                Ctrl/Command+Enter saves. Closing keeps your draft until you leave or reload this
                table.
              </p>
            </form>
          ) : (
            <>
              <article className="scene-note-body">
                {saved.body.trim() ? (
                  <p>{saved.body}</p>
                ) : (
                  <p className="muted">
                    {scope === "dm"
                      ? "Keep reminders, encounter details and secrets here."
                      : dm
                        ? "Add a briefing when you’re ready to share scene information."
                        : "The GM hasn’t shared a briefing for this scene yet."}
                  </p>
                )}
              </article>
              {dm && (
                <Button type="button" disabled={disabled || pending} onClick={edit}>
                  {saved.body.trim()
                    ? scope === "dm"
                      ? "Edit GM notes"
                      : "Edit player briefing"
                    : scope === "dm"
                      ? "Add GM notes"
                      : "Write player briefing"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </WorkspaceWindow>
  );
}
