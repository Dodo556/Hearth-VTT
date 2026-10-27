# Current build · 0.0.14

One browser application for GM and players with an independent authoritative Rust host. This increment adds bounded saved freehand strokes alongside existing lines and rectangles. Shared/GM-only layers, colors and last-drawing undo use the same scene commands and storage. Closed paths work; GM-only and fog-hidden geometry is filtered before delivery.
- **Included:** campaigns/invitations, uploaded maps/scenes, controlled tokens and generic sheets, manual fog, ruler/pings, shared/private line/rectangle/freehand drawings, scoped dice/chat/whispers, plain-text journals, generic combat and whole-host isolated recovery.
- **Freehand:** 2–128 saved points, 0.01-scene-pixel normalization, bounded live sampling and simplification; 64 total drawings per scene. Pointer and Enter/arrows authoring; Escape, cancellation/capture loss, settings/scene/disconnect/disposal discard unfinished strokes. Rendering remains on change.
- **Compatibility:** schema12 adds point storage and preserves old drawing order/nonces. Schema10/11 backups remain verifiable and upgrade only in isolated recovered copies. Refresh the matched host and browser bundle together; wire schema stays1.
- **Checks:** complete optimized gate passes7 direct workflow assertions,67 TypeScript tests,81 Rust tests and13/13 real browser scenarios in3.6m, plus types/lint/format/Clippy/inventory/web/host build. Exact conditions are in RELEASE_VALIDATION.md; manual P0 gates remain open.
- **Status:** partially functional; full P0 encounter, actual LAN, platform/browser matrix and ready-to-run hosting distribution remain pending. No feature is promoted to VERIFIED.
- **Next:** bounded text and server-persisted scene notes, then token HP/status/context controls and remaining P0 work. The full advanced roadmap continues on this same application.

Source hosting still requires development tools; players use browser links. Shared drawings remain withheld until their complete stroke-expanded bounding rectangle is revealed. Long strokes may be simplified; text, individual drawing editing and redo remain pending.
