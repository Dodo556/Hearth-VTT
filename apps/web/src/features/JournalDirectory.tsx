import type { Journal, JournalFolder } from "@hearth/protocol";
import { BookOpen, ChevronRight, Folder, LockKeyhole, Settings2 } from "lucide-react";
import { useState } from "react";
export function folderPath(folders: JournalFolder[], id: string): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let current: string | null = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const f = folders.find((f) => f.id === current);
    if (!f) break;
    names.unshift(f.name);
    current = f.parentId;
  }
  return names.join(" / ");
}
export function folderChoices(folders: JournalFolder[], moving?: string, forFolder = false) {
  let height = 1;
  if (moving)
    for (const f of folders) {
      let current: string | null = f.id;
      const seen = new Set<string>();
      while (current && !seen.has(current)) {
        seen.add(current);
        if (current === moving) {
          height = Math.max(height, seen.size);
          break;
        }
        current = folders.find((p) => p.id === current)?.parentId ?? null;
      }
    }

  return folders
    .filter((f) => {
      let current: string | null = f.id;
      const seen = new Set<string>();
      while (current && !seen.has(current)) {
        if (current === moving) return false;
        seen.add(current);
        current = folders.find((p) => p.id === current)?.parentId ?? null;
      }
      return !forFolder || seen.size + height <= 4;
    })
    .map((f) => ({ id: f.id, label: folderPath(folders, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
export function JournalDirectory({
  journals,
  folders,
  selected,
  searching,
  onSelect,
  onManage,
}: {
  journals: Journal[];
  folders: JournalFolder[];
  selected?: string;
  searching: boolean;
  onSelect: (id: string) => void;
  onManage?: (folder: JournalFolder) => void;
}) {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  function pages(parent: string | null) {
    return journals
      .filter((p) => (p.folderId ?? null) === parent)
      .map((p) => (
        <button
          className={selected === p.id ? "selected" : ""}
          type="button"
          key={p.id}
          onClick={() => onSelect(p.id)}
        >
          {p.visibility === "dm" ? (
            <LockKeyhole size={15} aria-hidden="true" />
          ) : (
            <BookOpen size={15} aria-hidden="true" />
          )}
          <span>{p.title}</span>
        </button>
      ));
  }
  function branch(parent: string | null, depth: number): React.ReactNode {
    if (depth > 4) return null;
    return folders
      .filter((f) => f.parentId === parent)
      .map((f) => {
        const open = searching || !closed.has(f.id);
        return (
          <div className="journal-folder" key={f.id}>
            <div className="journal-folder-row">
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setClosed((old) => {
                    const next = new Set(old);
                    if (next.has(f.id)) next.delete(f.id);
                    else next.add(f.id);
                    return next;
                  })
                }
              >
                <ChevronRight size={14} className={open ? "expanded" : ""} aria-hidden="true" />
                <Folder size={16} aria-hidden="true" />
                <span>{f.name}</span>
              </button>
              {onManage && (
                <button
                  type="button"
                  className="journal-folder-settings"
                  title={`Manage folder ${f.name}`}
                  aria-label={`Manage folder ${f.name}`}
                  onClick={() => onManage(f)}
                >
                  <Settings2 size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            {open && (
              <div className="journal-folder-children">
                {pages(f.id)}
                {branch(f.id, depth + 1)}
                {!journals.some((p) => p.folderId === f.id) &&
                  !folders.some((p) => p.parentId === f.id) && (
                    <p className="panel-hint">{searching ? "No matching pages" : "Empty folder"}</p>
                  )}
              </div>
            )}
          </div>
        );
      });
  }
  return (
    <nav className="journal-pages journal-directory" aria-label="Journal directory">
      {pages(null)}
      {branch(null, 1)}
    </nav>
  );
}
