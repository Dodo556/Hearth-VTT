# Literal Text Drawings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add saved GM-authored literal text boxes to the existing drawing layers.

**Architecture:** Extend current drawing commands/projections and add migration0013. Render cached, fitted, masked Pixi text through the current invalidation scheduler.

**Tech Stack:** Rust/Axum/SQLx/SQLite; React/TypeScript/Pixi; current locked dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-text-drawings-design.md`

## Global Constraints

- One browser-only self-hosted Hearth; no dependency or public license change.
- 1–120 Unicode scalars, at most four lines; reject controls except newline.
- Text box40–1024 by32–512 scene pixels; normalize corners to0.01 pixels.
- 64 drawings/scene; incoming16KiB/outgoing4MiB; preserve migrations0001..0012.
- Backup schema13; preserve original-schema10/11/12 validation and isolated upgrades.
- Native execution in the existing isolated cloud checkout; user requested continued implementation of the handoff.

## Review Focus

- Font fallback/overhang must remain inside the authorized rectangle: browser clipped-edge pixel comparison.
- Non-BMP Unicode bounds must agree on client/host: protocol and host120/121-scalar tests.
- A changed text draft must not commit the preceding gesture: browser keyboard draft/settings cancellation.
- Deleted or undone labels must release Pixi text/mask resources and return to idle: browser undo/context restoration/idle regression.
- Upgrade/restore must preserve point bytes, undo order and nonces: schema12 fixture and recovery tests.

### Task 1: Authoritative text contract and storage

**Files:** domain models/commands; server drawings/scenes; protocol index/drawings tests; migration0013; storage migration/backup tests and recovery schemas; maximum snapshot fixture.

**Interfaces:** `drawing.create` accepts shape`text`, optional text-only`text`; Drawing DTO adds optional`text`. Existing endpoints/points remain unchanged. Host derives normalized text corners.
- [x] Add protocol tests for literal text, Unicode120/121, blank/control/line limits and field separation; observe failure.
- [x] Add real host cases for GM/player authority, validation, nonce/receipt reuse, full-box fog filtering, private REST/live absence and reconnect; observe failure.
- [x] Add schema12 upgrade/order/points/nonces fixture and schema12 recovery fixture; observe failure.
- [x] Implement domain/protocol/host/forward migration and schema13 backup support.
- [x] Run TS tests and full Rust suite; verify original maximum-freehand and maximum-text snapshots within4MiB. Commit.

### Task 2: Text placement and rendering

**Files:** DrawingControls, SceneCanvas, Table, workspace.css; text drawing helper/tests; drawings browser case; capture harness.

**Interfaces:** DrawingSettings retains draft text locally; Table sends it only for text shapes. Preview and saved rendering share fitted, masked text behavior. `textDrawingBounds(start,end)` validates/normalizes rectangle; `validDrawingText(text)` supplies literal draft validation.
- [ ] Add failing helper/controls tests for text validity and reversed/min/max/normalized rectangles.
- [ ] Add browser tests for Text selection, box preview/placement at zoom, actual visible player pixels/literal Unicode, private frames, settings/Escape cancellation, restart and undo; observe failure.
- [ ] Implement controls and keyed renderer lifecycle; preserve existing gestures and idle/context recovery.
- [ ] Run TS/types/build and focused real three-browser drawing case. Commit.

### Task 3: Integrated candidate and evidence

**Files:** version manifests/lock, API/model/backup/user guides and progress/release evidence; feature matrix MAP-04 row; capture harness.
- [ ] Update application0.0.15/schema13 documentation and keep every feature ID/partial state.
- [ ] Run one complete `pnpm verify:release`; resolve failures without weakening checks.
- [ ] Obtain one fresh read-only whole-change review, resolve material findings with regression evidence.
- [ ] Capture/inspect actual desktop/narrow views, record exact tested revision and evidence, package source, commit. Continue next with scene-linked notes.
