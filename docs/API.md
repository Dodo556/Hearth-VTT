# Build0.0.6 API (schemaVersion 1)

This is the implemented scope, not the master plan's future route inventory. All JSON responses carry `schemaVersion: 1`. IDs are opaque UUIDs except the named original demo asset IDs. The authenticated WebSocket endpoint is documented below.

| Method/path                                          | Request                                      | Result and authorization                                                                                 |
| ---------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET `/api/health`                                    | none                                         | `{status:"ok",version,setupRequired}`; public, no campaign metadata                                      |
| POST `/api/setup/owner`                              | `{username,displayName,password,createDemo}` | `{user}` + session cookie; atomic initial owner only                                                     |
| POST `/api/auth/login`                               | `{username,password}`                        | `{user}` + new session cookie                                                                            |
| GET `/api/auth/me`                                   | session cookie                               | `{user: User or null}`                                                                                   |
| POST `/api/auth/logout`                              | session cookie                               | `{ok:true}`; revokes current session and clears cookie                                                   |
| GET `/api/campaigns`                                 | session cookie                               | `{campaigns: Campaign[]}`; current memberships only                                                      |
| POST `/api/campaigns`                                | `{name,description,createDemo}`              | `{campaign}`; owner only                                                                                 |
| GET `/api/campaigns/{id}`                            | session cookie                               | `{campaign}`; membership required                                                                        |
| PATCH `/api/campaigns/{id}`                          | `{name,description,archived}`                | `{campaign}`; campaign DM only                                                                           |
| GET `/api/campaigns/{id}/members`                    | session cookie                               | `{members}`; campaign DM only                                                                            |
| POST `/api/campaigns/{id}/invites`                   | `{expiresInHours}` (1–168)                   | `{invite:{id,code,expiresAt}}`; DM only; secret code returned once                                       |
| POST `/api/campaigns/{id}/invites/{inviteId}/revoke` | `{}`                                         | `{ok:true}`; DM only                                                                                     |
| POST `/api/invites/redeem`                           | `{code,username,displayName,password}`       | `{user,campaignId}` + session cookie; creates new player identity atomically                             |
| POST `/api/campaigns/{id}/members/{userId}/revoke`   | `{}`                                         | `{ok:true}`; DM only; cannot revoke self                                                                 |
| GET `/api/campaigns/{id}/scenes`                     | session cookie                               | `{scenes: Scene[]}`; membership and filtered tokens                                                      |
| GET `/api/campaigns/{id}/scenes/{sceneId}`           | session cookie                               | `{scene}`; campaign-scoped lookup                                                                        |
| GET `/api/campaigns/{id}/journals`                   | session cookie                               | `{journals: Journal[]}`; private pages omitted for players                                               |
| GET `/api/campaigns/{id}/journals/{journalId}`       | session cookie                               | `{journal}`; private/unknown both 404                                                                    |
| GET `/api/campaigns/{id}/assets/{assetId}`           | session cookie                               | authorized canonical uploaded/original PNG; active shared reference for players; private/unknown both404 |

Asset endpoints:

| Method/path                       | Request                                                            | Result and authorization                                                                         |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| GET `/api/campaigns/{id}/assets`  | session cookie                                                     | `{assets:Asset[]}`; DM only, includes unattached campaign uploads                                |
| POST `/api/campaigns/{id}/assets` | raw PNG/JPEG/WebP with matching Content-Type, Origin/custom header | `{asset:Asset}`; DM only; canonical hash dedupe,32 assets/100MiB quota; archived campaign denied |

Upload limits:8MiB input,4096px per side,16MiB canonical output; two concurrent uploads,10-second body deadline. Malformed/mislabelled/truncated input returns422; oversized body413; occupied upload slots429/UPLOAD_BUSY. Decoding/re-encoding removes metadata/appended bytes. Downloads stream uploaded PNG blobs with no-store/nosniff; players need a visible active-scene background/shared-token reference. Unattached uploaded art is DM-only; foreign campaign/hidden/unknown references return404. Authorization/projection share a read transaction. Already sent or in-flight image bytes cannot be recalled.

