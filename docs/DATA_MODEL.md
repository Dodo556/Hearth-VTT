# Persisted model · migrations0001–0010

`users` contains unique case-insensitive usernames, Unicode display names, Argon2id password hashes and a constrained owner flag. A unique partial index permits exactly one owner; `host_profile` singleton references it. `device_sessions` stores only token hashes, identity and expiry.

`campaigns` owns `memberships` (dm/player), `invites` (hashed code, expiry, used/revoked timestamps), `scenes`, `tokens`, `journals` and uploaded `assets`. Ordinary IDs are server UUIDs; scene/token creation accepts validated browser-generated UUIDs inside authoritative commands. Membership is required on every campaign-scoped request; no browser role claim grants authority.

Scenes persist name, image dimensions, square grid, background asset and `visibility` (dm/shared). Campaign `active_scene_id` selects the sole player-visible shared scene; DM can browse other scenes locally. New scenes default private. Activation marks the scene shared and changes the active ID. Concealment makes it private and clears the active ID if selected. A maximum of8 scenes exists per campaign. Upgrade0003 activates/shares the first existing scene, preserving the previous sample table.

Tokens are scene placeables with optional actor links. Names/art/size are editable; movement/visibility/controller assignment remain separate commands. Token deletion cascades controller removal. Maximum100 tokens/campaign. Journals contain DM-authored plain text with shared/dm visibility and an integer version. Up to16 pages/campaign, titles80 and bodies1000 Unicode scalars. Migration0008 preserves old pages at version1; guarded edits/deletes advance/check version. Actor ownership, manual fog and dice are described below; chat is described below; combat is described below.

`assets` stores campaign ownership, SHA-256, canonical dimensions/byte size and creation time, unique by campaign/hash. Blobs live at `assets/<server-generated hash>.png` in the data root. PNG/JPEG/WebP input is decoded and re-encoded to RGBA PNG, removing source metadata/trailing bytes. Deduplication/quota checks/file installation/metadata insert serialize in an IMMEDIATE transaction. Normal failures remove temporary files; a process crash can leave an unreferenced blob. Cleanup and full-data crash recovery are future work. Known original demo asset IDs remain compiled into the host.

SQLite uses WAL, FULL synchronous writes, FK constraints, a five-connection pool and5-second busy timeout. An exclusive data-root file lock prevents two hosts from using the same store. Setup/invitation redemption and commands use IMMEDIATE write transactions. Authorized REST scene/journal/media reads establish membership/session and project documents in one read transaction; live snapshots also use a read transaction.

Migration0002 adds campaign revisions, one-player `token_controllers`, `command_receipts` keyed by campaign/user/request ID, and bounded ordered `campaign_events`. State/revision/receipt/event commit together; notices carry no private game payload. Controllers are removed on membership revocation. Internal token events now persist `sceneWasPublic` at commit time. Player delivery requires both publication then and authorization now, preventing historical private preparation from appearing after activation. This internal flag is stripped before serialization. Structural scene events trigger fresh filtered snapshots.

Before pending migrations on an existing store, VACUUM INTO creates a consistent database snapshot including committed WAL state; integrity/FK checks and a persisted SHA-256 checksum must succeed before migration. The migration directory is tracked by build.rs so new embedded SQLx migrations invalidate incremental builds. A v1 fixture verifies upgrade/data retention and the original backup. Snapshots cover the database only; full backups must also include uploaded assets. Full restore/crash tooling remains pending.

Migration0004 adds actors (campaign/name/kind/portrait/biography/private notes/HP/custom JSON properties/visibility/version), actor_ownership with composite foreign keys to actor+campaign and membership, and nullable tokens.actor_id ON DELETE SET NULL. Membership/actor deletion cascades grants; linking clears old standalone control. Private sheet projection is independent of scene visibility; ownership explicitly grants read/edit, while hidden token/scene projection remains unchanged. Actor version preconditions protect forms independently of unrelated movement. Scene renames compare expectedName in the same transaction. Limits and wire contract: API.md. Existing migrations remain unchanged; pre-upgrade backup and asset-directory requirements remain.

## Message history and explicit recipients (0009)

