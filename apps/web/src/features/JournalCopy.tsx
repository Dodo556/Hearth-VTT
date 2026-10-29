import type { Journal, TokenCommand } from "@hearth/protocol";
import { PrivateCopyDialog } from "./PrivateCopyDialog";
export function JournalCopy({
  page,
  pages,
  disabled,
  full,
  send,
  onClose,
  onCopied,
}: {
  page: Journal;
  pages: Journal[];
  disabled: boolean;
  full: boolean;
  send: (command: TokenCommand) => Promise<void>;
  onClose: () => void;
  onCopied: (id: string) => void;
}) {
  return (
    <PrivateCopyDialog
      source={{ id: page.id, version: page.version, label: page.title }}
      records={pages.map((p) => ({ id: p.id, version: p.version, label: p.title }))}
      title="Use page as template"
      nameLabel="Copy title"
      description="Create a GM-only page at Top level with saved text, formatting and optional image. Player sharing and folder placement are not copied. The original page stays intact."
      limitMessage="Copies count toward the 16-page campaign limit."
      disabled={disabled}
      full={full}
      send={send}
      onClose={onClose}
      onCopied={onCopied}
      commandFor={(base, id, title) => ({
        type: "journal.copy",
        payload: { sourceJournalId: base.id, expectedVersion: base.version, journalId: id, title },
      })}
    />
  );
}