Every HTTP mutation requires an exact allowed `Origin` and `X-Hearth-Request: 1`. JSON mutations require JSON content type; asset upload uses the matching raster media type and a raw body. No CORS permission is granted to foreign origins. Host headers must match the configured origin authorities. Vite forwards the same-origin `/api` path during development. HTTP cookies are accepted only for loopback/trusted LAN mode; internet TLS/proxy mode is not implemented. Default session lifetime is 8 hours; random secret is hashed in SQLite. Credentials are never stored by the client.

`User = {id,username,displayName,isOwner}`. `Campaign = {id,name,description,role:"dm"|"player",archived,createdAt,sceneCount}`. `Scene = {id,campaignId,name,width,height,gridSize,backgroundAssetId,visibility:"shared"|"dm",active:boolean,tokens:[{id,name,x,y,size,color,assetId,visibility:"shared"|"dm",controllerUserId:string|null,canMove:boolean}]}`. `Asset = {id,width,height,byteSize}` (campaign-owned canonical PNG; no original filename/path). `Journal = {id,title,body,visibility:"shared"|"dm"}`. `Member = {id,displayName,username,role}`. Player campaign sceneCount counts only the active shared scene (0 or1); DM count includes all preparations. Times are Unix seconds. Scene coordinates are world pixels, independent of the client camera.

Errors: `{schemaVersion:1,error:{code,message}}`. Codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND_OR_HIDDEN` (404), `VALIDATION_FAILED` (422), `ALREADY_CONFIGURED`/`CONFLICT` (409), `RATE_LIMITED` (429), `PAYLOAD_TOO_LARGE` (413), `INTERNAL_ERROR` (500). Unknown API routes return JSON 404. No SQL text, credentials, session/invite secrets, private document contents or stack traces are returned in errors.

Login/setup/invite redemption are limited per socket peer (10 attempts/minute), with a bounded bucket map and concurrent password work. Invitations are 256-bit random single-use credentials and expire server-side. Creating a specific invitation is the DM's approval to create one new player; a pending-approval lobby and existing-account invitation redemption remain future work.

## Live campaign stream

GET `/api/campaigns/{id}/ws` upgrades only with a current session, campaign membership, exact allowed Origin/Host and `Sec-WebSocket-Protocol: hearth.v1`. Browsers use their HttpOnly cookie; no URL token. The HTTP custom mutation header is unnecessary for this Origin-checked upgrade. Send within five seconds:

```json
{ "kind": "hello", "schemaVersion": 1, "lastRevision": null }
```

Every connection receives a freshly authorized `snapshot` with `streamId`, campaign `revision`, `role`, `scenes`, `journals`, `actors` and `serverTime`. `lastRevision` is a reconnect hint; historical reconnect replay is deliberately not enabled. All coordinates are world pixels. Tokens include `controllerUserId` (DM or own identity only) and server-derived `canMove`.

```json
{
  "kind": "command",
  "schemaVersion": 1,
  "requestId": "8f834642-e1a2-42f2-9c5b-a80b91991344",
  "baseRevision": 3,
  "command": {
    "type": "token.move",
    "payload": { "tokenId": "e7ad07f2-d53f-4c11-9e75-aa24755df2a8", "x": 630, "y": 690 }
  }
}
```

Existing commands: `token.assign` payload `{tokenId,userId:string|null}` and `token.visibility` payload `{tokenId,visibility:"shared"|"dm"}`; both DM only. Assignment targets a current campaign player. Players move only their assigned shared token; DM moves any. Archived campaigns reject live mutations. Finite coordinates must keep the entire token within scene bounds. Client drag/arrow movement snaps to grid centers; numeric movement accepts exact in-bounds values. Unknown fields/actions/versions fail.

DM authoring commands use the same command envelope, base revision, receipt and authority checks:

| Type             | Payload                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scene.create`   | `{sceneId,name,assetId,gridSize}`; validated new UUID,1–80-character name,20–256px integer grid; creates a private draft at the image dimensions (minimum64px/side) |
| `scene.activate` | `{sceneId}`; mark shared and select as the sole active player scene                                                                                                 |
| `scene.conceal`  | `{sceneId}`; make private, clear active ID if matched                                                                                                               |
| `token.create`   | `{tokenId,sceneId,name,assetId,size,x,y,visibility}`; validated new UUID;16–256px size, entire token inside scene                                                   |
| `token.update`   | `{tokenId,name,assetId,size}`; movement/visibility/assignment remain separate commands                                                                              |
| `token.delete`   | `{tokenId}`; deletes token and its controller; identical retry returns saved receipt                                                                                |

