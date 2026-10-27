# Build 0.0.2: live sample tabletop

The user authorized the next planned stage and requests a quick cumulative overview after every update. Keep the browser-only product direction and the working Rust/React foundation.

T008 becomes real authenticated WebSocket synchronization, proven by assigning and moving the already seeded sample tokens (a bounded part of T009–T011). The DM can assign one controlling player, move any token and share/conceal a token. Players move only assigned shared tokens. No arbitrary media import, actor authoring, dice/chat/combat or fog feature is claimed.

Use `hearth.v1`, typed hello/command/snapshot/event/ack/error/closing frames and strict runtime schemas. Commands require UUID request IDs and current campaign base revision. SQLite IMMEDIATE transactions check current session/membership/ownership, dedupe accepted commands, update revision, record event/receipt and commit before broadcast/ack. Reused request IDs with different bodies fail. Coordinates are finite and inside scene bounds. Controllers must be campaign players.

Each connection receives a freshly authorized consistent snapshot. Ordered small token events follow. Event notifications contain no private data; outgoing projections apply current permission plus event visibility. Re-hiding evicts previously visible tokens. Unauthorized hidden actions advance only an opaque campaign cursor. Keep 256 recent events for live catchup; lag/gaps and reconnects fall back to a fresh projection. Do not replay historical privileged snapshots. Explicitly defer replay optimization rather than weaken revocation.

Bound frame size, write buffer, per-connection commands and global/per-user connection counts. Recheck session/membership on activity and a one-second heartbeat; revocation/logout notify active subscriptions, which clear protected browser state and close. Clean server shutdown closes clients. Reconnect uses capped exponential delay, freezes mutations and resends only identical pending requests after a fresh snapshot; idempotency prevents duplicate actions.

The renderer stays mounted across token updates, preserving local camera and only adjusting affected sprites. Dragging is a local preview until server confirmation; keyboard/numeric alternatives and actionable errors are provided. DM-only controls are backed by server checks.

Before schema 0002, use SQLite `VACUUM INTO` to snapshot the existing database, run integrity/FK checks and record a SHA-256 checksum. Abort migration if backup verification fails. Test a genuine version-1 database, data preservation and reopen without repeated backups.

Acceptance includes real TCP WebSockets and DM/Alice/Bob browsers, unauthorized movement, duplicate/colliding IDs, concurrent stale commands, no secret fields/coordinates/art, re-hide/reconnect/revocation/logout/expiry, migration/restart durability, malformed protocol and persistent camera state. Update all current guides and add BUILD_OVERVIEW; no P0 release claim.
