# Generic actors and scene management ·0.0.4

Recover the prior actor-stage design after a workspace reset. Continue browser-only Rust/Axum + React/Pixi under the master plan's autonomous staged contract. Final users must run a packaged headless host without Node/pnpm/Rust/Visual Studio/database installs; that distribution is still pending.

Actors: name, Character/NPC kind, portrait, biography, HP/maxHP, eight custom text properties and DM-only notes. Private by default; shared actors are member-readable. Explicit observer grants read private sheets; owner grants read/edit ordinary fields and control linked tokens. DM alone manages portrait/private notes/visibility/grants/deletion. Player DTOs never include DM notes/grant rosters; hidden/unknown/foreign reads are identical404. Portrait access follows readable actor references. Per-actor version/expectedVersion rejects stale edits without blocking forms after unrelated movement.

Migration0004 adds actors, actor_ownership with membership/actor composite foreign keys, and nullable tokens.actor_id (ON DELETE SET NULL). Linking clears standalone controller; linked tokens move only for DM/current owners. Unreadable actor IDs project null in snapshots and queued token deltas. Token art/name remain independent. Actor/ACL/link changes use fresh current snapshots through the existing atomic command/revision/event/receipt path.

Bounds:16 actors/campaign,32 grants/actor,8 properties (name40/value120), actor name80, biography/private notes1000 each, HP integers0..1000000/max>=1/current<=max. Outbound512KiB/inbound16KiB, existing deadlines. Verify maximum Unicode over TCP and persisted reopen. Keep existing migrations unchanged and pre-upgrade backup checks.

Scene rename uses expectedName compared transactionally; stale dialogs require explicit latest-name reload. Delete scene requires confirmation, clears active players and cascades tokens, preserving assets. Fix K012 by guarding cancelled/unmounted scene completion. Native HTML emoji maxLength mismatch was reviewed as Minor and remains K013.

A fresh review of the lost implementation already identified concurrent rename as the sole Important finding; recover its fix and rerun meaningful tests. No second review dispatch. Do not claim the lost test results verify restored files. Preserve private source, all179 IDs, and source checkpoint before long tests.
