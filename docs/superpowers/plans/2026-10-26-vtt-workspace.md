# VTT Workspace and Combat Implementation Plan

> **For agentic workers:** Use the supplied design/contracts. Apply TDD; one fresh whole-change review after integration. Backend and frontend have disjoint ownership and an exact shared wire contract.

**Goal:** Replace the dashboard-like table with an extensible compact VTT workspace, add persistent generic combat, deliver actual screenshots.
**Architecture:** Existing Rust authority/React/Pixi renderer remain. New WorkspaceShell/Window/preferences primitives own layout; feature panels own content. Server combat reuses current projections/receipts.
**Tech Stack:** Existing Rust/Axum/SQLx, React/TypeScript/Zod/Pixi; no new dependency.
**Spec:** docs/superpowers/specs/2026-10-26-vtt-workspace-design.md and 2026-10-26-combat-contract.md.

## Global Constraints

- Browser-only roles, independent headless server; no native app/new dependency/publish.
- Preserve179 IDs, old data and all privacy scopes. Migration0010 only.
- Sidebar320–520px, clamped preferences by user/campaign; map renderer/camera stable.
- One encounter/campaign,32 entries, initiative[-1000,1000], name80, actor HP single truth.
- Before serialization filter scene/token/fog/actor permissions; no hidden combatant placeholders/IDs/counts.

## Review Focus

- Sidebar collapse/resize, window motion and panel switches must not remount renderer or widen private drafts.
- Tiny viewports/corrupt stored preferences/open forms must retain usable controls and keyboard behavior.
- Hidden encounter/actor/fog changes must not leak through combat DTOs, media or old events.
- Reordering/deleting current turn and stale HP forms must preserve deterministic authoritative state.
- Requested screenshot must show the final functioning interface, not fabricated controls/data.

### Task1: Independent combat backend

Ownership: crates/domain, crates/server, crates/storage and their Rust tests only. Parent owns frontend/protocol TS/version/docs/browser tests; no shared files.
- [x] Observe real unsupported combat command RED, implement0010/domain commands/DTO/server projection/REST/dispatch/reconciliation.
- [x] Cover versions/HP/ACL/hidden fog/tie order/removal/dedupe/archive/reopen/upgrade/max snapshot with real tests; run Rust suite/fmt/clippy.

### Task2: Workspace primitives and feature integration

Ownership: apps/web, packages/protocol, packages/ui, tests/e2e, screenshot harness and root versions/docs.
- [x] Write failing workspace preference/window/schema/cache/combat form tests, then implement typed panel registry, preferences, reusable shell/window.
- [x] Rebuild Table around compact scene navigation/tool rail/resizable sidebar, persistent Chat/Dice/Journal, token inspector, pan-only canvas and safe quick-dice preparation.
- [x] Add compact Combat panel/popout per exact contract; flatten form/card density and scope theme under workspace; keep all implemented actions reachable.
- [x] Run TS suite/types/lint/build and integrate with server; real three-client combat/workspace plus old browser regression.

### Task3: Final review and delivery

- [x] One fresh read-only whole-change review; material findings get one regression/fix pass, no rereview.
- [x] Complete checks, honest179-ID matrix/docs/overview; capture and visually inspect final desktop and narrow viewport, saving requested fictional desktop screenshot.
- [x] Preserve private source branch and source ZIP identity; save source/screenshot with verified evidence. Next full restore/P0 gates.