Limits:8 scenes/100 tokens per campaign. Assets must be known demo IDs or owned by the same campaign. All authoring is DM-only. Players can move only a controlled shared token on the currently active shared scene. DM selection is local; only activation changes player selection. A concealed active scene leaves players with no scene until another is activated. Scene structural commands deliver fresh filtered snapshots; they do not cause pending commands to be resubmitted unless reconnecting.

Accepted writes commit the affected documents, incremented revision, event and receipt in one IMMEDIATE transaction. Outgoing `event` frames have `streamId,eventId,revision,type,payload,serverTime`; types are `token.upsert` with `{sceneId,token}`, `token.removed` with `{sceneId,tokenId}`, or `sync.cursor` with `{}` for invisible changes. Internal token events retain whether their scene was public at commit time; the flag never goes on the wire. Private preparation history is suppressed even if activation happens after an event batch was fetched. Scene creation/activation/concealment trigger fresh authorized snapshots. The cursor discloses sequencing/activity, not hidden IDs, names, coordinates or controllers. Token deltas preserve the browser camera. A stream/revision gap causes fresh snapshot recovery.

An `ack` carries `requestId,revision,duplicate,serverTime`, after this connection drains committed events. Retrying the same ID/base/command yields its original saved receipt without another write. Changed content with that ID returns `REQUEST_ID_REUSED`; a new command with an old base returns `STALE_REVISION`. No silent overwrite or automatic rebase. Other errors use `{kind:"error",schemaVersion:1,requestId:string|null,error:{code,message}}`. A rejected command creates neither a revision nor a receipt.

The host keeps 256 events and receipts for seven days/up to 10,000 revisions per campaign. Older accepted requests cannot execute again with their old base. Membership/session changes trigger reauthorization; `closing` with `ACCESS_REVOKED` clears protected browser projections; `HOST_SHUTTING_DOWN` invites reconnect. Sessions are also checked during the subscription. Reconnect backoff caps at eight seconds plus jitter; one in-flight request retains its exact ID/body for retry after a fresh snapshot, with a 15-second confirmation deadline. Editing pauses when offline/reconnecting.

Bounds: 64 sockets per host, four per user, 16 KiB frame/message limit, 20 inbound frames/second/connection, 768 KiB maximum write buffer, three-second JSON write timeout, five-second hello deadline and ping/idle timeout. Queued events recheck session/membership and current token visibility between awaited sends, with a five-second batch deadline. A slow socket has its own task and cannot block other subscribers. Missing retained events produce a fresh authorized snapshot.

## Build0.0.4 actors and scene management

GET /api/campaigns/{id}/actors returns {schemaVersion:1,actors}; GET /api/campaigns/{id}/actors/{actorId} returns {schemaVersion:1,actor}. Session/member authorization and projection share a read transaction; hidden/unknown/foreign actors return identical404.

