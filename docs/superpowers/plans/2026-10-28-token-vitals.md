# Token Vitals Implementation Plan

> **For agentic workers:** Native execution with superpowers:executing-plans; one fresh whole-change review.

**Goal:** Persisted token HP/manual statuses and usable context actions respecting existing authority/privacy.
**Architecture:** Versioned token command, actor-backed linked HP, current filtered DTOs, Pixi decorations and the existing token inspector with a small HTML menu.
**Tech Stack:** Current Rust/Axum/SQLite/React/TypeScript/Pixi; no dependency.
**Spec:** `docs/superpowers/specs/2026-10-28-token-vitals-design.md`

## Global constraints and review focus

App0.0.19/schema16/wire1; preserve migrations1..15,100 tokens/campaign, input16KiB/output4MiB,179 feature IDs. One HP resource0..max1..1000000, six known unique manual markers. GM/controller/actor-owner edits; only GM changes HP sharing; default controllers. Strict nullable source guards and independent version checks. Disposable data only; UI_STANDARDS applies.

Review hidden actor identity/HP and revoked ownership; Task1 projections/host tests and Task2 player raw frames.
Review stale source after relink/unlink/delete and sheet/combat edits; Task1 binding/version tests, Task2 retained-draft tests.
Review unconfigured/zero/max HP and invalid/duplicate marker payloads; Task1 protocol/host/backup, Task2 rendering.
Review menu actions after fog/scene/removal, keyboard and viewport/sidebar coverage; Task2 menu/browser tests.
Review managed graphics/idle/drag/zoom/context cleanup; Task2 real WebGL regression.

### Task1: Authoritative resources and compatibility

Files: domain DTO/commands; protocol index/recovery/tests; server token_vitals.rs,scenes.rs,commands.rs,actors.rs,combat.rs; migration0016; host token_vitals tests and storage backup/upgrade fixtures.
Interface: spec's exact token.vitals.update command and optional Token.statuses/health/vitals DTOs.
- [x] Write/run missing-command and missing-vitals protocol/host tests; observe RED.
- [x] Implement versioned atomic saves, filtered projection, source lifecycle guards and backup16. Verify linked actor fields remain authoritative and events content-free.
- [x] Run full Rust/TS relevant checks, old15/current backup and max snapshot regressions; commit.

### Task2: Inspector, decorations and context menu

Files: TokenVitals.tsx/tests,TokenContextMenu.tsx/tests,tokenDecorations.ts,catalog,SceneCanvas.tsx,TokenInspector.tsx,Table.tsx,workspace.css; tests/e2e/token-vitals.spec.ts with optional captures.
Consumes Task1 contract. Use existing inspector/editor/delete flow and renderer lifecycle.
- [x] Write/run missing editor/menu behavior tests; observe RED.
- [x] Add explicit Save/Reload/markers/privacy controls, small HP/vector badges and pointer/keyboard context actions; preserve permissions/drafts and disposal.
- [x] Run component/types/lint and real GM/Alice/Bob linked/independent HP, privacy, statuses, menu, stale/restart/idle/context and desktop/narrow/short layouts; inspect captures and commit.

### Task3: Final validation and saved checkpoint

- [x] Update0.0.19/schema16 guides,API/model/progress and partial matrix.
- [x] One fresh whole-change review; fix material findings with RED→GREEN evidence.
- [ ] Freeze source and run complete pnpm verify:release with explicit child exit status and matched captures.
- [ ] Record tested SHA/counts/limits; commit evidence, package source/logs/checksums and preserve local branch. Continue roadmap on same application.
