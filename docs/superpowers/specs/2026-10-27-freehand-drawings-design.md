# Bounded freehand drawing · MAP-04

Status: approved by owner in chat on 2026-10-27. Extends the existing drawing slice; does not replace the master plan or change the agreed feature order.

## Intent and scope

The GM can draw a continuous freehand stroke on the existing map, choose the existing color and shared/GM-only layer, and undo it like a line or rectangle. Other authorized browsers receive the saved stroke; it survives reconnect, host restart and whole-host backup/recovery. Keep the current Rust host, browser workspace and Pixi render-on-change scheduler.

Text, scene notes, erasing portions of strokes, pressure/variable width, individual editing, redo and custom layer ordering remain subsequent work. MAP-04 remains IN_PROGRESS.

## Approaches

The owner selected bounded point-based strokes in chat. This reuses scene drawings and preserves meaningful geometry for fog filtering and future editing. Raster uploads would add asset lifecycle work and make precise geometry and undo harder; they are not used. Streaming every pointer movement as an authoritative command would consume revisions and expose partial strokes; only completed strokes are sent.

## Geometry and bounds

Implementation proposal: 2–128 finite points, entirely within scene bounds, stored in scene coordinates and rounded by the host to 0.01 scene pixels. A stroke must retain at least two distinct points and at least one scene pixel of path length after normalization; closed loops are valid. The browser uses bounded sampling and deterministic simplification, retaining endpoints. It compacts long gestures while drawing and simplifies again on completion to fit the point cap. Show a short notice when a stroke was simplified. The preview and submitted geometry agree; the host validates independently and never trusts browser bounds.

Keep 64 drawings per scene across all shapes. Reject unknown fields, unsupported shapes, excessive points and out-of-scene/nonfinite geometry atomically, without consuming a revision or nonce. Keep the 16 KiB incoming message cap. Derive the maximum complete campaign snapshot with all eight scenes, maximum strokes and existing content; set a documented bounded outbound buffer only as large as that fixture requires. Do not rely on typical short strokes for capacity.

## Persistence, authority and privacy

Extend the existing drawing create/undo command path with an explicitly validated point representation. Existing line/rectangle commands and saved geometry continue to work. Add migration 0012 if still unused; preserve 0001–0011 unchanged. Preserve drawing order and scoped creation nonces during migration. Keep schema 10/11 backup verification against their original canonical schemas, then migrate only isolated restored copies.

Only current campaign GMs may author strokes. Project GM-only drawings to GMs only. Compute a stroke-expanded bounding rectangle from every normalized point; send a shared stroke only when the existing conservative fog rule permits that entire rectangle. Apply the same projection to REST, live snapshots and reconnect. Do not leak hidden geometry in acknowledgements/events.

## Interaction and rendering

Add Freehand to the existing Shape control and retain the current layer/color/Undo controls. Pointer-down starts a local draft, movement previews the path, pointer-up submits one authoritative command. Escape, pointer cancellation/capture loss, tool/layer/color changes, scene change, disconnect, permission loss and disposal discard the draft. Extra pointers cannot replace or commit the active gesture. Keep the existing keyboard workflow: Enter starts/finishes, arrows add path points, Escape cancels, with visible instructions.

Render shared strokes below fog/tokens and GM strokes above tokens, with the existing three-pixel style. Pan/zoom uses scene coordinates. Changes invalidate one scheduled frame; no perpetual rendering, late commits after disposal or context-restoration regression.

## Verification and delivery

Tests precede implementation: protocol limits; simplification/endpoints/closed loops; server authority, malformed inputs, caps, idempotency and all-point fog bounds; 11→12 migration and schema 10/11 recovery; maximum combined snapshot; real pointer and keyboard save/cancel; independently authenticated GM/Alice/Bob raw-frame privacy, rendering, reconnect/restart, undo and camera behavior.

Run the complete optimized gate against matched web/host artifacts, preserve existing assertions, and capture a real screenshot with fictional data. Update progress, overview, API/model/recovery guidance, decisions, known issues and feature evidence without claiming the full P0/platform/LAN/distribution gate. Proposed next functional version: 0.0.14, schema 12, wire schema 1.
