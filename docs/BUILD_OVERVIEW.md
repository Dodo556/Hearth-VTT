# Current build · 0.0.13

One browser-only DM/player application with an independent authoritative Rust host. This update corrects player-map startup and avoids repeated rendering of unchanged scenes. Scene changes, map artwork, pan/zoom, token movement, drawing/fog previews and rulers request frames; shared pings animate and then return to idle. No fixed low-FPS limit.
- **Included:** VTT canvas and scene tabs, resizable sidebar, campaigns/invitations, uploaded maps, tokens and generic character sheets, manual fog, ruler/pings, shared/GM lines and rectangles with undo, dice, chat/whispers, journals, generic combat and whole-host backups/isolated recovery.
- **Checks:** complete optimized validation passes:7 workflow,63 TypeScript,77 Rust and13/13 real browser scenarios (4.2m), plus types/lint/Clippy/inventory/web/host build. Includes forced WebGL restoration, rendered players after restart and isolated whole-host recovery. Real GM/player/narrow screenshots inspected; exact evidence in RELEASE_VALIDATION.md.
- **Status:** partially functional, not verified playable. Full P0 session, real LAN, platform/current-browser checks and ready-to-run hosting distribution remain required.
- **Next:** close any integrated regression before feature expansion, then freehand/text and scene notes, token HP/status/context controls and remaining P0 gaps. The full advanced roadmap continues afterward.

Source: `pnpm try` still requires development tools on the host. Players use browser links. Schema11 and saved campaign formats are unchanged; preserve complete compatible application/data backups before updates. Drawings remain limited to64 per scene and shared shapes require their full bounding rectangle to be revealed.