Actor fields: id,version,name,kind(character/npc),assetId,biography,hp,maxHp,attributes(text map),visibility(dm/shared),canEdit. Only DM receives dmNotes and permissions[{userId,permission(observer/owner)}]. Private actors require an explicit grant; shared actors are member-readable. Portrait download authorization includes readable actor references. Tokens carry actorId:null when its sheet is unreadable. Their name/art stay independent.

| Live command     | Payload / authority                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| actor.create     | actorId,name,kind,assetId,biography,dmNotes,hp,maxHp,attributes; DM, private by default                                                    |
| actor.update     | actorId,expectedVersion,name,biography,hp,maxHp,attributes, optional assetId/dmNotes; owner or DM; owners must omit portrait/private notes |
| actor.permission | actorId,userId,permission(none/observer/owner); DM, current campaign player                                                                |
| actor.visibility | actorId,visibility(dm/shared); DM                                                                                                          |
| actor.delete     | actorId; DM, cascades grants and unlinks tokens                                                                                            |
| token.link       | tokenId,actorId(string/null); DM, same campaign; clears independent controller                                                             |
| scene.rename     | sceneId,expectedName,name; DM, transactional name precondition                                                                             |
| scene.delete     | sceneId; DM, cascades tokens and clears active scene; retains uploaded art                                                                 |

All use the existing command/revision/receipt transaction and current filtered snapshots, never privileged actor-history deltas. Wrong sheet version returns409/STALE_ACTOR; wrong original scene name returns409/STALE_SCENE. No rejected write increments revision or creates a receipt. Reload is explicit. Linked shared tokens move for DM/current actor owners only; observers never move, and token.assign on a link is rejected. Member revocation cascades grants. Queued token deltas reproject actorId and control after every awaited send. Uncorrelated protocol errors reject the one in-flight command immediately instead of leaving a confirmation timeout.

Limits:16 actors/campaign,32 grants/actor,8 text properties(names40/value120), biography/private notes1000 each, actor names80; HP integer0..1000000/max>=1/current<=max. Outbound512KiB fits bounded Unicode sheets; input16KiB/deadlines unchanged. Actor/ACL/link/scene operations use fresh snapshots; snapshots now include actors and revocation clears that cache.

## Build0.0.5 manual fog

Scene DTOs include `fog:{enabled,columns,rows,revealed}`. Grid dimensions are ceil(width/gridSize), ceil(height/gridSize), each <=256; revealed is row-major LSB-first packed bytes in lowercase hex, exactly ceil(columns*rows/8)*2 characters, <=16384. Empty storage upgrades project a zero mask with fog disabled. No earlier migration was edited.

DM-only WS commands (strict payloads, existing request/baseRevision/receipt/archive checks):

| Type          | Payload                                                   | Behavior                                                                                  |
| ------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| fog.configure | {sceneId,enabled:boolean}                                 | Toggle while preserving exploration                                                       |
| fog.paint     | {sceneId,column,row,width,height,mode:"reveal" or "hide"} | Integer cell rectangle, zero-based, positive size, entirely in grid; enabled fog required |
| fog.reset     | {sceneId,mode:"reveal" or "hide"}                         | Enable fog and reveal/cover all valid cells; zero padding bits                            |

Fog mutations publish current authorized snapshots. Players see shared tokens only when their entire footprint intersects revealed cells, and may only move into fully revealed footprints. Current hidden IDs and unknown IDs produce the same generic unavailable error. Token art uses the same projection; independently shared/granted actor portraits and active map backgrounds remain authorized. Actor sharing does not derive from token fog. Event-time `tokenWasVisible` and `sceneWasPublic` are internal only; later reveal cannot replay preparation names. Re-hide denies future reads; it cannot erase data a player already received. Full background files remain downloadable (K006).

## Build0.0.6 host dice

