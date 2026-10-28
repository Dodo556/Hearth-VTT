# Current build · 0.0.15

One browser application for GM and players with an authoritative Rust host. This increment adds saved literal text boxes to the existing shared and GM-only drawing layers, alongside lines, rectangles and freehand.
- **Included:** campaigns/invitations, uploaded maps/scenes, controlled tokens and generic sheets, manual fog, ruler/pings, drawings, scoped dice/chat/whispers, journals, generic combat and whole-host isolated recovery.
- **Text:**1–120 Unicode characters, up to four lines; local font, color, fitted box preview, pointer or Enter/arrows placement and last-drawing undo. Labels stay inside their saved box and follow full-box fog filtering. Editing text/settings or canceling discards an unfinished placement.
- **Compatibility:** schema13 preserves old drawing order/point bytes/nonces. Schema10/11/12 backups remain verifiable and upgrade only after isolated restoration. Refresh matched host/browser assets together; wire schema1 remains. No new dependency.
- **Checks:** complete `pnpm verify:release` passes workflow7/TS72/Rust85/types/lint/fmt/Clippy/179-ID inventory/matched builds and all13 browser scenarios in3.7m. Independent review finds no blocking issue; a stronger all-edge clipping test remains K019. Actual screenshots/evidence are in RELEASE_VALIDATION.md.
- **Status:** partially functional; manual P0 encounter, actual LAN, platform/browser matrix and ready-to-run host distribution remain open. No broad feature is VERIFIED.
- **Next:** server-persisted scene notes, then token HP/status/context controls and remaining P0 work.

Text wraps and can shrink in a small box; choose a larger box for larger lettering. Individual drawing editing, redo, custom fonts and rich text remain pending. Source hosting requires development tools; players use browser links.
