import type { BackupSummary, VerificationInfo } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowDownToLine,
  Check,
  FileCheck2,
  FolderCheck,
  HardDrive,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import "./backup-recovery.css";

const key = ["host-recovery"];
function size(n: number) {
  return n < 1048576 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1048576).toFixed(1)} MiB`;
}
function SnapshotCounts({ summary }: { summary: BackupSummary }) {
  const c = summary.counts;
  return (
    <dl className="recovery-counts">
      {[
        ["Campaigns", c.campaigns],
        ["Scenes", c.scenes],
        ["Tokens", c.tokens],
        ["Characters", c.actors],
        ["Journal pages", c.journals],
        ["Messages", c.messages],
        ["Dice rolls", c.rolls],
        ["Artwork files", c.assets],
      ].map(([label, value]) => (
        <div key={label}>
          <dd>{value}</dd>
          <dt>{label}</dt>
        </div>
      ))}
    </dl>
  );
}
export function BackupRecovery({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: key, queryFn: api.recoveryStatus, refetchInterval: 10000 });
  const [working, setWorking] = useState<string | null>(null),
    [error, setError] = useState<Error | null>(null);
  const [selection, setSelection] = useState<{
    file: File | null;
    verification: VerificationInfo | null;
  } | null>(null);
  const [downloadRequested, setDownloadRequested] = useState(false);
  const blocked = !!working || !query.data || !!query.error;
  const verified = selection?.verification ?? null;
  const expired = !!verified && verified.expiresAt * 1000 <= Date.now();
  const changed = !!verified && query.data?.verified?.id !== verified.id;
  const prepared = query.data?.prepared,
    lastRestore = query.data?.lastRestore;
  async function run(label: string, action: () => Promise<void>) {
    if (working) return;
    setWorking(label);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e : new Error("The recovery operation failed."));
    } finally {
      await client.invalidateQueries({ queryKey: key });
      setWorking(null);
    }
  }
  return (
    <Dialog
      title="Backup & recovery"
      onClose={() => {
        if (!working) onClose();
      }}
    >
      <div className="backup-recovery">
        <div className="recovery-intro">
          <span className="recovery-emblem">
            <HardDrive size={24} />
          </span>
          <div>
            <span className="recovery-eyebrow">HOST TOOLS · OWNER ONLY</span>
            <p>Keep your worlds safe. Recover into a separate copy.</p>
          </div>
          <span className="recovery-local">
            <ShieldCheck size={12} />
            Local files
          </span>
        </div>
        <div className="recovery-scope">
          <ShieldCheck size={15} />
          <p>
            Backups include every campaign, accounts and artwork, including all participants’
            private messages and rolls. Keep the file private. The running host keeps its current
            data.
          </p>
        </div>
        <div className="recovery-steps">
          <section className="recovery-card" aria-label="Create backup">
            <header>
              <span className="recovery-step">1</span>
              <div>
                <h3>Back up this host</h3>
                <p>A consistent snapshot with verified artwork.</p>
              </div>
              <Archive size={18} />
            </header>
            <Button
              className="primary"
              disabled={blocked}
              onClick={() =>
                void run("Preparing host backup…", async () => {
                  await api.prepareBackup();
                  setDownloadRequested(false);
                })
              }
            >
              <Archive size={14} />
              Prepare host backup
            </Button>
            {prepared ? (
              <div className="recovery-prepared">
                <span className="recovery-good">
                  <Check size={13} />
                  Backup prepared
                </span>
                <p>
                  {size(prepared.byteSize)} · Hearth {prepared.summary.appVersion} · schema{" "}
                  {prepared.summary.schemaVersion}
                </p>
                <a
                  className="button recovery-download"
                  href={api.backupDownload(prepared.id)}
                  download
                  aria-disabled={!!working}
                  onClick={(e) => {
                    if (working) e.preventDefault();
                    else setDownloadRequested(true);
                  }}
                >
                  <ArrowDownToLine size={14} />
                  Download backup
                </a>
                <small>
                  {downloadRequested
                    ? "Download requested. Keep the downloaded file in a safe place."
                    : "Available until replaced or the host restarts. Download it to keep it."}
                </small>
                <details>
                  <summary>SHA-256 checksum</summary>
                  <code>{prepared.sha256}</code>
                </details>
              </div>
            ) : (
              <div className="recovery-placeholder">
                <Archive size={24} />
                <p>No backup prepared in this host session.</p>
              </div>
            )}
          </section>
          <section className="recovery-card" aria-label="Verify and recover">
            <header>
              <span className="recovery-step">2</span>
              <div>
                <h3>Verify & recover</h3>
                <p>Check a backup before creating a recovery copy.</p>
              </div>
              <Upload size={18} />
            </header>
            <label className="recovery-file-label">
              Backup file
              <input
                type="file"
                accept=".hearthbackup,application/octet-stream"
                disabled={blocked}
                onChange={(e) => {
                  if (working) return;
                  const file = e.target.files?.[0] ?? null;
                  setError(null);
                  if (file && (file.size === 0 || file.size > 536870912)) {
                    setSelection({ file: null, verification: null });
                    setError(new Error("Choose a nonempty Hearth backup, at most 512 MiB."));
                  } else setSelection({ file, verification: null });
                }}
              />
            </label>
            <div className="recovery-card-actions">
              <Button
                disabled={blocked || !selection?.file}
                onClick={() => {
                  const file = selection?.file;
                  if (file)
                    void run("Uploading and verifying backup…", async () => {
                      const r = await api.verifyBackup(file);
                      setSelection((old) =>
                        old?.file === file ? { file, verification: r.verification } : old,
                      );
                    });
                }}
              >
                <FileCheck2 size={14} />
                Verify backup
              </Button>
              <Button
                className="primary"
                disabled={blocked || !verified || expired || changed}
                onClick={() => {
                  if (verified && !expired && !changed)
                    void run("Creating recovery copy…", async () => {
                      try {
                        await api.restoreBackup(verified.id);
                      } finally {
                        setSelection((old) => ({ file: old?.file ?? null, verification: null }));
                      }
                    });
                }}
              >
                <FolderCheck size={14} />
                Create recovery copy
              </Button>
            </div>
            {verified ? (
              <div className="recovery-verified">
                <h4>
                  <FileCheck2 size={14} />
                  Verified backup
                </h4>
                <p>
                  {size(verified.byteSize)} · {verified.summary.counts.users} accounts ·{" "}
                  {verified.summary.counts.encounters} encounters
                </p>
                <ul>
                  <li>
                    <Check size={12} />
                    Database integrity & schema
                  </li>
                  <li>
                    <Check size={12} />
                    File checksums & artwork references
                  </li>
                  <li>
                    <Check size={12} />
                    Campaign permissions & ownership
                  </li>
                </ul>
                <small>
                  {changed
                    ? "Verification changed in another window. Verify your selected file again."
                    : expired
                      ? "Verification expired. Verify this file again."
                      : "Verification lasts 15 minutes and can create one copy."}
                </small>
              </div>
            ) : (
              <p className="recovery-hint">
                Choose a complete .hearthbackup file. Verify the selected file in this window,
                including after reopening these tools. Verification checks the database, checksums
                and artwork.
              </p>
            )}
          </section>
        </div>
        {(verified?.summary || prepared?.summary) && (
          <section className="recovery-contents" aria-label="Backup contents">
            <div className="recovery-section-title">
              <h3>{verified ? "Verified contents" : "Snapshot contents"}</h3>
              <span>Complete host snapshot</span>
            </div>
            <SnapshotCounts summary={(verified?.summary ?? prepared?.summary) as BackupSummary} />
          </section>
        )}
        {lastRestore && (
          <section className="recovery-success" role="status">
            <FolderCheck size={22} />
            <div>
              <h3>Recovery copy ready</h3>
              <p>
                Your live host is unchanged. Stop the host, choose this recovered data folder, then
                restart:
              </p>
              <code>
                {query.data?.dataDirectory}/restores/{lastRestore.directoryName}
              </code>
              <small>
                Sign in with the accounts and passwords from the backup. Previous sessions and
                unused invitation links are disabled in this copy.
              </small>
            </div>
          </section>
        )}
        <div className="recovery-reset-note">
          <ShieldCheck size={14} />
          <span>
            Recovery retains accounts and permissions. Everyone signs in again; issue fresh unused
            invitations.
          </span>
        </div>
        <ErrorMessage error={error ?? query.error} />
        {working && (
          <p className="recovery-working" role="status">
            {working} Large backups may take a little time.
          </p>
        )}
        {query.isPending && <p role="status">Reading host recovery status…</p>}
        <footer>
          <span>Up to 512 MiB · uncompressed · schemas 10–11</span>
          <Button disabled={!!working} onClick={onClose}>
            Done
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
