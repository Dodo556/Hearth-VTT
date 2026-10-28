# Literal text drawings · MAP-04

Continue the owner's instruction to implement the existing handoff in order. This is the next bounded canvas slice after validated freehand, on the same Rust/React/Pixi application. Scene-linked notes follow separately. Routine values below are implementation choices, not new owner requirements.

## Approach and behavior

Extend `drawing.create` with shape `text` and a text-only `text` field. Reuse scene records, GM authoring, shared/GM-only layers, colors, creation nonces, receipts, undo and current projections. Raster uploads would duplicate media management and lose literal source; a separate annotation command/store would duplicate working drawing authority. Choose existing drawings.

The GM chooses Text, enters literal text, then drags a box, or uses Enter/arrows/Enter. Preview the fitted text while placing. Save 1–120 Unicode scalars of trimmed, nonblank text, up to four lines. Reject controls except newline; treat markup as literal characters. Existing shapes reject non-null text. No HTML/Markdown, font downloads or new dependency.

The normalized rectangle must be inside the scene, 40–1024 scene pixels wide and 32–512 high. The host rounds text coordinates to 0.01 pixels and orders both corners. Client and host use the same rectangle requirements. Use the existing local system font, 24 scene pixels, wrap inside an eight-pixel inset and shrink only as necessary to fit. A rectangle mask contains all glyphs, including platform font fallback/overhang. Small boxes can produce small lettering; the preview shows this before placement. Custom fonts/style/individual editing remain later work.

## Privacy, lifecycle and durability

Shared text is serialized only if its entire box, including the existing conservative stroke margin, is revealed. GM-only text never enters player REST or live frames. Render shared labels below fog/tokens and GM-only labels above tokens. Cache keyed Pixi text/masks; update on authoritative changes and destroy removed objects/preview resources. Preserve rendering on change, idle behavior, context restoration and safe gesture cancellation on settings/tool/scene/access/offline/disposal changes. Text edits during placement cancel that unfinished gesture.

Keep 64 drawings/scene, eight scenes/campaign, incoming16KiB/outgoing4MiB. Migration0013 rebuilds drawings with a bounded nullable text column and text shape, copying rowids, points, coordinates and IDs exactly; creation nonces remain. Never edit migrations0001..0012. Backup schema13 validates original schema10/11/12 before upgrading only isolated restored copies. Preserve old point bytes and drawing order.

## Evidence required

Failing-then-passing protocol, real host validation/ACL/fog/idempotency, migration and backup tests; unchanged full maximum-freehand snapshot plus maximum-escaped text snapshot. Real GM/Alice/Bob browser placement, literal content, actual rendered player pixels, private raw-frame absence, keyboard/cancellation/zoom/reconnect/restart/undo. Complete `pnpm verify:release`, one fresh whole-change review and inspected desktop/narrow screenshots. Keep MAP-04 IN_PROGRESS and manual platform/LAN/distribution/P0 gates explicit.
