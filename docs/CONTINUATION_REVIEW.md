# Cloud continuation review · 2026-10-27

## Source and request

The owner supplied CODEX_HANDOFF.md and Hearth_VTT_0.0.13_Codex.zip and asked to continue development. In chat the owner selected the recorded feature order after validating the existing build. Attachment instructions supply project context; historical test results are not results from this environment.

The GitHub checkout had no commits or working files. The archive contained 224 files beneath hearth-vtt/; all were imported into the repository root after checking paths and rejecting symlinks. The separate handoff is byte-identical to the archived copy. Archive SHA-256: `e5ff90444b5021d07eb1a3d758e89ed8245c49b3febd1714fab54c3956f4e802`. Local import checkpoint: `c50056b3673a7097570acaff26d42fecc37e07c8`. Only AGENTS.md and CODEX_HANDOFF.md Markdown formatting differs from the archive at that checkpoint; product code and lockfiles are unchanged. The archive's old Git SHAs are provenance, not ancestors of this import. No source has been pushed or published.

## Confirmed architecture and boundaries

- One self-hosted Rust/Axum/Tokio service, SQLx/SQLite WAL and local artwork; one React/TypeScript/Pixi browser application for both GM and players. Closing the GM tab does not own server lifetime. No SaaS account, cloud database or API key is required for normal development.
- Authentication and campaign authorization precede server-side projections. Revisioned commands, transactional receipts and fresh authorized reconnect snapshots are the extension points for new gameplay behavior.
- The current scene drawing path crosses domain commands, server drawing validation and scene/fog projection, SQL migration 0011, strict TypeScript schemas, DrawingControls, Table and SceneCanvas. Lines and rectangles already persist, synchronize and support last-drawing undo. Only the GM authors them; there are 64 per scene, shared and GM-only layers.
- Shared drawing visibility uses the whole stroke-expanded bounding rectangle. Freehand must account for every point when deriving that rectangle. Looking only at stroke endpoints would leak curved paths into hidden areas.
- Pixi renders on invalidation and animates only while needed. New tools must invalidate previews, commit/cancel, artwork changes and context restoration without reintroducing a perpetual ticker or late work after disposal.
- Application version is 0.0.13, database schema 11 and wire schema 1. They are separate version domains. A changed persistent drawing model needs a forward migration and tests for earlier schema 10/11 backup verification and isolated upgrade.

## Scope and review findings

The included flows cover identity/campaigns/invitations, maps/scenes, controlled tokens and generic sheets, manual fog, ruler/pings, saved lines/rectangles, scoped dice/chat, plain-text journals, generic combat and whole-host recovery. This is a substantial implementation to extend, with partial roadmap coverage.

The matrix retains 179 distinct IDs: 51 IN_PROGRESS, 127 NOT_STARTED and one SCAFFOLDED; none VERIFIED. Those are inventory states, not completion percentages. Several journal rows JRN-03..10 repeat generic plain-text evidence even though their individual rich-content, scene-link, collaboration and worldbuilding requirements are pending; reconcile those rows against actual feature-specific evidence in a later documentation correction. Do not infer those capabilities from the shared status wording.

Important product limits remain explicit: authorized players can download the entire background image despite visual fog; strict protected map tiles are absent. Member lists are not live presence. Combat is manual and generic, journals are short plain text, and current hosting is a developer source workflow. The no-development-tools host package, actual LAN session, Windows/macOS/current-browser matrix, secure WAN and complete 30-minute P0 encounter remain separate acceptance gates. No P0 release or feature promotion is implied by a passing automated suite.

## Baseline checks in this environment

Pinned Node 24.19.0, pnpm 11.25.0 and Rust 1.99.1 with rustfmt/clippy are available. Frozen pnpm installation and locked Cargo fetch succeeded. Runtime activation is in /workspace/hearth-tools/activate.sh, outside the source checkout. The repeatable setup script was exercised successfully after initial installation.

The initial shared gate stopped at two Markdown formatting errors introduced by the handoff repack. Formatting those two documents resolved the failure without changing instructions or product code. The restricted-process attempt then passed types, 63 TypeScript tests, Rust formatting/Clippy and unit tests, but 30 TCP integration tests failed at local listener creation with OS permission denied. A complete rerun with local sockets available is the applicable gate; failed partial runs are not combined into a pass.

Playwright's matching Chromium 156 download was denied by the environment domain policy. System Chromium 154.0.8037.57 is installed; launch and WebGL2 were verified through the supported HEARTH_CHROMIUM_EXECUTABLE override outside the restricted process sandbox. Root authentication for Playwright's system-package installer is unavailable, but the existing browser/system libraries work. No TLS, checksum or package verification was disabled. This does not establish matching Chromium 156, Firefox or WebKit coverage.

The imported0.0.13 full optimized gate passed TS63/Rust77/browser13 in3.3m. The new freehand candidate has separate evidence in RELEASE_VALIDATION.md. Direct execution of scripts/verification.test.mjs passed all seven named workflow assertions; Node's --test invocation reports one aggregate file result in this runtime.

## Agreed continuation order

1. Finish and record a full baseline gate; resolve genuine regressions first.
2. Add bounded freehand drawing through the existing authoritative drawing path, with geometry/payload/snapshot bounds, cancellation, privacy, undo, restart/reconnect and old-backup upgrade coverage.
3. Continue bounded text and server-persisted scene notes, then token HP/status/context controls and the remaining P0 gaps. Preserve the complete later roadmap.

The original import/setup checkpoint did not include freehand. After this review, the owner approved the bounded freehand design and implementation; see its current source/progress/validation evidence. Text, scene-note, token-status and distribution features are not claimed as newly implemented.