chat_messages stores host-owned IDs, caller-scoped client_message_id, host-copied sender/name/time, literal text/scope and revision. chat_recipients and dice_recipients hold immutable selected account IDs, cascading when history records are pruned. They deliberately do not cascade on membership deletion; a future authorized same-account rejoin can recover retained history. No request bypasses current membership. chat_rate independently retains precise millisecond timestamps/nonces with membership cascade, so history pruning cannot replenish budgets. Keep1000 messages and1000 rolls/campaign; send latest20 of each after filtering.

0009 transactionally rebuilds the dice table to extend its CHECK to selected scope, preserving existing IDs/nonces/AST/result JSON bytes and indexes; previously shipped migrations remain unchanged. Upgrade fixture from8 proves preserved bytes, foreign-key integrity and pre-upgrade backup. Snapshot remains bounded, now with20 maximum text messages and8 recipients each plus maximum selected rolls/actors/tokens/journals/fog under768KiB.

## Generic combat (0010)

combat_encounters has one row per campaign, a scene foreign key, host ID/name/version/status/round/current entry and monotonic next_sort_order. combatants references encounter/token, with unique token membership, own version/manual initiative and stable insertion order. Scene/token deletion cascades; command commit reconciles a missing current entry. Actor HP remains in actors, never copied into combat storage. combat_creation_nonces scopes accepted creation nonces by campaign/user/kind and retains them after clear. Encounter/entry IDs are generated by the host. Limits:32 entries, initiative integer[-1000,1000] or null, encounter name80 Unicode scalars, round capped1e9. A9→10 fixture verifies old chat/dice/journal bytes, foreign keys, pre-upgrade snapshot and reopen. Maximum combined snapshot includes32 entries under768KiB.


## Scene drawings (0011)

Each drawing belongs to one scene and stores a host-generated ID, line or rectangle shape, shared/GM visibility, color and two scene-space endpoints. Rows are ordered by insertion for rendering and undo. Caller-scoped creation nonces remain after deletion. A scene permits 64 drawings; current snapshots filter GM-only shapes and shared shapes intersecting unrevealed fog before serialization. Schema 10 recovery is validated against its own canonical migrations and upgraded after isolated restore.

## Freehand storage ·schema12

Forward migration0012 rebuilds drawings with freehand in its shape constraint and a `points` JSON array column. Old rows receive `[]`; rowids and creation nonces preserve authoring/undo order. Freehand rows require2–128 stored points; host validation further checks coordinate bounds, normalized geometry and path length. Domain DTOs carry points only when present. Published0001–0011 remain unchanged. Backup canonical schemas10/11/12 are independently verified; old copies upgrade only after isolated restoration.

## Text storage ·schema13

Forward migration0013 rebuilds drawings with the text shape and nullable `text` column. Its constraint allows1–120 SQLite characters only for text shapes; other shapes retain NULL. The host further validates nonblank/control/line/rectangle bounds. Copy explicit rowids, all existing point bytes and all other fields; preserve the separate nonce table. DTOs omit absent text. Undo order survives upgrade. Migrations0001..0012 remain unchanged. Backup schemas10..13 are each validated against their canonical history before isolated restore and current-host upgrade.

## Drawing edits ·schema14

Forward migration0014 adds integer `font_size`8–96(default24), `text_fit`(default1 for legacy labels), positive `version`(default1) and `sort_order` initialized from existing rowids. New rows use increasing per-scene sort order; projections order by sort_order then rowid. Undo restores the saved sort order while allocating a fresh physical rowid. This prevents an erasure in sceneA from colliding with a later row allocated in sceneB. Original migrations0001..0013 remain unchanged.

`drawing_history` records per-scene create/delete/update actions. Delete/update snapshots retain all drawing fields, exact raw point JSON and order; create needs no before snapshot. Each transactional change prunes to the latest128 actions in its scene. Undo removes a create, restores a delete or restores prior text/style/box while advancing version, then pops that action. Nonces/receipts remain separate and retained. History stays out of player/live DTOs; only GMs receive canUndoDrawing. Whole-host backup includes history/style/version/order.

## Scene notes ·schema15

Migration0015 adds `scene_notes(scene_id,visibility,body,version)` with composite primary key(scene_id,visibility), cascading scene FK, dm/shared CHECK, body length<=1000 and positive safe persisted version. Missing rows project as empty/version0 to GMs. Every accepted save, including a clear, retains/increments that scope's version inside the existing campaign transaction. Independent versions avoid conflicts between private preparation and shared briefing changes. Scene deletion removes notes; note bodies never enter event payloads or browser layout storage.

