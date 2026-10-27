# Build 0.0.5: shared manual fog

T012 increment, authorized by master-plan §0.1 and the user's repeated instruction to continue. Keep the browser-only DM/player interface and independent Rust host. This is a source build; portable host packages remain pending.

Use one persisted square-grid exploration mask per scene. Alternatives considered: client-only paint cannot protect token metadata; arbitrary vector polygons add geometry/versioning complexity before walls/vision exist. A bounded server-owned bit mask fits existing square grids and transactional projection. No dynamic vision or per-player exploration in this increment.

Migration 0005 adds fog_enabled (false) and fog_bits (empty means covered) without changing earlier migrations. Grid dimensions are ceil(scene dimension / grid size), each at most 256. Bits are row-major, least-significant bit first; wire uses lowercase hex, at most 16,384 characters. Disabled fog preserves its mask and shows all otherwise shared tokens. Cover/reveal-all enables fog and resets the mask; padding bits stay zero.

Only the DM changes fog: fog.configure(sceneId,enabled), fog.paint(sceneId,column,row,width,height,mode reveal|hide), fog.reset(sceneId,mode). Integer rectangles must fit the grid; overflow is rejected. Painting requires enabled fog. These commands share campaign revision, receipt dedupe, archive/access checks and commit/notify boundaries. Changes trigger fresh authorized snapshots.

Players receive a shared token only if its entire bounding footprint is revealed in the active shared scene. The same predicate controls token artwork and player movement destinations. Current hidden token commands are indistinguishable from unknown tokens. Actor-sheet sharing is independent: an explicitly shared/granted actor and its portrait remain readable. Private encounter actors must stay private. Full active background images remain downloadable; the existing disclosure stays visible. Fog is not protected background delivery.

Historical token events record internal event-time tokenWasVisible as well as sceneWasPublic. Player delivery requires historical and current permission; strip both internal flags. A later reveal must never replay earlier hidden preparation names. Existing pre-fog events default to the former behavior because fog did not exist then.

DM controls: enable/disable (confirm exposing the whole scene), cover all, confirmed reveal all, select/pan, reveal/hide rectangle, and an accessible numeric grid rectangle. One pointer-up produces one command; gestures cancel on scene/tool/access/offline/busy change. Use a grid-resolution nearest-neighbor RGBA texture, opaque for players and translucent for the DM, clipped to scene bounds. Keep the Pixi renderer/camera stable across fog updates. GPU failure must not present an uncovered player map.

Acceptance: real API/TCP tests for filtering, art, ownership, bounds, malformed/forged commands, dedupe, re-hide, persistence and event history; TS tests for schemas/mask geometry/pixels; real multi-browser reveal/hide/reconnect controls and stable camera, plus baseline suites. One fresh whole-change reviewer, fix material findings, update all build records, preserve all 179 feature IDs, save the existing source artifact identity. No push, public deployment or license action.
