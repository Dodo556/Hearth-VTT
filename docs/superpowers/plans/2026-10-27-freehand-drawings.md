# Bounded Freehand Drawing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Save, render, synchronize and undo bounded GM-authored freehand strokes.

**Architecture:** Extend existing drawing commands, records and filtered scene snapshots. Points are normalized on the host, projected with whole-path fog bounds and rendered by the current invalidation scheduler.

**Tech Stack:** Rust/Axum/SQLx/SQLite; React/TypeScript/Pixi; Vitest/Playwright.

**Spec:** docs/superpowers/specs/2026-10-27-freehand-drawings-design.md, approved by owner in chat.

## Global Constraints

- One browser-only application; authoritative host; no added runtime dependency.
- 2–128 finite in-scene points normalized to 0.01 scene pixels; at least two distinct points and one pixel of path length; closed loops valid.
- 64 drawings/scene; 16 KiB command limit; derived/tested bounded combined snapshot.
- Preserve old migrations, schema 10/11 backup verification and existing line/rectangle behavior.
- Proposed version 0.0.14/schema 12/wire 1; no P0 promotion or publication.

## Review Focus

- Curved paths whose endpoints are revealed but intermediate points touch fog must stay hidden.
- Closed loops, duplicate samples and long gestures must preserve usable bounded paths.
- Capture loss/extra pointers/disconnect/scene or tool changes must never save abandoned drafts.
- Old drawings and order/undo must survive migration and backup/recovery.
- Maximum scene count and full stroke capacity must fit the documented snapshot bound.

### Task 1: Host, storage and protocol

**Files:** crates/domain/src/{lib,commands}.rs; crates/server/src/{drawings,scenes,live}.rs; crates/storage/migrations/0012_freehand_drawings.sql; crates/storage/src/lib.rs; packages/protocol/src/{index,drawings.test}.ts; crates/server/tests/cases/drawings.rs; crates/server/src/live/tests.rs; crates/storage/tests/{backup,drawings_upgrade}.rs.

**Interfaces:** Drawing/CreateDrawing gain optional points for freehand only; strict DrawingPoint {x:f64,y:f64}. Existing endpoint geometry is retained for old shapes. Freehand endpoints are normalized first/last points; projection bounds derive from every point. Migration rebuilds the shape constraint and adds bounded point JSON while preserving row order/nonces. Shared snapshots carry saved points; acknowledgements remain content-free.
- [ ] Add failing tests for valid/closed/normalized strokes, malformed/over-cap geometry, permissions, all-point fog, receipt/undo/reopen and old→new upgrades.
- [ ] Run focused Vitest and Rust tests; confirm intended failures.
- [ ] Implement normalized points, migration, command validation/projection and strict TypeScript schemas; preserve existing shape payloads.
- [ ] Fill all scenes/drawings in the combined maximum fixture; choose/document the measured outbound bound with headroom.
- [ ] Run focused tests, Rust formatting/Clippy and upgrade/recovery tests; commit the tested backend/protocol increment.

### Task 2: Bounded canvas gesture

**Files:** create apps/web/src/features/freehand.ts and freehand.test.ts; modify DrawingControls.tsx, SceneCanvas.tsx, Table.tsx and existing drawing browser test/capture harness.

**Interfaces:** Helpers consume ScenePoint[] and produce bounded normalized preview/submission paths; finish includes simplification status. Table passes optional points through drawing.create. Renderer consumes the same saved path for shared/private layers.
- [ ] Add failing helper tests for deterministic bounds/endpoints/closed loops, repeated samples and long paths.
- [ ] Implement bounded sampling, compaction and final simplification, plus Freehand control and literal instructions.
- [ ] Integrate pointer and keyboard drafting; cancel on Escape, pointercancel/lostpointercapture, tool/settings/scene/authority/connectivity changes and disposal. Ignore extra pointers.
- [ ] Extend real GM/Alice/Bob tests for saved curved strokes, hidden/private raw-frame absence, keyboard/pointer cancellation, zoom coordinates, reconnect/restart/undo and idle rendering.
- [ ] Run helpers/protocol/types and focused real-browser acceptance; commit the integrated interaction.

### Task 3: Integrated validation and evidence

**Files:** package.json/Cargo.toml/Cargo.lock versions; docs/{PROGRESS,BUILD_OVERVIEW,RELEASE_VALIDATION,FEATURE_MATRIX,NEXT_TASKS,P0_GAPS,KNOWN_ISSUES,DECISIONS,API,DATA_MODEL,BACKUP_RECOVERY,DM_GUIDE}.md; update design status.
- [ ] Update version/schema and feature-specific documentation; keep every feature ID and partial status.
- [ ] Run one complete pnpm verify:release with local sockets and the supported installed Chromium override; diagnose/fix failures without removing assertions.
- [ ] Capture/inspect a real screenshot sequentially after browser acceptance; record exact results and remaining platform/LAN/distribution limits.
- [ ] Review the final diff against design and tests, resolve findings, verify affected checks and commit final evidence.
