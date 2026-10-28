# Journal Folders Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, native task-by-task and one fresh whole-change review. Existing owner direction continues implementation autonomously.

**Goal:** Nested GM journal organization and permission-safe page search.
**Architecture:** Add versioned folders alongside journals, filtered DTOs in REST/live, and reuse the existing Journal sidebar with a small folder manager.
**Tech Stack:** Existing Rust/SQLite/React/TS/Zod; no dependency.
**Spec:** docs/superpowers/specs/2026-10-28-journal-folders-design.md

## Global constraints

App0.0.20/schema17/wire1; original migrations1–16 unchanged;16 folders/campaign,4 levels,60-scalar names; existing16-page/1000-body limits. No folder metadata to players, no sharing changes from organization, no content deleted with folders. Strict source/version/receipt/GM/archive checks,179 partial IDs.

## Review focus

- Reparenting a subtree at the depth limit and self/ancestor cycles: host tests must reject without mutation.
- Mixed private/shared content: REST/live/replay must expose no private folder metadata to players.
- Concurrent page/folder edit and deletion: move/delete version bumps and explicit reload prevent lost drafts.
- Folder deletion and old backup recovery: preserve exact pages, hierarchy/resources and canonical16 upgrade.
- Search/no matches and narrow/short UI: tree paths, controls and failed drafts remain usable with real captures.

### Task1: Authority and compatibility

Files: migration0017; domain commands/DTO; protocol index/tests; server journal_folders.rs,journals.rs,scenes.rs,live.rs; storage backup and upgrade tests.
Interface: spec commands; optional Journal.folderId, optional JournalsResponse.folders, optional snapshot.journalFolders, JournalFolder{id,parentId,name,version}.
- [x] Write/run strict command and real-host missing feature tests RED.
- [x] Implement bounded hierarchy validation, guarded saves/moves/non-destructive delete and GM-only projections; extend canonical backup17 and old16 fixture.
- [x] Run Rust/TS/types/lint relevant checks and commit.

### Task2: Journal UI and real workflow

Files: JournalDirectory.tsx/JournalFolderManager.tsx/tests; Journals.tsx/tests; campaign stream/Table; workspace.css; journal-folders.spec.ts.
Consumes Task1 DTO; reuses current page form, Send command and sidebar/dialog primitives.
- [x] Write/run missing search/folder UI checks RED.
- [x] Add tree/search and bounded folder forms/create-folder selection/page move; preserve privacy/drafts/keyboard and existing tests.
- [x] Real GM/Alice/Bob folder CRUD/move/delete/reveal/conflicts/restart/privacy and four layouts; inspect captures and commit.

### Task3: Review, full gate and checkpoint

- [x] Update0.0.20/schema17 guides, partial matrix and next work.
- [x] One fresh whole-change review; fix material findings with RED→GREEN.
- [ ] Freeze candidate and complete pnpm verify:release; record exact exit/SHA/counts/conditions, inspect final captures.
- [ ] Docs-only final commit, source ZIP/logs/checksums; retain managed work branch.
