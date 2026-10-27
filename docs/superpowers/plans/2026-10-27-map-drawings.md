# Map Drawing Implementation Plan

> **For agentic workers:** Execute this plan using superpowers:executing-plans. Tests precede each behavior.

**Goal:** Draw, undo, synchronize and persist GM-created shared or private lines and rectangles.

**Architecture:** Scene-scoped database records with authoritative GM commands and filtered scene projections. Pixi renders separate shared/private layers and a temporary gesture preview. Preserve recovery of schema 10 archives when adding schema 11.

**Tech Stack:** Rust/Axum/SQLx SQLite; React/TypeScript/Pixi; Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-map-drawings-design.md`

## Global Constraints

Browser-only clients; existing owner-hosted server; no extra runtime services. Do not publish; no proprietary assets. Player projections exclude GM content and unrevealed drawings. Maintain existing backup restore and feature IDs.

## Review Focus

- Bounds and nonfinite/zero-area geometry rejected before storage.
- Private and fog-hidden drawing data absent from snapshots and REST.
- Existing backup schema 10 archives verify and migrate after isolated recovery.
- Scene change, disconnection and canceled gestures cannot save unintended shapes.
- Snapshot size stays bounded and edits do not disturb existing canvas controls.

### Task 1: Persistence and host projection

**Files:** domain commands/types; server commands, scene projection, fog; storage migration and backup; integration tests.

**Interfaces:** `drawing.create` carries scene ID, client nonce, shape, layer, color and endpoints; `drawing.undo` carries scene ID. Scene DTO includes ordered `drawings`.
- [x] Write a failing host test for create, undo, filtering, invalid geometry, permissions and restart; run it.
- [x] Add schema 11, command handlers and snapshot projection. Preserve old schema 10 recovery using exact canonical migration validation.
- [x] Verify new/old backup recovery and host tests; run Rust suite and clippy. (Workspace run used one stale test executable; current storage suite and rebuilt test passed.)

### Task 2: Canvas workflow

**Files:** protocol schema/tests; SceneCanvas, Table, WorkspaceChrome, CSS; browser tests and capture script.

**Interfaces:** GM selects shape, visibility and color; dragging or Enter/arrows/Enter sends one command. Undo removes the latest drawing.
- [x] Write failing protocol/control tests, then implement toolbar and rendering/gesture logic.
- [x] Verify typecheck, tests, build and real browser GM/player connection and projection behavior. (Player canvas rendering remains unverified in the headless map-tool regression.)

### Task 3: Document and package

- [ ] Update overview/progress/gaps/decisions/known issues/next tasks and usage guidance.
- [ ] Review whole change, run relevant checks, capture desktop screenshot and save source and image.
