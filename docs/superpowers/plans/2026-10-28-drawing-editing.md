# Drawing Editing Implementation Plan

> **For agentic workers:** Native execution with superpowers:executing-plans; one final fresh review.

**Goal:** Undoable object erasing and direct on-map text editing/resizing/style controls.
**Architecture:** Existing strict drawing commands plus versioned delete/update, bounded transactional undo snapshots, current projections and a native scene-positioned text editor.
**Tech Stack:** Current Rust/SQLite/React/TypeScript/Pixi; no dependency.
**Spec:** `docs/superpowers/specs/2026-10-28-drawing-editing-design.md`

## Constraints / review focus

Preserve GM authority, full-box fog,64 drawings/scene,120-scalar/four-line text,16KiB input/4MiB output. Font8–96,128 undo changes/scene. Preserve migrations0001..0013 and old backups. Review stale editing, private undo history, point/order preservation, editor coordinates at zoom, keyboard/cancellation and empty/failed saves. Remain focused on the owner's request and available budget.

### Task 1: Authoritative editing and undo

- [ ] Observe protocol/host missing-command failures; add delete/update/version/font/history cases.
- [ ] Add migration0014 and bounded transactional history, font/version DTOs, GM-only canUndo; keep old-schema recovery.
- [ ] Verify old points/order/nonces, undo restoration/version monotonicity and backup preservation; run TS/Rust suites. Commit.

### Task 2: Eraser and inline editor

- [ ] Observe failing hit-test/editor tests, then implement actual stroke selection and scene-space move/resize helpers.
- [ ] Add object eraser, keyboard targeting and an on-map textarea with Save/Cancel, explicit font size and custom color in the existing inspector. Preserve idle/camera/lifecycle.
- [ ] Update the retained browser drawing scenario for place-then-type; cover erase/restore and text edit/resize/style/restart/privacy. Run focused checks. Commit.

### Task 3: Integrated evidence

- [ ] Update0.0.17/schema14 docs and partial feature matrix; one complete pnpm verify:release with explicit exit status.
- [ ] One fresh read-only whole-change review; fix material findings with regression evidence.
- [ ] Capture/inspect real desktop/narrow inline editing, record tested revision and limitations, package source and commit.
