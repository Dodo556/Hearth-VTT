# Scene Notes Implementation Plan

> **For agentic workers:** Native implementation with superpowers:executing-plans; one fresh final review.

**Goal:** Persisted private GM scene notes and explicitly shared player briefings with a usable scene-context window.
**Architecture:** Two independently versioned notes per scene in SQLite, current filtered scene snapshots, strict live command and a retained React editor in WorkspaceWindow.
**Tech Stack:** Existing Rust/Axum/SQLx/React/TypeScript/Zod; no dependency.
**Spec:** `docs/superpowers/specs/2026-10-28-scene-notes-design.md`

## Global Constraints

1000 Unicode scalars/body; LF/TAB only controls; dm/shared scope; safe nonnegative expectedVersion; schema15/wire1/application0.0.18. Preserve migrations0001..0014,16KiB input/4MiB output and existing179 feature IDs. GM authority, scene/campaign checks, receipts, archive and filtered REST/WS apply. Use disposable data only. UI_STANDARDS governs all new controls.

## Review Focus

Private or inactive-scene contents/versions never leak through raw frames or REST; Task1 host/browser transition checks.
Clearing then editing cannot bypass per-scope versions; Task1 stale/clear/dedupe test.
Async saves cannot destroy another scene/scope draft; Task2 retained-component/browser checks.
Long literal Unicode and blank notes remain bounded and correctly counted; Task1 validation/snapshot and Task2 counter tests.
Window actions stay reachable beside tool rails on narrow/short screens; Task2 real geometry/captures.

### Task1: Authoritative notes and compatibility

Files: domain commands/DTO; protocol index/recovery + scene-notes.test.ts; server scene_notes.rs/scenes.rs/commands.rs/lib.rs; server tests/cases/scene_notes.rs; migration0015; storage backup/tests.
Interfaces: `scene.notes.update {sceneId,visibility,body,expectedVersion}`; `Scene.notes?:{dm?:{body,version},shared?:{body,version}}`.
- [x] Write/run protocol missing-command and real-host tests; expect unsupported/missing-note RED.
- [x] Add strict command, transactional scoped save/versioning, migration and role-filtered projection; expected host/protocol GREEN.
- [x] Extend backup original14/current-note and maximum snapshot cases; run Rust/TS suites, types/lint and commit.

### Task2: Scene-context note window

Files: SceneNotes.tsx/tests; Table.tsx; TablePanels.tsx; WorkspaceChrome.tsx; workspace.css; tests/e2e/scene-notes.spec.ts; capture-scene-notes.mjs.
Consumes Task1 DTO/command; produces retained per-scene/scope editor, explicit privacy/save/conflict/keyboard behavior and real UI fixture.
- [x] Write/run component tests for private/shared save, retained drafts, failed/stale reload and Unicode; expect missing component/controls RED.
- [x] Implement window/tabs/editor and scene actions using existing UI; run component/types/lint GREEN.
- [x] Exercise GM/Alice/Bob private/share/clear/stale/restart/scene transitions and responsive layouts on the optimized matched host; capture and inspect actual UI. Commit.

### Task3: Review and delivery evidence

- [x] Update0.0.18/schema15 guides/API/model/progress and partial feature matrix.
- [x] One fresh whole-change review; fix material findings with RED→GREEN regressions; no repeated review.
- [x] Freeze source; run complete `pnpm verify:release` with explicit child status. Record actual counts/conditions/captures and limitations.
- [x] Commit evidence, verify no runtime change after tested revision, package source/logs/checksums and preserve local branch. Scene notes finish here; token controls remain next.

Completed on tested implementation e5c0193; full optimized gate explicit exit0, TS86/Rust92/browser14 in4.8m. One fresh review has no findings; five inspected UI captures and exact evidence in RELEASE_VALIDATION.md. Preserve local branch/source; token HP/status/context follows.
