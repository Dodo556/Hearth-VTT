# Current build · 0.0.16

One browser application for GM and players with an authoritative Rust host. This increment replaces the wide drawing form with a vertical icon palette and compact text editor. Shape icons, layer controls, color swatches, undo and close follow one shared tool-button convention. Existing line/rectangle/freehand/text drawing behavior is preserved.
- **Included:** campaigns/invitations, uploaded maps/scenes, controlled tokens and generic sheets, manual fog, ruler/pings, drawings, scoped dice/chat/whispers, journals, generic combat and whole-host isolated recovery.
- **Text:**1–120 Unicode characters, up to four lines; local font, color, fitted box preview, pointer or Enter/arrows placement and last-drawing undo. Labels stay inside their saved box and follow full-box fog filtering. Editing text/settings or canceling discards an unfinished placement.
- **Compatibility:** schema13 preserves old drawing order/point bytes/nonces. Schema10/11/12 backups remain verifiable and upgrade only after isolated restoration. Refresh matched host/browser assets together; wire schema1 remains. No new dependency.
- **Checks:** focused component/types and real GM/two-player browser layout/workflow checks pass; final optimized gate/review/captures are recorded in RELEASE_VALIDATION.md. Earlier evidence belongs to0.0.15.
- **Status:** partially functional; manual P0 encounter, actual LAN, platform/browser matrix and ready-to-run host distribution remain open. No broad feature is VERIFIED.
- **UI standard:** UI_STANDARDS.md and AGENTS rule13 guide future tools, spacing, icons, keyboard/focus behavior and responsive checks.
- **Next:** server-persisted scene notes, then token HP/status/context controls and remaining P0 work.

Text wraps and can shrink in a small box; choose a larger box for larger lettering. Individual drawing editing, redo, custom fonts and rich text remain pending. Source hosting requires development tools; players use browser links.
