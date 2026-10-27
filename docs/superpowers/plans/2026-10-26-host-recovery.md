# Host Backup and Isolated Recovery Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, TDD per task, then one fresh read-only whole-change review. User/master-plan authorize autonomous execution; no repeated handoff approval.

**Goal:** Download/verify complete host backups and create a separate working recovery copy from the browser.
**Architecture:** Storage owns bounded archive/schema/blob validation; server owns current-owner ACL/operation lifecycle; reusable dialog owns recovery UI. Existing campaign/renderer code stays independent.
**Tech Stack:** Existing Rust/SQLx/React/Zod/image; promote existing tempfile dependency, no new registry package.
**Spec:** docs/superpowers/specs/2026-10-26-host-recovery-design.md

## Global Constraints

- Browser-only DM/player UI, private headless Rust host;179 IDs preserved, partial features IN_PROGRESS.
  -512MiB archive /128MiB DB /16MiB asset /4096 blobs /1MiB manifest /512million decoded pixels; uncompressed framing and64KiB copies.
- Current schema10 only, strict canonical SQLite schema and migration/checksum/reference validation.
- Current host owner only; one operation at a time,60-second upload deadline,15-minute verification.
- Restore only to generated isolated directory; sessions/unused invitations invalidated, accounts/passwords/game ACLs retained. Never touch running host data.

## Review Focus

- Corrupt/truncated/oversized/duplicate/path/alternate-schema data must never escape staging or alter live/existing roots.
- Disconnect/cancellation, missing blobs and filesystem errors must release resources and remove incomplete temporary data.
- A player/non-owner DM/expired owner session must not read any backup metadata or bytes, including through direct guessed IDs.
- Changing files/receipts in another tab must not turn a stale verification into an unintended restore or misleading success.
- Browser recovery must produce a host that starts, accepts old account passwords and preserves private projections while rejecting pre-restore sessions/invites.

### Task1: Snapshot, validation and isolated restore engine

Files: crates/storage/src/{lib.rs,backup.rs,backup/format.rs,backup/database.rs}; crates/storage/tests/backup.rs; storage Cargo.toml and lockfile.
Interfaces: create/verify/restore and Summary from the exact spec. Ownership stays in storage; HTTP never extracts paths.
- [x] Write real-store round-trip tests: account/campaign/private journal/asset bytes retained, committed WAL captured, no unreferenced files, old roots unchanged, restored sessions/invites reset. Observe missing-module/unsupported behavior RED.
- [x] Implement streaming framing/checksum/path bounds, canonical DB/migration/FK/owner/asset validation, create/verify/restore and marker startup guard.
- [x] Add hostile/truncated/extra bytes/duplicate paths/manifest limits, alternate schema, missing/corrupt asset, bad PNG and invalid destination/link regressions. Verify actual cleanup and unchanged active DB, not error wording alone.
- [x] Run storage suite and existing locked Rust baseline; commit.

### Task2: Current-owner API and real browser controls

Files: crates/server/src/{lib.rs,recovery.rs}; crates/server/tests/cases/recovery.rs; packages/protocol/src/{recovery.ts,recovery.test.ts,index.ts}; apps/web/src/features/{BackupRecovery.tsx,BackupRecovery.test.tsx,backup-recovery.css}; api.ts, Library.tsx, Table.tsx, WorkspaceChrome.tsx.
Consumes: Task1 storage API. Produces exact REST shapes/routes in spec; client streams File and downloads attachment directly.
- [x] Write failing owner/player/non-owner-DM route tests and strict protocol/UI file-change/stale verification tests; observe RED.
- [x] Implement operation gate, owned temp/receipt lifecycle, bounded upload, current-owner checks before work/publication and typed API clients. Hold exported TempDir across streamed response; consumed/expired verification cannot restore twice.
- [x] Implement lazy compact dialog and owner-only entry points; real counts/checksum/verified receipt, clear pending/error/restart/private-content states. Preserve existing table canvas and dialogs.
- [x] Prove unknown/stale IDs, malformed/truncated body, post-logout direct download/status denial, failed upload leaves current host usable. Run Rust/TS/types/lint; commit.

### Task3: Restored-host acceptance, review and delivery

Files: tests/e2e/recovery.spec.ts; scripts/capture-preview.mjs; versions/guides/progress/matrix.
- [x] Browser test with independent owner/two players: populate private content/permissions/custom upload/combat; actual download→upload→verify→create copy. Start copy on isolated loopback host, old sessions fail, original credentials sign in, DM/private vs player projections and art match. Corrupt file fails without changing original live host.
- [x] Fresh whole-change read-only review on most capable model; one material RED→GREEN fix pass, no rereview. Record rulings/deferred limitations.
- [x] Run matched host/web full suites, clippy/fmt/types/lint/179 IDs and original browser regression. Update all current guides/overview accurately; no P0/platform/portable overclaim.
- [x] Capture/inspect actual new UI desktop+narrow screenshots with fictional data after browsers finish; commit/source ZIP and save updated source identity plus requested screenshot.
