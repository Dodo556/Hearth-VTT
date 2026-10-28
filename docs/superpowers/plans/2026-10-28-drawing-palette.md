# Drawing Palette Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for native implementation and one fresh whole-change review.

**Goal:** Replace the horizontal drawing form with a standard vertical icon palette and establish reusable UI conventions.

**Architecture:** Existing React settings and canvas callbacks; shared ToolButton; CSS geometry; no backend/storage/protocol changes.

**Tech Stack:** Current React/TypeScript/Lucide/Pixi and locked toolchain.

**Spec:** `docs/superpowers/specs/2026-10-28-drawing-palette-design.md`

## Constraints and review focus

- Preserve layers/colors/drafts/undo/cancellation and rendered-player acceptance. No new dependency or schema.
- Icon controls require accessible names, tooltips, visible selected/focus states; typing fields keep labels.
- Palette is vertical; text editor width is bounded; rails scroll on short viewports.
- Test desktop1440×1000, narrow760×700 and390×700, short900×520, including sidebar changes and focus.
- Review: hidden color/layer state, gesture cancellation when closing, keyboard focus after close, short-height action reachability, layout interference with canvas.

### Task 1: Palette and reusable controls

**Files:** new workspace/ToolButton.tsx; DrawingControls.tsx and tests; WorkspaceChrome.tsx; SceneCanvas/Table; workspace.css.
**Interfaces:** DrawingSettings unchanged; add onClose callback. ToolButton accepts icon, label, pressed, disabled, onClick and optional className/title.
- [x] Add failing component tests for icon shape selection, swatches/layers, draft preservation and closing/Escape.
- [x] Implement shared icon controls, vertical groups, conditional text editor and bounded/scrollable layout.
- [x] Run component/types/lint checks. Commit.

### Task 2: Usable layouts and integrated evidence

**Files:** drawings.spec.ts; capture-drawings.mjs; UI_STANDARDS.md, AGENTS.md, current progress/guides/versions.
- [x] Adapt browser selectors to actual accessible buttons, keeping all functional assertions.
- [x] Add geometric layout, keyboard close/reopen, narrow/short viewport and sidebar-switch checks; observe new layout fail on the original UI.
- [x] Capture and inspect real palette and text-editor desktop/narrow views. Fix observed issues.
- [x] Record0.0.16/schema13; run one complete pnpm verify:release; obtain one fresh review and resolve material findings.
- [x] Record tested revision and final screenshots, package source and commit. Resume scene notes after this UI pass.

## Completion evidence

Implementation d53b3ce: confirmed full optimized gate exit0, TS76/Rust85/browser13 in4.0m; direct workflow7. One fresh review's responsive layout and keyboard focus findings fixed RED→GREEN. Original desktop/760/390/900×520 checks retained and expanded for641px wide-sidebar and resize transitions. Actual desktop/palette/narrow/constrained captures inspected. Exact artifacts, failed intermediate observations and scope limits are in RELEASE_VALIDATION.md.
