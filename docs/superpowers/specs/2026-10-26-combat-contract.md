# Generic combat contract · shared server/browser boundary

Use the existing command receipt/IMMEDIATE transaction/campaign revision/current membership/archive checks. Add migration0010 only; never edit released migrations. No dependency. One encounter per campaign, max32 combatants, tied to one existing scene. Name1–80 trimmed Unicode scalars, no controls. Host-owned encounter/combatant UUIDs; scoped client creation nonces cannot reveal private/foreign existence. Clear explicitly before preparing another encounter. Retain ended encounter until clear; actor HP is not reset by clearing.

## Exact commands

All are TokenCommand variants with strict unknown-field denial. token_id() returns the primary subject/nonce UUID for existing envelope validation.
- combat.create {clientEncounterId,sceneId,name} — DM; create status preparing, version1, round0, active null; reject existing encounter.
- combat.add {encounterId,expectedVersion,clientCombatantId,tokenId} — DM; same scene/campaign, unique token per encounter, max32. Host combatant ID, version1, initiative null; encounter version increments.
- combat.remove {combatantId,expectedVersion} — DM; expectedVersion is ENCOUNTER version. Remove; if current, choose next surviving ordered entry, wrap increments round; removing last resets preparing/round0/active null. Encounter version increments.
- combat.initiative {combatantId,expectedVersion,initiative} — DM or token's current canMove reader; expectedVersion is COMBATANT version. initiative integer[-1000,1000] or null. Increment combatant and encounter versions; active ID stays anchored despite resorting.
- combat.start {encounterId,expectedVersion} — DM, preparing with entries; status active, round1, current first.
- combat.next {encounterId,expectedVersion} — DM, active with entries; choose next, wrap increments round, cap round1e9. Current missing (e.g. direct token deletion) chooses first without wrapping.
- combat.end {encounterId,expectedVersion} — DM, active; status ended, active null, retain round/entries.
- combat.clear {encounterId,expectedVersion} — DM, any status; delete encounter/entries only, not actors/HP.
- combat.hp {combatantId,expectedActorId,expectedActorVersion,hp} — DM or current actor owner; must have visible combatant and readable linked actor; integer0..maxHP. Verify actor identity and version, update actors.hp/version atomically, do not overwrite other actor fields. No standalone combat HP storage. Actor visibility/grants remain authoritative independently of token visibility.

UUIDs on all ID fields, positive safe versions. STALE_COMBAT for encounter/combatant version mismatch; existing STALE_ACTOR (or stable documented actor version error used in actor module) for HP conflict. Unknown/foreign/currently-hidden combatant IDs equal generic404. Player cannot manage encounter or other initiatives/HP. No implicit authority from client fields.

Ordering: initiative non-null first, descending initiative, then stable insertion sortOrder, then ID. Tie order deterministic. All combat event payloads only {projection:snapshot}. Structural token/scene deletion must never produce stale secret data or500. Scene deletion cascades encounter. A token deletion cascades its combatant; reconcile missing current ID on command commit to first surviving entry (round unchanged), or preparing/round0/active null if empty; increment encounter version when reconciliation changes it. Keep actor deletion/link changes safe; projected HP reflects current linked actor.

## Exact DTOs

Encounter = {id:string,sceneId:string,name:string,version:number,status:"preparing"|"active"|"ended",round:number,activeCombatantId:string|null,combatants:Combatant[]}
Combatant = {id:string,version:number,tokenId:string,name:string,assetId:string,initiative:number|null,canEditInitiative:boolean,actorId:string|null,canEditHp:boolean,hp?:number,maxHp?:number,actorVersion?:number}

GET /api/campaigns/:id/combat -> {schemaVersion:1,encounter:Encounter|null}. Snapshot adds encounter (Zod default null for old fixtures). Parent browser stores it under ["combat",campaignId] and replaces/clears it with snapshots.

DM receives all encounter entries. Player receives null unless encounter's scene is the active shared scene. Derive visible entries from existing authorized Scene/Token projections, including whole-footprint fog filtering. Reuse already-projected scenes/actors in live snapshot to avoid duplicate projection work; REST uses one authorized read transaction. DTO name/art/tokenId only from projected token. ActorId/HP/maxHP/actorVersion only if the actor is readable; canEditHp from current actor.canEdit, canEditInitiative from token.canMove. Unreadable actor => actorId null and omit all HP/version fields. No hidden entry placeholder, count, index or IDs; filter activeCombatantId to null when unseen (UI says Awaiting GM). Public round/version/activity can still change; no cryptographic activity noninterference claim. Existing public/token art semantics remain.

Tests: real API/WS current projections/raw frames, owner/observer/foreign checks, stale combatant/encounter/actor versions, deterministic ties/rounds/removal/deletion/reconciliation, dedupe, archive/revocation, host reopen and9→10 upgrade. Extend combined maximum snapshot fixture with32 combatants and keep768KiB write bound. No Windows/LAN/current-browser/load/full restore claim.
