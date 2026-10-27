# Player canvas startup implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation, TDD and one final whole-change review.

**Goal:** Resolve the recorded player-map loading blocker within the existing Hearth application and prove the integrated result.

**Architecture:** Preserve the authoritative Rust host and React/Pixi renderer. Trace browser startup across projection, asset download and renderer initialization; change only the proven failing boundary. Do not replace renderer/privacy architecture or weaken rendered-player assertions.

**Tech Stack:** Existing Rust/Axum/SQLite, React/TypeScript/Pixi, Vitest and Playwright.

**Spec:** `docs/NEXT_TASKS.md` section 1, `docs/CONTINUOUS_DEVELOPMENT.md`, master plan sections 9 and 16.

## Global constraints

One source and release line, all 179 feature IDs preserved. Use disposable campaign roots. Keep required tests and manual acceptance gates honest. Schema remains 11 unless an actual data change requires otherwise. No new dependency or unrelated feature expansion.

## Review focus

- Slow or changing connection readiness must eventually produce a usable rendered player map.
- Scene changes/unmount during initialization or asset decoding must not leak a stale renderer or change the new scene.
- Hidden artwork and drawings retain server authorization and fog filtering.
- Real GM/two-player ruler, ping and drawing regressions must still run against the selected host.
- Failed checks remain visible and block playable promotion; one passing scenario is not full release acceptance.

## Task 1: Repair and validate player rendering

**Files:** Inspect `apps/web/src/features/SceneCanvas.tsx`, `Table.tsx` and `tests/e2e/map-tools.spec.ts`; modify only the actual failing boundary and its regression tests. Refresh current progress/validation/overview/next-task documents.

**Interfaces:** Existing `SceneCanvas` scene/online props, `useCampaignStream` live projection and authenticated asset responses. No protocol changes planned.
- [x] Reproduce the unchanged map-tool browser failure; gather console, request, WebSocket and renderer state evidence. Expected: actual failing assertion or concrete reason the historical reproduction differs.
- [x] Trace the failing boundary and write/retain a deterministic failing regression before the production fix. Expected: failure attributable to the product defect, not unavailable tooling.
- [x] Apply the minimal root-cause correction. Expected: focused regression and existing map-tool scenario pass without longer timeouts or removed assertions.
- [x] Run shared integrated validation against the matched host/web candidate; record every actual failure/unperformed stage. Expected: clean automated run, otherwise explicit blocked checkpoint with remaining failures.
- [x] Capture and inspect the real application using fictional campaign data, update documentation/version as warranted and obtain one independent final review.
- [x] Commit the integrated source checkpoint and prepare its validated archive for guarded replacement of the same saved source item. No playable promotion until all required acceptance gates pass.

Integrated validation also exposed shared authentication-budget state in seven independent browser scenarios. Their temporary-host fixture preserves real limits and all assertions; final whole-suite validation passes. The independent review correction is covered by forced real WebGL context loss/restoration and exact canvas recovery.
