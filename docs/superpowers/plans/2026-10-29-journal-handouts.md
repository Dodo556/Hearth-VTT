# Journal image handouts implementation plan

Goal: one optional canonical raster image per existing journal page, uploaded by GMs, private on creation, explicitly revealed/hidden with the page. Preserve folders/search, authoritative saves, and one source line.

Architecture: reuse campaign assets and journal commands/projections. Add nullable campaign-validated assetId in schema18, not a second media store. Shared journals grant image download alongside existing scene/actor grants; hiding cannot retract previously delivered or independently shared art. Replacing an image requires a private save before reveal. No external URLs, SVG, rich text or per-player grants in this increment.
1. Establish the unchanged0.0.20 baseline with the pinned toolchain and complete release gate using disposable roots.
2. Add failing protocol/host tests for image references, private uploads, reveal/hide, foreign/missing assets, stale/player writes, direct downloads, current projections and restart.
3. Implement migration0018, domain/protocol image fields, campaign-scoped validation, filtered image authorization. Extend canonical backup validation, roundtrip and original17 upgrade tests.
4. Add tested sidebar upload/replace/remove, bounded image view and explicit Reveal to players/Hide from players actions; preserve failed/stale drafts, loading/error/offline behavior and UI_STANDARDS.
5. Run rendered GM/Alice/Bob acceptance with raw-frame privacy, conceal/reconnect/restart, screenshots and desktop/narrow/constrained/short action geometry. Run pnpm verify:release on the complete candidate. Update progress/feature/API/recovery/build evidence and save reusable environment install/start instructions.

Review focus: foreign asset IDs, same-art independent grants, stale upload completion, shared-image replacement, corrupted cross-campaign backup references. Keep existing migrations unchanged and every179 feature ID; no manual platform/LAN/playable promotion without evidence. Implement inline under the owner's autonomous continuation instruction.

## Completion evidence

Implemented inline on branch work; feature commit `9cb9e3f038bbb9681008aa201d67f4477c243e2b`. Complete final optimized gate: workflow7/TS107/Rust103/browser17 in5.7m, no skips; current18/original17 and retained10–16 backup recovery pass. Nine final view/editor captures inspected, one independent review, failed omission/receipt/schema18-browser regressions corrected RED→GREEN. See RELEASE_VALIDATION for interrupted/failed attempts and manual gates. Install/start draft saved; publication and fresh-task restoration remain unverified.