`dice.roll` strict payload: `{clientRollId:UUID,expression:string,visibility:"public"|"gm"|"self"|"blind"}`. Results/roller/time cannot be supplied. Existing command request ID/base revision, archive/current access, transactional state/event/receipt and replay bounds apply. No RNG is performed for a duplicate accepted request. An accepted ack includes no result, so blind rollers receive only acceptance.

`GET /api/campaigns/{id}/rolls` returns `{schemaVersion:1,rolls:Roll[]}`, the latest20 authorized rows, newest revision first. `GET /api/campaigns/{id}/rolls/{rollId}` returns `{schemaVersion:1,roll:Roll}` for any retained authorized roll; hidden/unknown/foreign IDs have the same404. Current membership/session and projection share the read transaction. Roll DTO={id,rollerId,rollerName,expression,normalizedExpression,visibility,createdAt,revision,total,dice:[{count,sides,faces,subtotal}]}. AST remains in the host database. Snapshot DTOs add rolls(default[] for older frames); dice events carry only structural snapshot markers, never private roll payloads.

public: current members; gm: current DMs or roller; self: roller only, not other DMs; blind: current DMs only. No result DTO is sent to a blind player roller. Scopes are immutable. Keep1000 rows per campaign; UI/snapshots show latest20 visible, filtering before limit. Migration0006 adds roll/audit records and independent rate timestamps, so pruning history cannot replenish rate budgets. Limit10 accepted rolls/10seconds/user/campaign, shared across sockets; short-lived timestamps are separate from history retention. The physical host/database owner is trusted.

Bounded AST: ASCII NdM/dM, constants, unary signs, +,-,*,/, grouping;120 bytes,64 nodes,12 nested levels,100 dice total, sides/constants<=1000000, finite totals/intermediate arithmetic within±1000000000; zero division rejected. Server OsRng.try_fill_bytes + rejection sampling supplies faces, failure aborts. No arbitrary eval, new runtime dependency, advanced notation or selected-recipient scope this increment.

Migration0007 separates host-generated external result IDs from caller-owned `clientRollId` creation nonces. Creation collision checks are scoped to(campaign,roller); supplying another user's private/foreign result UUID as a nonce has the same successful outcome as any unused nonce. The nonce is not returned in result DTOs. Existing0006 result bytes/IDs are preserved and adopted as the corresponding caller's old nonce. New result UUID generation uses fallible OS entropy. Refresh both host and browser bundle together after update; pre-fix rollId input is rejected rather than interpreted as the new command.

## Journal authoring (0.0.7)

Existing GET journals and GET journals/:journalId now return a positive integer `version` per page. Current DM sees all pages; players only shared pages. Hidden/foreign/unknown IDs have the same generic404. Reconnect and changes replace the authorized snapshot; persisted events contain only a snapshot marker.

WS commands use the existing requestId/baseRevision/receipt envelope:
- `journal.create`: `{journalId,title,body}`; always private, no visibility field accepted.
- `journal.update`: `{journalId,expectedVersion,title,body,visibility}`; visibility `dm` or `shared`.
- `journal.delete`: `{journalId,expectedVersion}`.

DM-only and unavailable in archived campaigns. Exact accepted retries return the old receipt. Stale page version returns `STALE_JOURNAL` even when campaign baseRevision is current; review/reload before retry. Max16 pages, trimmed title1–80 Unicode scalars, body0–1000; LF/TAB allowed in body, other controls rejected. Text is literal. No selective grants/rich text yet.

## Chat, participant selection and selected rolls (0.0.8)

