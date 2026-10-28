# Current build · 0.0.17

One browser application for GM and players with an authoritative Rust host. This increment adds whole-object erasing and direct on-map text editing within the existing vertical icon palette.
- **Included:** campaigns/invitations, uploaded maps/scenes, controlled tokens and generic sheets, manual fog, ruler/pings, drawings, scoped dice/chat/whispers, journals, generic combat and isolated whole-host recovery.
- **Eraser:** click a shape, freehand stroke or label; removes that whole object. Arrow keys and Enter support keyboard targeting. Undo restores erasures and reverses text edits/creation, retaining the latest128 scene changes across GMs. Middle-drag pans in drawing modes.
- **Text:** choose Text, click/drag a box and type directly on the map. Click an existing label to edit. Move/resize handles support pointer and arrow keys; choose font8–96px and custom color. Save text or Ctrl/Command+Enter commits; Escape/Cancel discards the active edit. Failed saves keep the draft. Up to120 Unicode scalars/four lines;40–1024×32–512 scene-pixel boxes. Explicit-size text wraps/clips instead of shrinking; old labels retain fitting until edited.
- **Compatibility:** schema14 adds versioned text/style/history and stable drawing order; exact freehand points/nonces remain. Schema10–13 backups retain canonical verification and upgrade only in an isolated copy. Refresh matched host/browser assets together; wire1, no new dependency.
- **Checks:** complete optimized gate passes with explicit exit0: workflow7/TS81/Rust89/types/lint/fmt/Clippy/179-ID inventory/matched builds/browser13 in4.5m. Review regressions pass; six real desktop/narrow editor/layout captures inspected. Exact tested source/evidence is in RELEASE_VALIDATION.md.
- **Status:** partially functional; full P0 encounter, actual LAN, platform/browser matrix and ready-to-run host distribution remain open. No broad feature is VERIFIED.
- **UI standard:** UI_STANDARDS.md and AGENTS rule13 govern tools, spacing, keyboard/focus and responsive checks.
- **Next:** persisted scene notes, then token HP/status/context controls and remaining P0 work.

Partial-stroke erasing, line/shape transforms, redo, rich text and custom fonts remain pending. Source hosting needs development tools; players use browser links.