Filter scene access before reading notes, then filter scope before serialization. Players get no private body/version/placeholder and receive a shared row only when its body is nonblank. The8-scene/two-scope/body limits bound note content; the combined maximum campaign snapshot includes all16 maximum-Unicode notes. Original migrations0001..0014 remain byte-identical. Canonical archive verification supports schemas10..15 and upgrades old copies only after isolated restore.

## Token resources ·schema16

Migration0016 appends token `vitals_version` (positive safe integer, default1), nullable `hp,max_hp` (both null or bounded pair), `hp_visibility` (`controllers` default/`shared`) and `statuses` (JSON array, max6). Strict command validation rejects duplicate/unknown marker IDs. Migrations0001..0015 are unchanged. Linked resource projection/save uses the existing actor row/version; stored independent values survive linking. Source/link/delete transitions invalidate token drafts, and actor versions independently guard sheet/combat changes. No derived linked HP copy is stored.

Filter scene/fog/token visibility first, then bar/read/edit authorization before serialization. Movement event storage omits health/vitals/statuses; live/replay uses current recipient-authorized metadata. Combat can display an independent token's permitted health while existing linked editing uses the actor. Canonical backups support schemas10..16 and isolated upgrades; current exact roundtrip includes HP, sharing, markers and versions, and original15 recovery preserves scene notes while adding unset/default-private token resources.

## Journal organization ·schema17

Migration0017 adds journal_folders(id,campaign_id,parent_id,name,version), campaign cascade FK, nullable parent FK,60-scalar name bounds, safe version and self-parent CHECK; journals.folder_id is a nullable FK. Host transactions enforce same-campaign references,16 folders, four levels and no cycles across a moved subtree. Folder delete explicitly promotes direct pages/children before deleting only the folder; affected versions advance. Existing journal content updates preserve folder membership. Original migrations0001..0016 remain byte-identical.

Organization is GM-only metadata; current page sharing still controls content access. REST/live omit folder objects and page folderId for players; commands emit no private event payload. Canonical archive validation additionally checks cross-campaign folder/page references, quotas and bounded ancestry. Current roundtrip preserves exact hierarchy/name/version/page placement alongside notes/vitals/artwork/history; original16 isolated upgrade joins10–15 and preserves existing pages at root.

## Journal images ·schema18

Migration0018 adds nullable `journals.asset_id` with a restricted asset FK and a partial campaign/asset index. Existing text, folders, visibility and versions are unchanged; old rows have no image. GM command transactions and backup validation enforce same-campaign image references. Only registered canonical uploads are accepted. Create stays private; changing/removing the image requires a private save before a separate reveal. An omitted update preserves the current reference; explicit null removes it, and serialization preserves this distinction for command-receipt fingerprints.

Shared page/image IDs enter only authorized current REST/live projections. A shared journal independently grants media reads alongside scene/token/actor/other-page grants; hiding/deletion removes only its grant. No image bytes, private IDs or historical titles are added to live event markers. Canonical10–17 archive validation/isolated upgrade remain supported; current18 archives preserve references and all registered artwork under the trusted whole-host owner backup model. Original migrations0001..0017 remain unchanged.

## Selected journal readers ·schema19

Migration0019 adds journal_recipients(campaign_id,journal_id,user_id), primary key(journal_id,user_id), cascading journal FK and composite membership FK, plus a campaign/user/journal reader index. Existing journals remain dm/shared in storage. A dm page with nonempty grants derives selected in the GM DTO; removing the last grant leaves it private. No old page/art/folder/version is rewritten. Current-host validation and canonical backup validation enforce journal/campaign coherence, player membership, private stored scope and at most8 grants/page. Membership revocation and page deletion remove grants; current live projections reauthorize through the existing access epoch. Grants never enter player DTOs or content-free event markers.

## Journal formatting ·schema20

Migration0020 adds journals.body_format TEXT NOT NULL DEFAULT plain with a plain/markdown CHECK. Existing source/visibility/images/folders/selected grants are untouched and never auto-interpreted. New command fields use a strict enum; omission is separately preserved for update/receipt compatibility. Current authorized projections expose markdown format only with an entitled page. No generated HTML or renderer state is stored. Current20 backups retain exact source/format and all previous data; canonical10–19 archives upgrade in isolated copies. Original19 fixture retains selected readers while defaulting format to plain.