- GET `/api/campaigns/:id/participants`: current members receive `{schemaVersion:1,participants:[{id,displayName,role}]}`; no usernames/credentials. Browser refreshes every5seconds; this is a member directory, not online-presence status.
- GET `/api/campaigns/:id/chat`: latest20 authorized messages in chronological revision order, filtering before limiting. GET chat/:messageId reads any retained authorized message; hidden/unknown/foreign/revoked reads return the existing generic404.
- WS `chat.send`: `{clientMessageId,body,visibility:"public"|"whisper",recipientIds:[]}`. Public requires empty recipients; whisper requires1–8 distinct other current members. Sender always reads its own message; DM has no override. Body1–1000 Unicode scalars, non-whitespace, LF/TAB allowed; other controls rejected. Host creates ID/sender/name/time/revision; forged fields are rejected. Exact accepted retries reuse receipts; reused own nonce returns MESSAGE_ID_UNAVAILABLE.10 accepted/10000milliseconds per user/campaign across sockets; CHAT_RATE_LIMITED preserves draft. Latest1000 messages retained; independent rate timestamps survive history pruning.
- Message DTO: id,senderId,senderName,body,visibility,recipientIds,createdAt,revision. Snapshot adds messages; current authorized replacement and access-clearing apply. Persisted events are content-free projection markers.
- `dice.roll` additionally accepts visibility `selected` plus recipientIds. Select1–8 distinct other current members; roller included, DM only if selected. Every old scope requires empty recipients (omission defaults[]). Roll DTO adds recipientIds (older results default[]). Current SQL projection protects both REST and live delivery.

All writes retain archive/membership checks and campaign optimistic revision/receipt semantics. Recipient membership is checked atomically; disappearing recipients never turn a private send public. Recipient rosters are immutable account IDs; current membership still gates delivery. Previously received information cannot be retracted. Input limit remains16KiB; write buffer is768KiB, covered by a combined maximum snapshot fixture.

## Generic combat (0.0.9)

GET `/api/campaigns/:id/combat` returns `{schemaVersion:1,encounter:Encounter|null}` in one authorized read transaction. Snapshots add `encounter`, replacing/clearing client cache. Players receive null unless the encounter scene is active/shared; entries derive only from visible tokens including whole-footprint fog. Unreadable linked actor means actorId:null and omitted hp/maxHp/actorVersion. Hidden current entry maps to activeCombatantId:null (UI: Awaiting GM), with no hidden placeholders/counts/IDs. Round/version/activity remain public metadata.

Encounter: id,sceneId,name,version,status(preparing/active/ended),round,activeCombatantId,combatants. Entry: id,version,tokenId,name,assetId,initiative,canEditInitiative,actorId,canEditHp and optional hp/maxHp/actorVersion. See `docs/superpowers/specs/2026-10-26-combat-contract.md` for exact fields and lifecycle.

All WS commands use the existing request/baseRevision/receipt/archive envelope:

| Command                     | Payload / authority                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| combat.create               | clientEncounterId,sceneId,name; DM; private host ID, one encounter                                                |
| combat.add                  | encounterId,expectedVersion,clientCombatantId,tokenId; DM; encounter version                                      |
| combat.remove               | combatantId,expectedVersion; DM; encounter version                                                                |
| combat.initiative           | combatantId,expectedVersion,initiative; DM/current token controller; combatant version                            |
| combat.start/next/end/clear | encounterId,expectedVersion; DM; encounter version                                                                |
| combat.hp                   | combatantId,expectedActorId,expectedActorVersion,hp; DM/current linked actor owner; updates actor HP/version only |

Wrong encounter/entry version: STALE_COMBAT; HP version uses existing STALE_ACTOR. Unknown/foreign/hidden IDs share generic404. Order is non-null initiative descending then insertion order/id; changing initiative keeps current ID anchored. Explicit current removal chooses successor and wraps round; token deletion reconciles to first survivor, or resets empty encounter to preparing. End retains entries, clear retains actor HP. Scoped nonce tombstones survive clear; all combat events are content-free snapshot markers. Structural token edits in an encounter also replace snapshots. No initiative dice automation/conditions/rules this stage.

## Owner host recovery (0.0.10)

Every route requires current authenticated host owner; players and non-owner campaign DMs receive403, unauthenticated/expired sessions401 before body handling. Existing Host/Origin/custom-header/no-store guards apply.

