# Custom Scene Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline; one fresh whole-change review after implementation.

**Goal:** Build0.0.3 lets the DM create a custom map table and publish it to authorized browser players.
**Architecture:** Extend existing SQLite/receipt commands and filtered live stream. Protected canonical image blobs are referenced by persisted scene/token documents.
**Tech Stack:** Rust/Axum/SQLx/image, React/strict TypeScript/Pixi, Cargo/pnpm/Playwright.
**Spec:** docs/superpowers/specs/2026-10-23-scene-authoring-design.md; master plan T009–T011 and ADR0002.

## Global Constraints

Browser-only DM/player UI; preserve179 feature IDs, private source, per-frame authority and duplicate receipt guarantees. Existing DB upgrades use verified pre-migration snapshots. Upload input8MiB, dimensions4096px/16MP, output16MiB;2 decode slots; campaign32 assets/100MiB,8 scenes/100 tokens. Private drafts/media never reach players; old active scene media loses authorization on switch.

## Review Focus

- Active-scene changes during queued event writes must prevent stale scene/token/media disclosure.
- Malformed, oversized, misleading-MIME and polyglot images must remain bounded and never become executable/path input.
- Failed/duplicate/concurrent commands/uploads must not create duplicate objects, orphan metadata or quota bypasses.
- Local DM preparation must not switch players before activation; player caches/canvas must clear on concealment.
- Pending drag completion after scene switch/unmount must not touch destroyed Pixi objects.

### Task1 · protected assets and schema

- [x] Add failing real API tests for uploads, boundaries, private references and upgrade defaults.
- [x] Add migration0003 (`campaigns.active_scene_id`, `scenes.visibility`, `assets`) and protected decode/quota/blob upload/read code in `crates/server/src/media.rs`, using existing pre-migration snapshots.
- [x] Run Rust tests and inspect limits/transaction cleanup.

### Task2 · authoritative scene/token authoring

- [x] Add failing TCP command tests: private draft, create/activate/conceal, token CRUD/dedupe, forbidden player/stale scene writes and restart.
- [x] Extend `crates/domain/src/commands.rs`, `server/src/commands.rs` plus focused `authoring.rs`; project active-scene visibility in scenes/media/live stream.
- [x] Extend shared wire validators and reducer/hook tests. Verify Rust/TS suites.

### Task3 · real browser authoring and navigation lifecycle

- [x] Add browser acceptance for custom map upload, draft selection, token creation/edit/assignment/delete, active scene switch/conceal/reconnect and delayed drag navigation.
- [x] Build focused authoring controls/dialogs in web/features; maintain local DM selection, stable camera and protected artwork cleanup.
- [x] Run production build and full real-server browser suite.

### Task4 · review, run instructions and checkpoint

- [x] One fresh review; reproduce/fix material findings, document minor deferrals.
- [x] Add first-run scripts/quick start, update current-build/progress/feature/status/security/backup docs and version0.0.3.
- [x] Full checks, private source commit/archive/save; final quick build overview followed by exact local run/test instructions and actual unverified limits.
