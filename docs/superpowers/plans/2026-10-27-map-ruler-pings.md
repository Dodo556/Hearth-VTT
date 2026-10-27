# Ruler and shared map pings implementation plan

> For agentic workers: use superpowers:executing-plans inline. The master plan and user's continuation instruction authorize autonomous reversible engineering decisions.

**Goal:** Add a usable local grid-square ruler and transient shared-map pings.
**Architecture:** Keep geometry in the canvas, transient ping delivery in the current authorized WebSocket runtime, and typed protocol/toolbar integration at their existing boundaries. No schema migration or dependency.
**Tech stack:** Rust/Axum/SQLx, React/TypeScript, Pixi, Zod, Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-map-ruler-pings-design.md

## Global constraints

Browser-only UI; authoritative headless server; current authorized active shared scene and revealed fog only for shared pings; bounded transient data; no new registry packages;179 feature IDs retained.

## Review focus

- Zoom/pan must not change measured scene distance; leaving a gesture or scene must not move tokens or leave a stuck pointer.
- A private, concealed, archived, out-of-bounds or fog-covered point must not reach another client.
- A queued ping must be reauthorized against current recipient, scene and fog state before delivery.
- Disconnected clients, rate-limited sends and reconnects must not accumulate or replay stale pings.
- Toolbar modes and keyboard/Escape access must coexist with existing pan, fog, selection and scene switching.

### Task 1: Real transient ping contract and delivery

**Files:** crates/domain/src/commands.rs; crates/server/src/live.rs and tests/cases/live.rs; packages/protocol/src/index.ts and protocol tests; useCampaignStream.ts and tests.
**Interfaces:** client ping {kind,schemaVersion,sceneId,x,y}; host ping {kind,schemaVersion,pingId,sceneId,senderId,x,y}; useCampaignStream exposes ping and bounded transient received pings.
- [x] Write real-socket owner/two-player tests and protocol/hook tests for normal, invalid/private/fog, current authorization and no revision mutation; run to observe RED.
- [x] Implement strict bounded ephemeral frames and per-recipient current authorization/visibility checks; add cleanup/cooldown; run focused and full host/TS tests.

### Task 2: World-space ruler and ping UI

**Files:** apps/web/src/features/{mapTools.ts,mapTools.test.ts,SceneCanvas.tsx,Table.tsx}; apps/web/src/workspace/WorkspaceChrome.tsx and workspace.css; tests/e2e/map-tools.spec.ts.
**Interfaces:** scene-space point clamp/distance, selected tool, onPing, and transient ping list. Ruler is local; Escape clears it; Enter/arrows support canvas keyboard use.
- [x] Write geometry and actual-browser behavior tests first; observe RED.
- [x] Implement toolbar modes, precise measurement overlay, keyboard/pointer lifecycle and timed shared ping rings; verify mouse/keyboard/zoom/fog and existing canvas interactions.

### Task 3: Release evidence and screenshot

**Files:** scripts/capture-preview.mjs, package/Cargo versions, current docs/feature matrix.
- [x] Run matching full Rust/TypeScript/types/lint/build and browser regression; review whole change and fix material issues.
- [x] Capture and inspect actual new map tools with fictional data; update progress, limits, next step and build overview; preserve private source and deliver it with screenshot.