| Route                          | Request / response                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| GET /api/host/recovery         | schemaVersion:1,dataDirectory,prepared:null/BackupInfo,verified:null/VerificationInfo,lastRestore:null/RestoreInfo |
| POST /api/host/backups         | strict {} → schemaVersion:1,backup:BackupInfo                                                                      |
| GET /api/host/backups/:id      | current prepared attachment; unknown/replaced ID404; download holds its TempDir during streaming                   |
| POST /api/host/restores/verify | raw application/octet-stream,512MiB/60s → schemaVersion:1,verification:VerificationInfo                            |
| POST /api/host/restores        | strict {verificationId} → schemaVersion:1,restore:RestoreInfo; consumes current unexpired receipt once             |

BackupInfo={id,byteSize,sha256,summary}; VerificationInfo adds expiresAt(15min). RestoreInfo={directoryName,createdAt,summary}; directoryName is generated hearth-restored-<alphanumeric> under host data/restores. Summary={formatVersion:1,schemaVersion:10,appVersion,createdAt,counts:{users,campaigns,scenes,tokens,actors,journals,messages,rolls,encounters,assets}}. One operation at a time;429 RECOVERY_BUSY. Generic422 INVALID_BACKUP for malformed/incompatible input,413 over-size,408 upload deadline,404 stale/missing verification. Storage errors remain generic500.

The owner export includes all private content/accounts, while normal APIs retain their scoped projections. Restore never accepts a target path or overwrites the running host; it resets sessions/unused invites in a generated isolated copy. Complete format/limits/startup steps: BACKUP_RECOVERY.md.

## Transient map pings (0.0.11)

Authenticated campaign members may send `{kind:"ping",schemaVersion:1,sceneId,x,y}` over the existing live socket. For a valid point on the current shared, unarchived and revealed scene, connected authorized members receive `{kind:"ping",schemaVersion:1,pingId,sceneId,senderId,x,y}`. The host rechecks scene/fog and recipient membership before each delivery. Pings have no revision, receipt, persistence or reconnect replay; invalid and rate-limited pings are dropped. A 500 ms per-connection cooldown and bounded broadcast queue apply alongside existing live-frame limits. Both browser and host must be updated together because older strict clients do not recognize this frame.


## Scene drawings (0.0.12)

The GM sends `drawing.create` with `sceneId`, `clientDrawingId`, `shape` (`line` or `rectangle`), `visibility` (`shared` or `dm`), `color` (`#` and six lowercase hex digits), and `startX`, `startY`, `endX`, `endY` scene coordinates. `drawing.undo` takes `sceneId` and removes the latest drawing. Commands participate in the existing revision/receipt protocol. Server-generated drawing IDs and role/fog-filtered scene snapshots are authoritative.

## Freehand drawings ·0.0.14/schema12

`drawing.create` retains sceneId/clientDrawingId/shape/visibility/color/startX/startY/endX/endY. For shape `freehand`, also provide `points:[{x,y},...]` with2–128 finite in-scene points. The host rounds to0.01 scene pixels, removes consecutive duplicates, requires at least one pixel of total path length, and derives stored endpoints from the normalized path. Closed paths are valid. Line/rectangle payloads retain their existing endpoint semantics and accept no nonempty points. Unknown point fields and excessive/out-of-scene geometry fail without mutation. Existing GM-only rights, revision/nonce/receipt rules,64 scene drawing cap and content-free snapshot markers apply.

Scene DTOs include points for freehand and omit empty points for legacy shapes. Shared visibility uses the stroke-expanded bounding rectangle of every point, not only endpoints. The combined maximum campaign fixture (all8 scenes ×64 strokes ×128 points plus earlier maximum content) measures2429902 bytes; outbound buffer is bounded at4MiB, input messages remain16KiB. Matching browser assets must be refreshed with the host; wire schema remains1.
