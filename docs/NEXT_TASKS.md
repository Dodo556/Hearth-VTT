# Next unblocked work

Permanent policy: one evolving Hearth, one source/release line. Follow CONTINUOUS_DEVELOPMENT.md and RELEASE.md. Restore the integrated working baseline before optional feature expansion; failed or unperformed required checks block promotion. `pnpm verify` and `pnpm verify:release` are the shared validation paths; CI configuration is not a claim of a completed run.

Build0.0.24 adds private journal reuse and fixes K021;0.0.23 adds opt-in safe journal formatting/source preview;0.0.22 adds selected-player journal sharing;0.0.21 adds private GM image handouts with explicit player reveal/hide;0.0.20 adds nested private GM journal folders and authorized page search;0.0.19 adds independent/linked token HP, six manual status markers and context actions;0.0.18 adds persisted private GM scene notes and explicitly shared player briefings;0.0.17 adds undoable whole-object erasing and direct text edit/move/resize/font/custom color;0.0.16 standardizes the vertical palette;0.0.15 adds literal text boxes; build0.0.14 adds bounded persisted freehand with existing layers/fog/undo and old-backup recovery; build0.0.13 corrects multi-client canvas startup with rendering on change; build0.0.12 added saved GM lines and rectangles with shared and GM-only layers, colors and undo; build0.0.11 added ruler and pings. Preserve the authoritative Rust/current-projection boundary, browser-only clients and stable VTT workspace. The restored host keeps accounts/passwords/game ACLs and resets sessions/unused invites. Final distribution must need no development tools/database installation.

## 1. Close the P0 gap report in phase order

The owner requested the0.0.16 UI consistency pass and0.0.17 eraser/direct-text workflow before scene notes, now implemented in0.0.18. Continue all future workspace features using UI_STANDARDS.md and ToolButton; keep vertical canvas palettes and bounded contextual editors.

See P0_GAPS.md. The recorded player-canvas loading blocker is corrected in0.0.13. Keep the rendered-player, idle GPU-draw and drawing/restart assertions in the integrated gate; fix any remaining gate failure before expansion. Scene notes now persist on the host with scoped versions and scene-filtered player briefings. Token HP/status/context controls now have a bounded first implementation. Richer drawing transforms, configurable note pins, arbitrary resources and automatic/custom conditions remain later work. The basic ruler and pings are implemented; configurable units, advanced paths and the rest of MAP-05 remain later work. Journal folders/search now have a bounded first implementation. Image handouts now have a bounded private-first implementation. Selected-player journal grants now protect text and images. Bounded safe journal formatting and same-campaign private journal reuse now exist. Continue with actor/content-library reuse and remaining initiative/status workflows. Broader libraries and rich editing remain later work. Keep host dashboard/network status and actual connected-user count distinct from membership. Do not move to elaborate vision/rules automation while these P0 gaps remain.

## 2. T015 / complete playable acceptance and distribution

Run the complete30-minute owner/Alice/Bob encounter and restart/recovery script, relevant security cases and real LAN join. Issue P0_RELEASE_NOTES only with actual evidence/gap closure. Ready-to-run headless packages, Windows/macOS/firewall/current-browser and later secure WAN checks remain required. Current recovery accepts schema10, schema11, schema12, schema13, schema14, schema15, schema16, schema17, schema18, schema19 and schema20 and bounded archives; scheduled/encrypted/selective/larger/broader cross-version recovery remain separate work.

## Following backlog

Advanced rules/inventory/effects/SRD provenance, rich/selective journals/social tooling, advanced dice, individual vision and protected map tiles; existing-account join/recovery/admin/lobby; sustained-load/security/a11y/tablet/localization gates. Existing K013–K018 remain recorded.

After every update: refresh BUILD_OVERVIEW and report included/pending/actual checks/next. Preserve all179 IDs; no feature VERIFIED before acceptance gates pass.

## Next implementation slices after0.0.24

1. Address minor ambiguous-copy confirmation recovery K022 with an explicit existing-copy action while continuing EXT-01 with bounded reusable actors and explicit private-first copies within existing media/ownership rules. Journal reuse/K021 are implemented; preserve them rather than repeating this slice.
2. Expand the existing reuse foundation toward a dedicated content library/metadata, then items/scenes and explicit cross-campaign transfer. Preserve source content/media/licensing, private-first copies and original records; never silently duplicate reader/owner grants.
3. Remaining initiative/status P0 interactions and owner dashboard/actual connection presence; then the complete encounter/LAN/distribution gates above.
