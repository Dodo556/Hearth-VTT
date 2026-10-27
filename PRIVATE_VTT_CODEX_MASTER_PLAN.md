# PROJECT HEARTH — CODEX MASTER BUILD PLAN

**Document type:** executable product specification, engineering architecture, ordered implementation backlog, quality gate, and long-running instructions for OpenAI Codex.  
**Revision:** 1.1 — 2026-10-22 (browser-only product direction)

**Working name:** **Hearth VTT** (temporary; renameable without changing the design).  
**Product:** private, locally controlled, self-hosted virtual tabletop for tabletop roleplaying and other tabletop games.  
**Primary host:** one Dungeon Master / Game Master (DM/GM), running the authoritative host on their computer.  
**Clients:** the DM and every player use ordinary modern web browsers over LAN or a securely configured internet connection.

**Primary platform:** a self-hosted web app with a headless DM-controlled server; browser-only DM and player interfaces across Windows, macOS and Linux. No native desktop application.

**Primary games:** D&D-style fantasy TTRPGs with an extensible, game-system-agnostic core.  
**Reference products:** Roll20, Foundry Virtual Tabletop v14, Owlbear Rodeo, Fantasy Grounds, and tabletop-oriented experiences such as TaleSpire; references are for capabilities, not copied code, trademarks, UI assets, game content, or proprietary formats.

> **Codex: This is an implementation instruction, not a request for another plan. Inspect the repository, create/maintain the specified project files, implement code, run tests, repair failures, and keep progressing through the phases.** Never mark a feature complete merely because a button, placeholder, mock response, or interface exists. A completed feature must function with an actual DM host, at least two independently authenticated players, persisted state, and appropriate authorization checks wherever multiplayer applies.

> **Current platform requirement:** The user explicitly chose a browser-only product on 2026-10-22. Both DM and players use the web app. The DM runs a headless web server; desktop-shell/native-app work is cancelled. This correction supersedes the original desktop-host proposal. Preserve all gameplay requirements and feature IDs. See `docs/ADR/0002-browser-only-product.md`.

---

## 0. INSTRUCTIONS FOR CODEX: HOW TO EXECUTE THIS DOCUMENT

### 0.1 Operating contract

1. **Start by inspecting the repository** and its `README`, `AGENTS.md`, files, toolchain, tests and scripts. Preserve valid existing work; do not arbitrarily restart a project that already exists.
2. If the repository is empty, build the specified monorepo, add tooling, initialize development scripts, and ship the first runnable vertical slice immediately.
3. Follow the ordered phases in §19. Treat §11 (feature inventory) as the **full product-scope backlog**; treat the phase gates as the **order of implementation**. No single Codex pass is expected to finish years of mature VTT functionality.
4. Before each sizable implementation, inspect the relevant code, identify dependencies, then implement a cohesive end-to-end feature with tests. Do not just write tickets or revise this plan instead of coding.
5. **When a session ends**, persist progress in `docs/PROGRESS.md`, `docs/FEATURE_MATRIX.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, and `docs/NEXT_TASKS.md`. The next Codex session must be able to continue without re-planning from scratch.
6. Work autonomously on reversible engineering decisions. Ask the human only for truly blocking secrets, legal rights to proprietary game content, or irreversible choices. If a nonblocking requirement is underspecified, choose a sensible default, write it in `docs/DECISIONS.md`, and proceed.
7. Install packages only from legitimate public package registries; pin versions with lockfiles and perform basic license/security checks. Prefer maintained, well-reviewed packages. Do not pull or reproduce proprietary Foundry/Roll20 code.
8. Implement accessible UI, error states, empty states, keyboard support, real persistence, and tests as normal work, not as a final polish phase.
9. Run relevant checks before saying a task is done. Report **what works, what is incomplete, exact commands run, failing checks, changed files, and what comes next**. Do not claim tests ran when they did not.
10. If the environment cannot launch a GUI/browser/installer, still build the software and automated tests; identify which manual verification remains necessary. Never claim unperformed live multi-user testing succeeded.
11. Do not silently substitute a third-party VTT engine, SaaS wrapper, subscription API, or hosted service for this private product. Allowed libraries may supply rendering, utilities, accessibility, video, audio, or networking.
12. Keep the project **self-hostable without paid accounts**, with optional integrations explicitly labeled as optional and privacy-reviewed. No telemetry, analytics SDKs, or AI calls by default.
13. If context or budget runs short: finish the smallest coherent slice, make a commit if the environment permits, update the progress files, and give the next unambiguous implementation action. Do not leave a half-rewritten repository with failing tests without documenting recovery.
14. At the beginning of any future Codex session, read this file plus the progress files and implement the top unblocked item in `docs/NEXT_TASKS.md`. Do not ask the user to paste this plan again.

### 0.2 Definition of "feature complete"

A checkbox can become `[x]` only after these criteria hold where applicable:
- UI can actually perform the action with real data; no fake backend or mock-only feature.
- User permissions are enforced **on the server**, not only by hiding controls.
- Changes are saved, survive restart, and sync to other authorized clients.
- Loading, failure, disconnected, empty, and invalid-input cases behave sensibly.
- Unit/integration/E2E tests cover the main path and meaningful edge cases.
- Tests include a player attempting to access or alter DM-only content.
- Feature has a short description in relevant user/developer documentation.
- An automated/manual acceptance scenario is recorded and reproducible.

Feature states: `NOT_STARTED`, `SCAFFOLDED`, `IN_PROGRESS`, `FUNCTIONAL`, `VERIFIED`, `DEFERRED`, `BLOCKED`. **Only `VERIFIED` means complete.** Keep a change-log entry for every transition to `VERIFIED`.

### 0.3 Prioritization and honest scope

**Non-negotiable:** a polished, reliable game playable tonight beats a sprawling but broken clone. However, **do not delete advanced feature requirements** just because they are hard. Build a stable foundation first, then develop the deep feature inventory. Comprehensive _core_ feature parity is the product goal, not a guarantee to duplicate every proprietary asset, official ruleset, marketplace item, or thousands of third-party extensions ever made for competing systems. Third-party module ecosystems cannot be reproduced automatically; build equivalent extensibility and selectively implement capabilities.

Priority legend: **P0** = minimum usable private table, **P1** = advanced core VTT parity, **P2** = deep ecosystem/quality parity, **P3** = optional stretch/experimental. P0 is not the whole requested product; P0 is the first genuinely usable version.

---

### 0.4 Permanent policy — one continuously evolving Hearth

The owner's 2026-10-27 policy in `docs/CONTINUOUS_DEVELOPMENT.md` is binding. Maintain one authoritative codebase and primary release line. Debug/optimized builds, previews, branches and isolated tests are temporary engineering mechanisms for this same application, not separate development/playable editions. Keep the original feature inventory, architecture, phase order, versioning and full long-term roadmap.

Every completed iteration integrates and builds the complete application, checks impacted prior functionality plus applicable synchronization/authorization/persistence, and fixes regressions before promotion. Preserve unfinished work as an explicitly incomplete checkpoint or safely isolated code; do not expose broken controls or label a failed/unverified candidate playable. Once the Phase 1 playable gate passes, preserve that baseline in every promoted update while continuing later phases on the same application.

Real campaigns remain separate from test roots. Preserve migrations, test older-data upgrades and full backup/restore, validate before replacing a working installation, and roll back only with a compatible application/web/data/artwork/configuration pair. Database pre-migration snapshots do not replace complete artwork backups. An older executable is not assumed compatible with a newer database. Current release evidence and blockers belong in `docs/RELEASE_VALIDATION.md`.

---

## 1. PRODUCT VISION AND NON-NEGOTIABLE OUTCOMES

Create a **beautiful, performant, private, moddable, system-neutral VTT** with the richness associated with Foundry and Roll20 but much easier for a nontechnical DM to host and operate. A DM can create a campaign, design and preload scenes, invite specific players, run live sessions, manipulate tokens, roll dice, conduct combat, control visibility, play music, distribute handouts, manage characters, and store everything locally. Every client sees only authorized information.

The core experience must support:
- **One actual DM/GM host**, authoritative for data, rules, permissions and synchronization; **1–12 players target** initially, extensible beyond 12.
- **No signup on a public service.** DM creates local campaign accounts/invites. Browser-only join for players; optional guest identities with an invite code and DM approval.
- **Private by default**, no campaign data uploaded to a vendor. Data stored in local DM-controlled directories; optional encrypted export/backup.
- **Offline DM preparation** even with no internet. LAN multiplayer without external services. Remote play via secure options when configured.
- **System neutral:** freeform generic tabletop first; D&D 5e-family reference system next; later additional rulesets via manifests/plug-ins.
- **No required subscription**, license purchases, proprietary content bundles, cloud databases or external authentication.
- **True DM/Player divergence**: hidden maps, unrevealed terrain, concealed NPCs, private rolls, unpublished notes, unpublished monsters, future encounters, and secret handouts never reach unauthorized clients.
- **User-friendly, professional UI** optimized for desktop at 1920×1080 and 1440×900, reasonable player tablet support, plus accessible low-motion mode. Crisp canvas and minimal chrome; avoid direct replication of competitor UI.
- **Non-destructive workflows**: undo/redo of authored changes, revision history where sensible, automatic saving, manual restore points, campaign backups, and content portability.
- **Secure, practical hosting**: LAN first, deliberate external exposure, firewall guidance, clear warnings when HTTPS, TURN, or port forwarding is needed.

### Explicit boundary conditions

- **DM host is a machine role AND a game role in the default install.** If the host exits, the session is unavailable. No fake claim of always-on access. Optional later headless deployment keeps worlds online but must still designate a campaign DM.
- **DM can see player information;** this is not end-to-end encryption from the DM. Network encryption and local data protection are separate guarantees.
- **No built-in copyrighted D&D adventure books, monster art, premium maps, official trademarks, external compendiums, or marketplace purchases.** Only original/openly licensed assets and material the DM owns and explicitly imports. Keep license attribution.
- **Interoperability is best-effort and lawful**, using documented/exported data with permission. Do not bypass encryption/DRM, scrape paid content, or promise universal import of proprietary module formats.
- **No automatic AI-generated art, narration, voice, NPC or rules adjudication required** for the base application. Optional future integrations must be opt-in and may be local-only.

---

## 2. PERSONAS AND CRITICAL USER JOURNEYS

### The host/DM

- Starts the hosting web server, opens the DM dashboard in a browser, creates a campaign, chooses generic tabletop or a game system, configures storage and starts a session. Players join using a URL in their own browsers.
- Sees a **Host Dashboard** (network status, local address, remote-link instructions, connected users, data/backup status, session state, LAN vs internet security state).
- Generates time-limited, revocable invite codes or URLs; can approve/deny/revoke players and permanently assign their characters.
- Builds a multi-scene adventure using assets, tokens, folders, journal entries, notes, walls, doors, lights, sounds, regions, and optional levels.
- Starts a session, chooses active scene, controls the party's view, reveals secrets selectively, and opens DM-only previews.
- Runs combat with initiatives, encounter participants, HP/status, effects, attacks/saves, timers and manual override. Can always override automation with visible audited DM action.
- Moves windows/panels and optionally pops out actor sheets, journals or combat tracker on an extra monitor.
- Can disconnect/restart and safely recover without losing recent committed actions. Has a local export and restore workflow.

### The player

- Opens a secure URL, uses invitation/join code, chooses a display name (subject to DM policy), and enters the campaign with no install.
- Views only the scene, tokens and content that role/vision allow. Controls assigned character/token, rolls dice, targets enemies, measures, chats, reads shared journals and interacts with allowed doors/items.
- Owns a character sheet, inventory, spell slots/resources, notes, portraits, journals and optionally dice color/settings.
- Receives visual feedback when a requested movement, roll or inventory action is waiting/denied.
- Reconnects automatically with correct state after a network interruption.

### Live-session minimum demonstration

**One DM and two distinct players** can connect; DM loads a battlemap, assigns Player A and B tokens, reveals part of it, DM privately places a monster outside player vision, players move their own tokens and see each other's movement, all users roll shared and private dice, DM starts initiative and advances turns, one player loses connection and reconnects, and every authorized state change survives host restart. A player cannot retrieve a secret monster name/image, unrevealed rooms, private rolls, or DM notes through direct API requests.

---

## 3. TECHNICAL ARCHITECTURE — DEFAULT IMPLEMENTATION

Use a **local-first authoritative client/server web architecture**. The DM runs one headless Rust web server and uses the same browser-based canvas application as players, with server-authorized role-specific controls. All product UI is in the browser. The server remains independent of the DM tab. No desktop shell, tray UI or Windows/macOS native app is required or planned.

| Layer                   | Default                                                                                         | Reason / constraints                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Hosting service         | Rust/Axum headless web server; DM opens the browser dashboard                                   | One server, browser-only DM/player UI; simple startup, status and safe shutdown                |
| Web app                 | React + TypeScript (strict), Vite, accessible component primitives                              | Reusable host/player UI, fast iteration; do not tie business logic to React                    |
| Canvas                  | PixiJS (WebGL/WebGPU when stable), typed scene graph, DOM overlays                              | Hardware-accelerated 2D map rendering; optimize rather than re-rendering every token via React |
| UI state                | TanStack Query for API cache + lightweight local store (e.g. Zustand)                           | Keep server state, ephemeral collaboration state, and local view state separate                |
| Backend                 | Rust stable, Axum, Tokio, Serde, tracing                                                        | Authoritative command validation, WebSockets, HTTP, asset access, embedded hosting             |
| Database                | SQLite in WAL mode with SQLx and schema migrations                                              | Single-host low-administration persistence; transactions + backup support                      |
| Assets                  | Local filesystem content-addressed blobs + SQL metadata                                         | Deduplication, safe paths, thumbnails, video previews, quotas                                  |
| Wire                    | Versioned JSON (initially) over WebSockets + REST                                               | Easy protocol debugging and deterministic tests; compression/binary later                      |
| A/V                     | Browser WebRTC for optional voice/video, signaling via host; optional self-host TURN            | Never require a commercial video vendor                                                        |
| Rules engine            | System-neutral typed document models, pure deterministic formulas/validated actions             | Reuse core across D&D and custom games                                                         |
| Plug-in runtime (later) | Capability-limited WASM server plug-ins, declarative manifests; sandboxed iframe for plug-in UI | Isolation, explicit privileges, no unchecked remote arbitrary code                             |
| Testing                 | Vitest, Testing Library, Playwright, `cargo test`, Rust integration tests, property tests       | Real multi-client coverage from day one                                                        |
| Packaging               | pnpm + Cargo source workspace; simple server bundle/container and bundled web assets            | Reproducible self-hosted server release; no desktop shell or native app installer              |

These are strong defaults, not permission to gratuitously rebuild them. If repository constraints compel a deviation, document its tradeoffs and preserve the essential properties (self-hosted, strict typing, server authority, performance, safe packaging, reasonable portability).

### Repository layout

```text
/
  AGENTS.md
  PRIVATE_VTT_CODEX_MASTER_PLAN.md             # copy this file into the repository
  README.md
  LICENSE                                       # choose appropriate license with owner input if publishing
  package.json / pnpm-workspace.yaml / pnpm-lock.yaml
  Cargo.toml / Cargo.lock
  apps/
    web/                                       # React, Pixi, player + DM web app
  crates/
    server/                                    # Axum endpoints, WS, permissions, orchestration
    domain/                                    # schemas, rules, commands, ACL, events
    storage/                                   # SQLite migrations, transaction/repositories
    media/                                     # validation, files, thumbnails
    rules/                                     # dice, game-neutral actions, formulas
    plugin-runtime/                           # later WASM policy/runtime
  packages/
    protocol/                                  # TS generated/shared protocol definitions
    ui/                                        # design system and reusable primitives
    system-sdk/                                # ruleset + module SDK later
    content-schema/                           # common exports/validators later
  content/
    generic-system/
    fantasy-srd/                               # only licensed rules/assets + attribution
    examples/                                  # original, small demo campaign
  tests/
    e2e/
    security/
    fixtures/
    performance/
  docs/
    ARCHITECTURE.md
    API.md
    HOSTING.md
    SECURITY.md
    DATA_MODEL.md
    CONTENT_LICENSING.md
    FEATURE_MATRIX.md
    PROGRESS.md
    DECISIONS.md
    NEXT_TASKS.md
    KNOWN_ISSUES.md
    USER_GUIDE.md
    DM_GUIDE.md
    BACKUP_RECOVERY.md
    RELEASE.md
    ADR/
  scripts/
    dev.ps1, dev.sh, test.ps1, test.sh
    backup-verify.*
  .github/workflows/ci.yml
```

### Key separations

- Keep **world-domain logic** out of canvas rendering and React components.
- Separate **authoritative persisted campaign state**, **ephemeral presence/cursors**, and **player-local settings**.
- Keep **scene document geometry** independent from its drawing order/rendering. Use stable IDs, scene-relative world coordinates, explicit schema versions.
- Back-end validates every action and calculates effective ownership/visibility. Browser-originated state is never trusted.
- Host must decide what to serialize to each client; the client must never receive a full world and rely on CSS/hiding for secrecy.
- Prefer async, bounded queues, nonblocking rendering, upload limits and worker threads for CPU-heavy media/vision preprocessing.
- Architect camera/vision/lighting independently from game rules (sight range formulas are supplied by rulesets, not embedded in the renderer).

---

## 4. MULTIPLAYER CONTRACT, SYNC AND FAILURE RECOVERY

### 4.1 Server-authoritative protocol

WebSocket establishes authenticated subscription to a campaign/scene. Server sends a filtered initial snapshot followed by ordered versioned events. Clients submit **commands**; they may render optimistic previews but cannot commit local truth. All updates pass through command validation, atomic state mutation, persistence, authorization and view-specific event projection.

```json
{
  "kind": "command",
  "schemaVersion": 1,
  "requestId": "uuid",
  "campaignId": "uuid",
  "sceneId": "uuid",
  "baseRevision": 1284,
  "type": "token.move",
  "payload": { "tokenId": "uuid", "x": 13.25, "y": 7.5, "elevation": 0 }
}
```

```json
{
  "kind": "event",
  "schemaVersion": 1,
  "eventId": "uuid",
  "revision": 1285,
  "type": "token.moved",
  "payload": { "tokenId": "uuid", "x": 13.25, "y": 7.5, "elevation": 0 },
  "serverTime": "2026-10-22T10:00:00Z"
}
```

The example is illustrative. Final schema must include typed errors, ack/nack, server-issued session IDs, actor user IDs, server timestamps, event visibility targets, correlation IDs, reconnect cursors, and negotiated protocol version. No arbitrary client-supplied event type should bypass the command handlers.

### 4.2 Concrete sync rules

- 1 campaign = one authoritative event revision sequence (or clearly documented per-aggregate ordering with atomic causal dependencies). Each command carries a unique `requestId` for deduplication. DB transaction commits before ack/broadcast.
- Snapshot-plus-delta sync and replay since revision; on gap, stale cursor or schema mismatch, resync with a **new filtered** snapshot. Do not replay a privileged event to a user whose permissions changed.
- **Disconnect/reconnect:** exponential backoff, session reauthentication, graceful stale state banner, resubscribe with last received revision, server-authoritative reconciliation.
- **Conflicts:** authoritative order for tokens/HP/combat; optimistic concurrency/field revisions for character sheets/journals. Expose conflict UI rather than silently losing text.
- **Ephemeral:** cursors, measurement previews, drag ghosts, pings, audio meters and selection presence may use throttled WS channels with no DB writes.
- **Rate limiting:** token updates, pointer movement, chat, dice commands, password attempts, invite redemption and media transfers; avoid DoS through rapid client events.
- **Visibility changes are revocations:** when a token/handout/region becomes hidden or a user's access is removed, emit revocation and evict sensitive cached data. On reconnection perform fresh projection from current permissions. No unauthorized data in devtools or preloaded assets.
- **Ordering:** typed event handling plus schema migration; never apply a patch against an unknown base without resync.
- **Host shutdown:** wait for pending transactions and flush; tell connected players session is closing; provide crash recovery via database journaling/transactions.
- **Shared DM state vs player state:** DM camera and canvas tool selection need not force player views unless DM explicitly uses `pullPlayersToView` / scene activate / focus reveal.

### 4.3 Realtime quality targets (measured, not fictional guarantees)

- 1 DM + 8 players baseline under controlled LAN test; stress target 12 players.
- Smooth interactions at ~60 FPS typical 1080p scene on ordinary modern gaming hardware, degrade gracefully toward 30 FPS for very large maps or battery-constrained devices.
- Target server-side p95 command validation/commit latency under 60 ms for ordinary scene events in a controlled test; record the real measured results and explain hardware/network conditions.
- Render / manipulate ~300 tokens, ~500 simple wall segments, ~100 static drawings without severe jank on the reference test computer; benchmark complex shadowcasting separately.
- Hard limits and safe fallbacks for extreme assets/scenes; never freeze UI during huge image decoding. Tiles/chunking for large maps.
- Bandwidth-aware asset resizing/compression and lazy loading. No full game state retransmission on every movement.

---

## 5. IDENTITY, ROLES, AUTHORIZATION AND PRIVACY

### 5.1 Roles

- **Host/Owner DM:** owns machine and campaign, can administer identities, storage, backup, source assets, roles, invitations and every world operation.
- **Co-GM (P1 optional):** delegated DM-style game permissions; cannot necessarily modify host filesystem or owner/security settings.
- **Assistant DM (P1):** configurable scene/content/combat management and limited secrets.
- **Player:** access to assigned characters, visible scenes, handouts and permitted commands.
- **Spectator/stream view (P1):** customized safe read-only projection; no GM content; optional stream-safe overlays.
- **Temporarily invited guest:** restricted campaign membership with expiry, usually inherits Player scope after approval.

Permissions should be **capability/ACL-based**, not a single `isAdmin` flag: `campaign:manage`, `scene:edit`, `scene:activate`, `token:move`, `token:inspect`, `actor:read`, `actor:edit`, `journal:share`, `dice:whisper`, `door:interact`, `asset:download`, `module:configure`, etc., with explicit inheritance/ownership and denial precedence. Character/token permission need not equal campaign permissions.

### 5.2 Security rules that MUST be tested

- DM-only content is filtered **before serialization**, including nested actor stats, journals, token names, image IDs, roll metadata, map pin tooltip text, combatants, and audit logs.
- Protect media routes: asset identifiers are meaningless without authorization; reject direct asset URLs for hidden art, map thumbnails and handouts. Do not expose filesystem directories via static wildcard routes.
- Protect **invisible tokens and fog**: obscuring a secret token on the canvas is not sufficient if the client receives its name, coordinates or associated image URL.
- Protect whisper/private/blind dice results. Clearly distinguish **public**, **GM+roller**, **GM-only/blind**, **selected participants**, and **self-only** scopes. The roller of a blind roll must not receive its secret result.
- Use strong password hashing (Argon2id or maintained equivalent), CSRF defenses when using cookie-auth browser requests, secure HttpOnly/SameSite cookies, origin checks for WebSocket, short-lived session tickets, rate limiting, bounded token lifetimes and server-side revocation.
- HTTPS/WSS mandatory for **internet-facing** installations; HTTP explicitly accepted only on local/LAN trusted networks with warning, unless a secure tunnel terminates TLS correctly. Do not hardcode a single TLS topology.
- Uploaded files: allowlists, streaming size limits, content sniffing, antivirus-compatible workflow, no arbitrary path traversal, no SVG scripts/HTML execution, no zip bombs, safe archive import, no executable uploads, safe image decoding.
- Sanitize all rich text, journal links, chat markdown and user-uploaded text; safe embeds or no embeds. Restrictive CSP; never allow cross-site script execution from content packs.
- Plugins/macros cannot read the host machine's arbitrary files, DB, credentials, or secrets. No remote arbitrary JavaScript execution on the Rust host.
- Secure backups/exports against zip-slip and untrusted imports; schema migrations run against a verified, snapshotted data store.
- Test cross-campaign isolation, revoked users, token assignment bypass, forged WS messages, privilege escalation, replay attacks and concurrent writes.
- Avoid analytics, third-party fonts/scripts and CDNs at runtime by default. Bundle fonts and static assets locally if their licenses permit.

### 5.3 Logging

Structured application logs without passwords, invite secrets, access tokens, raw chats or user-owned art URLs. Maintain a local optional **DM audit trail** for important changes (who deleted a scene, changed HP, revealed a secret, granted role, kicked user); its projection must respect permissions. Offer straightforward log retention controls.

---

## 6. HOSTING, DISCOVERY AND NETWORK SETUP

### 6.1 Supported hosting modes

| Mode                                     | Target                         | How it works                                                                                    | Security/limitations                                                                                   |
| ---------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **LAN (P0)**                             | Same network                   | Rust web server listens on chosen LAN interface, local URL displayed, OS firewall instruction   | Doesn't provide internet reachability                                                                  |
| **Remote with trusted private VPN (P1)** | Friends in different locations | Optional documented Tailscale/Headscale/WireGuard mesh; players access host's VPN address       | Some VPN services require accounts; Headscale/self-host options are optional, not bundled requirements |
| **Remote direct (P1)**                   | Public internet                | Public IP/DDNS, manual router TCP port forwarding, HTTPS using host-supported TLS/reverse proxy | CGNAT may prevent incoming connections; never promise automatic accessibility                          |
| **Remote tunnel (P1)**                   | Restricted home internet       | Explicit, optional third-party tunnel or user-owned reverse tunnel                              | Tunnel provider can carry traffic; privacy/trust disclosures                                           |
| **Headless host (P2)**                   | Owner-controlled server        | Docker/system service with same authoritative Rust backend                                      | Host role designated logically; user must manage server uptime                                         |

Implement a **Network Diagnostics wizard**: loopback readiness, LAN address, selected bind interface/port, local reachability check, user-facing firewall hints, optional external connectivity test (only on user request), TLS certificate status, reverse proxy websocket check, UPnP explicitly opt-in or unsupported, and correct CGNAT troubleshooting. Do not automatically punch open router/firewall ports without clear user consent. Offer copyable _safe_ invite instructions.

### 6.2 Host UX

- `Start Host` / `Stop Host` / `Host Settings` / `Connected Players` / `Backups` / `Network Test`.
- Port configurable, reject collision with helpful error; support portable settings and correct file ownership.
- One-click local join; remote URL only when user configures it; never advertise an unreachable remote link as guaranteed.
- The headless server keeps running when the DM browser is unfocused or closed. The browser dashboard shows session/player status and warns before an intentional server/session stop; no tray interface is needed.
- Both DM and players use a compatible browser for all interaction. Only the host runs a server; players install no client. Include secure-context and microphone/camera guidance when A/V is enabled.
- Server distribution must not advise disabling OS security. Provide a simple supported start workflow, clear browser setup, safe data directories and upgrade instructions; no desktop app installer workflow.

---

## 7. DOMAIN MODEL / STORAGE CONTRACT

Provide SQL migrations and typed Rust/TS interfaces for the following **first-class IDs** (UUID or appropriate stable opaque identifiers). Track `created_at`, `updated_at`, `schema_version`, creator and relevant permissions; avoid one giant unvalidated JSON blob for everything. JSON columns may hold system-specific fields validated by versioned schemas.

**Core hierarchy:** `HostProfile` → `Campaign` → `World/Session` → `Scene` → `Level` → `Placeable` (tokens, tiles, drawings, walls, doors, lights, sounds, templates, notes, regions, pins, effects). Campaign owns player memberships, settings, systems, calendars and content libraries.

**Identity:** `User`, `Membership`, `RoleGrant`, `Invite`, `DeviceSession`, `ActorOwnership`, `AuditEvent`.

**Documents:** `Actor` (character/NPC/creature/vehicle/party/container), `ActorPrototypeToken`, `TokenInstance` (linked/unlinked actor, optional overrides), `Item`, `ItemInstance`, `InventoryContainer`, `Resource`, `Feature`, `Condition`, `ActiveEffect`, `Ability`, `Spell`, `Encounter`, `Combatant`, `Turn`, `Roll`, `ChatMessage`, `Target`, `Journal`, `JournalPage`, `Handout`, `Quest`, `Note`, `MapPin`, `Compendium`, `CompendiumPack`, `Folder`, `Tag`, `Link`.

**Media and interactive objects:** `Asset`, `AssetVariant`, `AssetPermission`, `Playlist`, `PlaylistEntry`, `AmbientSound`, `MusicState`, `Region`, `RegionBehavior`, `RegionShape`, `Deck`, `Card`, `Hand`, `RollTable`, `RollTableEntry`, `Macro`, `AutomationTrigger`, `AutomationAction`, `EffectAnimation`, `WeatherPreset`, `Calendar`, `TimeState`.

**Administration:** `CampaignSetting`, `SystemManifest`, `ModuleManifest`, `ModuleConfig`, `PackDependency`, `MigrationHistory`, `BackupManifest`, `Revision`, `CommandReceipt`.

### Modeling rules

- Preserve stable identity when dragging an actor from a library onto a scene; actor vs placed token data cannot be conflated.
- Explicit actor vs token permissions, linked vs unlinked token HP/status, scenes with many tokens sharing one creature prototype.
- Units of measurement are system/scene configurable (feet, meters, grid squares, freeform); world distance independent of screen pixels.
- Separate scene background/foreground/screen effects and level elevation data. Each visual object has explicit z-index, visibility, opacity, transform, and applicable level(s).
- Document references must be validated, with safe deletion behavior (`restrict`, tombstone, unlink, archive, or cascade by documented policy).
- Include **per-user/per-party fog exploration state** (possibly chunked compressed bitmask), unique per scene/level where needed.
- Set up full-text indexes for searchable user-owned content and folders; filter search by permissions before results.
- All document types have versioned serialized export forms; exports never rely on absolute local filesystem paths.
- Be clear about campaign-scoped vs global asset libraries and cross-campaign ownership/security.

### Data durability

Use transactions and FK constraints. Apply migrations in order after creating a restorable snapshot. Keep a test that imports an older fixture and proves upgrade without information loss. Provide scheduled/rolling backups when the host is running, manual backup, full export zip with checksums, selective exports, restore wizard and optional encryption with user-managed password. Verify restore by starting a second isolated test instance.

---

## 8. UI/UX DESIGN BRIEF

**Visual design:** original, modern, elegant dark-first control environment. Accent palette configurable. Dark slate/navy surfaces, restrained warm accent, clear grid/toolbar contrast, readable typefaces with **Latin Extended** characters (Slovak/Czech diacritics). Dense information without being cramped. Functional legibility and accessibility take priority over cinematic decoration.

### Major screens

1. Welcome / onboarding / first-run host setup.
2. Campaign library: create/clone/archive/import/export/delete campaigns, searchable thumbnails.
3. Host dashboard: campaign availability, local/remote URL, users, security and network status, backups.
4. Game table: full-screen map, top scene navigation, left tools, right dock/tabs, collapsible chat/combat, bottom macro/hotbar, optional timeline.
5. DM scene editor: visual multi-layer workspace with asset browser, object inspector, canvas selection, palettes, layers/levels, undo/redo, properties, batch editing.
6. Player table: focused canvas, owned character sheet, inventory/spells/actions, chat/dice, initiative, journal, limited controls.
7. Character/actor sheet: editable and system-driven with tabs, drag/drop actions, accessible numeric fields and compact/full modes.
8. Campaign compendium, assets, music, world settings, modules and content import panels.
9. Responsive player mode for tablet/small browser; mobile is a secondary but usable view, not the host's full authoring surface.

### Detailed UI standards

- Fully resizable/collapsible/dockable panels, saved layouts per user, keyboard shortcuts editor, tooltips, command palette, searchable library and context menus.
- Browser-friendly undocking/pop-outs where browser permissions permit; graceful fallback if blocked.
- Useful light theme in P1, high contrast and reduced-motion options from P0.
- Mouse wheel zoom around pointer, pinch zoom where supported, middle mouse pan, keyboard pan, configurable grid snap, multi-selection with bounding box.
- Drag/drop token/image/actor/compendium/spell to relevant scene/sheet target with validation.
- Distinguish hidden state with DM-visible styling; player preview must use **server-authorized player identity/projection** rather than merely toggling a CSS class.
- Undo/redo keyboard support for authored scene edits. Do not naively undo another user's committed combat action.
- Consistent tool icons, clear active state, undo toast, toast errors and accessible context-sensitive help.
- Real onboarding with original demo assets/maps so the app is usable immediately.
- Internationalization ready from the beginning: external strings, translation catalog. Initial English, later Slovak as a full translated locale.

---

## 9. CANVAS ENGINE AND SCENE RENDERER

### Core scene interaction

- Infinite/large-coordinate 2D workspace with bounded actual scene regions; tiled/chunked large map images and render culling.
- Multiple scene backgrounds, images and animated maps; world-grid calibration wizard, gridless / square / hex flat-top / hex pointy-top / isometric (advanced), customizable colors/opacities and physical scale.
- Layer stack: background, map tiles, below tokens, token sprites, above tokens, foreground/occlusion, DM overlay, regions/templates, walls, light/vision, sounds, drawings, effects, notes/pins and UI overlay. Flexible ordering and locked/hidden flags.
- Canvas objects: select, move, scale, rotate, crop sprite, flip, duplicate, delete, lock, group/ungroup, align, distribute, snap, order, multi-edit, prefab/template instances.
- Rich token appearance: images, animated sprites, vision halos, scale, anchor, bars, auras, ring borders, labels, status icons, elevation, prone/rotation/size, custom shapes and conditions.
- Drawing: freehand, line, polyline, curve, arrow, rectangle, ellipse, polygon, paint/fill, text, eraser, measurement, stamps, annotations; color/opacity/stroke/type/font; share/DM-only.
- Pointer tools: selection, drag ruler/path, waypoints, colored pings, party focus, targeting, radial/circular/cone/line/rectangle templates, distance ruler, grid pathfinding.
- Grid movement rules configurable by game system including diagonal counting, collision, rough terrain, flying/elevation and user-controlled speed.
- Efficient GPU sprites, texture atlases, lazy-loaded assets, resize observer, DPI support, sprite disposal, canvas lost-device handling and fallback to safe settings.

### Visibility, light and walls

- Manual fog overlay brush/polygon reveal/hide and per-user/per-party exploration persistence.
- Token line-of-sight with wall occlusion and directional/one-way walls; limited vs unlimited sight, darkvision, low-light, blindsight/tremorsense as system-supplied modes, custom vision radius/angle.
- Lights with color, brightness, cone, range, flicker/pulse, attenuation, animation and darkness sources; global scene darkness and sunlight/day/night.
- Walls: opaque, transparent-to-light, transparent-to-sight, movement-only, ethereal, one-way and combinations; configurable independent channels (movement/vision/light/sound where practical).
- Door/window portal objects: normal, secret, hidden, locked/unlocked, open/closed, permission checks, interaction sounds and collision state. Visibility and movement must update immediately on open/close.
- Explored-vs-currently-visible distinction: black unseen terrain, dim past exploration, currently visible full scene; GM may force shared fog for all players or party groups.
- **DO NOT broadcast hidden token/asset existence/coordinates to a user merely because the overlay is black.** Use secure server-side filtered scene projection; maintain sufficient host-side visibility indexing for this guarantee.
- Performance: cache visibility polygons and recalc only when relevant token/wall/light states change; offload heavy processing; no all-scene recompute on every mouse pixel.

### Multi-level support

- Multiple stacked levels/elevations in one scene, each with background/foreground, token levels, light, walls, regions, fog and sound.
- Vertical collision/visibility and camera level selection, stairs/portals/ladders/elevators, flying tokens, transparent floors/balconies, multi-level template effects, elevation-based combat distance.
- Cross-level object visibility and level editing filters; GM can view all or current, players see only physically/permissibly visible level surfaces.

---

## 10. GAME RULES STRATEGY (DO NOT HARD-CODE A SINGLE RPG)

### Two-stage system design

**Stage A: Generic tabletop system (P0).** Tokens can have configurable bars/resources, property sheets, dice, journal notes, decks, generic initiative and manual combat. This runs without any copyrighted rules or external data.

**Stage B: Fantasy d20 system (P1).** Implement a complete play-ready **SRD-only** D&D 5e-family ruleset; select a documented release such as SRD **v5.2.1** (2024-revision family) and optionally a separately labeled **SRD 5.1** (2014-era family). **Never blend rule revisions silently.** Import only CC BY 4.0 content after review, include required attribution and record source version. The SRD is not the complete official book library. Non-SRD subclasses, monsters, art, settings and other content require permission / user-supplied lawful data.

### System manifest API (later public SDK)

A game system can declare:
- Actor types, properties, typed derived attributes, containers and resources.
- Item, feat, spell, vehicle, condition, status, effect schemas.
- Formula definitions for attacks, damage, saves, skills, initiative, rest, encumbrance and progression.
- Character sheet layout declaratively (tabs/forms/actions/roll buttons).
- Encounter turn/phase order, movement and measurement rules, resource usage.
- Advancement/character-builder flows, tables and compendium packs.
- Validation rules, permissions, data migrations and automation triggers.
- Display names, translations, icons, token defaults and dice sets.

The rules engine must **evaluate validated, bounded formulas** with an AST parser — no arbitrary `eval`, scripting in formulas, or unsandboxed JS. Roll RNG comes from secure server source; record roll expression, normalized AST, dice breakdown, modifiers, visibility and server result for audit. Test operator precedence, negative modifiers, rerolls, exploding dice, adv/disadv, keep/drop, pools, success thresholds, Fate dice and percentile/d100.

### Character builder (P1/P2)

Guided step-by-step creation, optional manual mode, ability scores, species/ancestry, class/subclass where licensed, level progression, background, skills, equipment, languages, spells, prerequisites and choices. Validation, editable backtracking, source attribution, custom/homebrew overrides and import/export. Apply rule-version-specific differences correctly.

---

## 11. MASTER FEATURE INVENTORY — THE COMPREHENSIVE BACKLOG

**Use IDs below verbatim** in `docs/FEATURE_MATRIX.md` with columns `ID | Priority | Dependency | Status | Evidence | Unit Test | Integration Test | E2E Test | Notes`. Split each ID into atomic GitHub issues or local tasks as necessary. Feature groups include both direct competitor parity and private-host improvements. Requirements are cumulative, not alternatives.

### 11.A Accounts, campaigns and host administration

- [ ] **ADM-01 P0:** first-run setup, DM owner credentials and recovery instructions.
- [ ] **ADM-02 P0:** create, rename, duplicate, archive, open and permanently delete a campaign with safe confirmation.
- [ ] **ADM-03 P0:** invite code/link generation, expiration, revocation, join approval and unique player sessions.
- [ ] **ADM-04 P0:** owner DM / player role assignment, token/actor ownership and server ACL.
- [ ] **ADM-05 P0:** LAN start/stop, local URL and host status dashboard.
- [ ] **ADM-06 P0:** autosave, graceful shutdown, host restart recovery and basic export/restore.
- [ ] **ADM-07 P1:** remote networking setup, HTTPS/reverse proxy status, VPN/tunnel/manual port-forward documentation.
- [ ] **ADM-08 P1:** assistant DM / co-GM / spectator and granular role delegation.
- [ ] **ADM-09 P1:** kick, ban, mute, password reset, session invalidation, player approval, rejoin assistance.
- [ ] **ADM-10 P1:** player lobby, schedule/session notes, player activity and private safe spectator stream mode.
- [ ] **ADM-11 P1:** per-campaign quotas, asset management, cleanup, integrity checks, preview disk usage.
- [ ] **ADM-12 P2:** headless Docker/system service and optional multi-campaign server administration.
- [ ] **ADM-13 P2:** safe import/export of world settings, campaign cloning, cross-world content management.
- [ ] **ADM-14 P2:** backup schedules, retention, optional encryption, selective restore, verified checksums.
- [ ] **ADM-15 P2:** fine-grained audit history/rollbacks, migration preview, disaster recovery wizard.

### 11.B Core canvas, maps, pages and authoring tools

- [ ] **MAP-01 P0:** create/edit/select scenes, switch/activate scene, player vs DM preview.
- [ ] **MAP-02 P0:** upload/assign background maps and fit/calibrate square grid; gridless option.
- [ ] **MAP-03 P0:** pan, cursor-centric zoom, reset view, select, drag and snap tokens.
- [ ] **MAP-04 P0:** layer render ordering and hidden DM overlay; draw rectangle/line/freehand/text.
- [ ] **MAP-05 P0:** DM/player pings, basic ruler, scene notes and consistent camera navigation.
- [ ] **MAP-06 P1:** flat/point hex, diagonal measurement, advanced grid scale/units, map alignment wizard.
- [ ] **MAP-07 P1:** layered tiles and foreground, transparent and animated scene images, map cropping.
- [ ] **MAP-08 P1:** objects selection/multi-select, transform, grouping, multi-edit, inspector and layer palette.
- [ ] **MAP-09 P1:** curve, polyline, ellipse, polygon, arrows, rich text, color palettes, drawing styles.
- [ ] **MAP-10 P1:** folders, nested scene organization, scene thumbnails, preload and transition effects.
- [ ] **MAP-11 P1:** art asset browser, searchable galleries, drag/drop, favorites, tagging and reusable prefabs.
- [ ] **MAP-12 P1:** snapping settings, align/distribute, lock/unlock, elevation properties, keyboard shortcuts and undo/redo.
- [ ] **MAP-13 P1:** cone/line/circle/rect/polygon templates, attach/move/resize to token, measure affected area.
- [ ] **MAP-14 P1:** advanced drag ruler, waypoints, pathfinding, movement modes, per-turn distance tracker.
- [ ] **MAP-15 P1:** configurable map pins linked to journals/handouts, DM notes, tooltips, visibility and style.
- [ ] **MAP-16 P2:** multi-level scenes with elevation, cross-level vision, portals, stairs, ladders and floors.
- [ ] **MAP-17 P2:** advanced regions with composite geometry/holes, scene triggers, templates and behavior hooks.
- [ ] **MAP-18 P2:** scene playlists/effects, parallax, dynamic ambient/weather, camera animations and cutscenes.
- [ ] **MAP-19 P2:** isometric view helpers, alternative token shape footprints, vehicle/group token handling.
- [ ] **MAP-20 P2:** huge-scene tiling, texture atlas, lazy loading, GPU downgrade and low-bandwidth mode.
- [ ] **MAP-21 P3:** experimental optional 3D dice/3D terrain view or TaleSpire-like tabletop mode (separate from required 2D engine).

### 11.C Tokens, creatures and placement

- [ ] **TOK-01 P0:** create tokens from uploaded art or generic icons, place/move/resize/rotate/delete.
- [ ] **TOK-02 P0:** assign controlling player(s), restricted movement and scene visibility.
- [ ] **TOK-03 P0:** token labels, HP/resource bars, status indicators and basic context menu.
- [ ] **TOK-04 P1:** actor-linked prototype tokens vs independent placed instances, one-click actor open.
- [ ] **TOK-05 P1:** multiple token states/images, borders, rings, transparency, facing, elevation, vision and lighting.
- [ ] **TOK-06 P1:** token targeting, auras, conditions, temporary effects and template attachments.
- [ ] **TOK-07 P1:** player movement restrictions, collision/terrain rules, token lock, path preview and door interactions.
- [ ] **TOK-08 P1:** companion/pet/summon/mount/vehicle/multi-square creature support.
- [ ] **TOK-09 P2:** token animation, automatic statuses, per-actor lighting/vision overrides and overrides reset.
- [ ] **TOK-10 P2:** bulk import actors as tokens, encounter placements, reusable formation placements.

### 11.D Fog, dynamic lighting, walls, doors and vision

- [ ] **VIS-01 P0:** DM-operated manual fog reveal/hide with persistence and never-sent hidden content.
- [ ] **VIS-02 P1:** wall drawing/editing, collision, line of sight, efficient occlusion engine.
- [ ] **VIS-03 P1:** light sources/color/range and configurable ambient darkness/daylight.
- [ ] **VIS-04 P1:** token vision radius/angle, automatic exploration, remembered fog by player.
- [ ] **VIS-05 P1:** configurable doors/windows, locked/secret/open, role-checked interactions.
- [ ] **VIS-06 P1:** invisible/ethereal/one-way walls, separate movement/sight/light blocking.
- [ ] **VIS-07 P1:** darkvision/low-light variants, darkness and vision behavior supplied by rulesets.
- [ ] **VIS-08 P1:** shared party fog vs individual fog and manual explore reset.
- [ ] **VIS-09 P2:** directional/animated lights, advanced shadows, glare, darkness sources and sound occlusion.
- [ ] **VIS-10 P2:** multilevel lighting/vision, vertical barriers and level-specific fog.
- [ ] **VIS-11 P2:** controlled persistent visibility caches, debugging tools, visibility stress/cheat tests.

### 11.E Dice, tables, cards and randomness

- [ ] **DICE-01 P0:** `NdM+K` parser, arithmetic, grouped dice, public/private/blind rolls and history.
- [ ] **DICE-02 P0:** clickable dice tray, roll shortcuts, compact roll results in shared chat.
- [ ] **DICE-03 P1:** advantage/disadvantage, keep/drop, reroll, exploding, success pools, percentile, Fate, custom dice.
- [ ] **DICE-04 P1:** sheet roll buttons, roll templates and inline roll links, rolls with contextual modifiers.
- [ ] **DICE-05 P1:** server-recorded dice breakdown, verified authorization, optional shared/public roll proof design.
- [ ] **DICE-06 P1:** rollable tables, weighted entries, nested tables, drag-to-macro, import/export and permissions.
- [ ] **DICE-07 P1:** deck/card/hand/discard/reshuffle/deal/reveal/flip controls; private hands and hidden deck order.
- [ ] **DICE-08 P1:** clocks, coin flips, counters, poker-like chips and generic board-game pieces.
- [ ] **DICE-09 P2:** animated 3D dice on canvas with toggle and accessible reduced-motion fallback.
- [ ] **DICE-10 P2:** custom roll result cards, dice presets, reusable roll expressions, statistics/log export.

### 11.F Character/actor sheets and game entities

- [ ] **CHR-01 P0:** generic character/NPC actor with notes, portrait, editable custom properties and permissions.
- [ ] **CHR-02 P0:** players edit own actors, DM edits all; authorized stat visibility and save.
- [ ] **CHR-03 P1:** full D&D SRD 5.2.1 data model and functional player/NPC sheets.
- [ ] **CHR-04 P1:** ability scores, proficiency, skills, saves, HP, AC, movement, resources, death saves, rests.
- [ ] **CHR-05 P1:** inventory, equipment, weight/currency, containers, attunement, consumables and drag/drop.
- [ ] **CHR-06 P1:** class levels, advancement, species/background features and proficiency/source tracking.
- [ ] **CHR-07 P1:** spells, prepared/known lists, spell slots, spell attacks/DC, components, concentration.
- [ ] **CHR-08 P1:** actions, traits, items, features, custom actions, attack/damage/save automation with undo.
- [ ] **CHR-09 P1:** conditions, active effects, immunities/resistances/vulnerabilities and duration rules.
- [ ] **CHR-10 P1:** searchable compendium drag/drop to sheets, source version attribution and validation.
- [ ] **CHR-11 P1:** customizable generic sheet designer with declarative schema fields and layouts.
- [ ] **CHR-12 P2:** guided SRD-only character creator and level-up wizard, choices and prerequisites.
- [ ] **CHR-13 P2:** SRD 5.1 as separate ruleset/version with migration and clear differences.
- [ ] **CHR-14 P2:** multi-class, optional rules toggles, manual override UI with audit.
- [ ] **CHR-15 P2:** NPC statblock builder, encounter preparation and scalable monster templates.
- [ ] **CHR-16 P2:** party inventory, containers, loot distribution, merchants, shops and trade approvals.
- [ ] **CHR-17 P2:** custom system modules, advanced sheets, inline formulas and custom dice logic.
- [ ] **CHR-18 P2:** multiple languages and locale-based units, print-to-PDF/export-friendly character sheet.

### 11.G Encounter/combat automation

- [ ] **CMB-01 P0:** add/remove combatants, initiative rolls/manual entries, next turn/round, visible tracker.
- [ ] **CMB-02 P0:** DM adjusts HP, conditions, order; controlled player can view relevant state.
- [ ] **CMB-03 P1:** attack, damage, saving throw, healing, temporary HP and death save flows per ruleset.
- [ ] **CMB-04 P1:** action/bonus action/reaction/movement, resources, prepared actions, rests and spell concentration.
- [ ] **CMB-05 P1:** condition/effect duration automation, start/end turn events, concentration break checks.
- [ ] **CMB-06 P1:** combat log, step rollback by DM, manual override, visible vs secret NPC details.
- [ ] **CMB-07 P1:** multiple encounters, encounter templates, initiative groupings, turn highlights and auto-target.
- [ ] **CMB-08 P2:** opportunity attack prompts, aura and area effects, cover, terrain movement, elevation distance.
- [ ] **CMB-09 P2:** advanced rule triggers, linked rolls, concentration trees, automated effect lifecycle.
- [ ] **CMB-10 P2:** initiative variants, group initiative, phases, clocks, timers, other game-system combat loops.

### 11.H Journals, worldbuilding and collaborative content

- [ ] **JRN-01 P0:** DM/private/shared journal pages, handouts with rich text/images, per-user ACL.
- [ ] **JRN-02 P0:** folders, search, shared read-only notes and DM-controlled reveal.
- [ ] **JRN-03 P1:** rich editor with tables, links, checklists, images, embedded sanitized rolls and local history.
- [ ] **JRN-04 P1:** multiple page types (text/image/video/PDF/audio/external URL only by explicit opt-in).
- [ ] **JRN-05 P1:** map pins/links/notes to actors, quests, places, scenes and journal anchors.
- [ ] **JRN-06 P1:** quest tracker, objectives, tags, relationships, calendars, handout presentation mode.
- [ ] **JRN-07 P1:** player private notes, party-shared notes and journal collaboration/conflict handling.
- [ ] **JRN-08 P2:** world encyclopedia, NPC/locations relationship graph, chronology, timeline, hyperlinks.
- [ ] **JRN-09 P2:** rich publisher-style adventure bundles, reusable adventure imports, cross-campaign compendiums.
- [ ] **JRN-10 P2:** full-text search across permitted content, backlinks, templates and Markdown/HTML export.

### 11.I Chat, communication, presentation and A/V

- [ ] **COM-01 P0:** campaign text chat with timestamps, chat histories, system messages and roll cards.
- [ ] **COM-02 P0:** GM/private whispers with security enforced in DB and WS projections.
- [ ] **COM-03 P1:** OOC/IC chat personas, styled character messages, markdown safely sanitized, emotes.
- [ ] **COM-04 P1:** pings, presence, typing, reactions, initiative announcements and turn notifications.
- [ ] **COM-05 P1:** image/handout reveal, show-to-player, camera focus and synchronized scene presentation.
- [ ] **COM-06 P1:** optional peer/WebRTC voice with host signaling, mute/deafen/input device settings.
- [ ] **COM-07 P1:** optional peer/WebRTC video and camera privacy controls with participant indicators.
- [ ] **COM-08 P1:** reconnect/ICE failure handling, optional TURN setup, secure context diagnostics.
- [ ] **COM-09 P2:** spatial/proximity voice option, push-to-talk, A/V pop-outs and screen-sharing (user approved).
- [ ] **COM-10 P2:** player portrait tiles, stream-safe mode, speaker display, chat export and content moderation.
- [ ] **COM-11 P2:** browser notifications when permitted, personal notification preferences, unread indicators.

### 11.J Sound, music and VFX

- [ ] **AV-01 P1:** upload MP3/OGG/etc (browser-supported), play/pause/stop, volume per user and global.
- [ ] **AV-02 P1:** playlists, queues, shuffle/loop/crossfade, simultaneous ambience/music channel control.
- [ ] **AV-03 P1:** scene-bound tracks and positional/attenuated ambient audio emitters.
- [ ] **AV-04 P1:** clickable soundboard, sound triggers, opening-door/tile sounds, smooth loading.
- [ ] **AV-05 P1:** animated scene assets, particle effects, token auras and simple spell/VFX presets.
- [ ] **AV-06 P2:** weather, rain/snow/fog visual effects and sound, daylight clock-linked ambiance.
- [ ] **AV-07 P2:** animated spell templates/projectiles, screen shake, transitions and customizable FX.
- [ ] **AV-08 P2:** advanced spatial audio/levels/occlusion, mixer buses and environmental triggers.
- [ ] **AV-09 P2:** optional streaming-media integration only where technically permitted and user configured.

### 11.K Compendiums, packages, macros, automation and mods

- [ ] **EXT-01 P0:** content libraries containing reusable actors, items, scenes and journal templates.
- [ ] **EXT-02 P1:** searchable, filterable, versioned compendiums and safe pack export/import.
- [ ] **EXT-03 P1:** macro hotbar for built-in safe actions (roll, item, chat, scene, condition) and keybindings.
- [ ] **EXT-04 P1:** no-code trigger/action automation editor, event hooks, logging and undo/approval where needed.
- [ ] **EXT-05 P1:** game system registry/manifest loader, migration scripts and incompatibility warnings.
- [ ] **EXT-06 P2:** documented plug-in SDK, event APIs, typed manifest/capabilities, sandboxed runtimes.
- [ ] **EXT-07 P2:** UI module APIs with restrictive CSP/iframes, no arbitrary untrusted in-page JS.
- [ ] **EXT-08 P2:** safe install/remove/update/rollback module workflows, dependency and version management.
- [ ] **EXT-09 P2:** no-code/custom sheet editor, custom actor/item schemas and public extension examples.
- [ ] **EXT-10 P2:** compendium sharing between user-owned campaigns with explicit permissions.
- [ ] **EXT-11 P2:** hook/region behaviors: movement, enter/exit, turn start/end, contact, timers and doors.
- [ ] **EXT-12 P2:** community bundle format, provenance/license checks, export compatibility policy.
- [ ] **EXT-13 P3:** optional explicit local MCP/automation API for approved desktop assistant control with granular DM consent and audit.

### 11.L Media, imports/exports and interoperability

- [ ] **MED-01 P0:** safe upload, image thumbnails, token/portrait selection, local content store.
- [ ] **MED-02 P1:** JPEG/PNG/WebP/AVIF where supported, animated WebP/GIF, video background formats per browser capabilities.
- [ ] **MED-03 P1:** user-visible media gallery, batch upload, quotas, filename sanitation, metadata and thumbnail variants.
- [ ] **MED-04 P1:** map/actor/journal/scene/campaign exports in an openly documented stable format.
- [ ] **MED-05 P1:** upload/import original licensed compendium packs and safe generic JSON/CSV material.
- [ ] **MED-06 P1:** content source attribution and licenses, permission-aware sharing between campaign/users.
- [ ] **MED-07 P2:** image tile pyramid for giant maps, local transcoding where safe and browser-compatible.
- [ ] **MED-08 P2:** PDF reading/handouts (renderer library) with safe sandbox, extracted text search if allowed.
- [ ] **MED-09 P2:** lawful user-exported Roll20/Foundry data import **only if format access and licenses allow**; import wizards and mapping preview; no assumption proprietary packages are directly usable.
- [ ] **MED-10 P2:** integrations for external local folders/S3-compatible self-host storage (optional) with no forced cloud.
- [ ] **MED-11 P2:** generic VTT content pack exporter, import dedupe, media relinking, partial rollback.
- [ ] **MED-12 P2:** batch token ring generation, token cropping, media search and texture optimization.

### 11.M Advanced quality, accessibility and immersion

- [ ] **UX-01 P0:** keyboard navigable basic dialogs, focus traps, meaningful aria roles, legible contrasting labels.
- [ ] **UX-02 P0:** dark UI, clear context menus, action feedback, reliable loading/reconnect behavior.
- [ ] **UX-03 P1:** dockable/resizable panels, pop-out windows, layouts per user, hotkey editor.
- [ ] **UX-04 P1:** high-contrast/light themes, reduced-motion mode, zoom/dyslexia-friendly adjustments.
- [ ] **UX-05 P1:** Slovak locale including correct diacritics and localized date/unit display.
- [ ] **UX-06 P1:** player-focused tablet mode and graceful small-screen reflow.
- [ ] **UX-07 P2:** screen-reader-friendly character sheets, captions/alternative text for shared content.
- [ ] **UX-08 P2:** command palette, in-app searchable help, guided DM onboarding and tool tours.
- [ ] **UX-09 P2:** configurable visual dice themes, color palettes, themes, backgrounds and overlays.
- [ ] **UX-10 P2:** advanced DM workflow: batch edit, blueprints/prefabs, staging, presentation preview, safe feature flags.
- [ ] **UX-11 P2:** calendar/time, weather, downtime, faction/reputation, economy and campaign trackers.
- [ ] **UX-12 P3:** handheld/touch-optimized authoring if real user demand justifies it.

### 11.N Reliability, privacy, operations and packaging

- [ ] **OPS-01 P0:** deterministic build scripts, migrations, smoke tests, CI, host logs and error boundaries.
- [ ] **OPS-02 P0:** content/DB separation, autosave, basic backup/restore and player permission tests.
- [ ] **OPS-03 P1:** TLS/network diagnostic wizard, origin validation, security headers and rate limits.
- [ ] **OPS-04 P1:** API documentation, migration/version compatibility, user and DM guides.
- [ ] **OPS-05 P1:** end-to-end 3-client test suite, CI artifact captures and performance budgets.
- [ ] **OPS-06 P1:** simple self-hosted web-server distribution/startup, browser setup, safe updates and data-preserving removal.
- [ ] **OPS-07 P2:** cross-platform browser compatibility and server deployment, reproducible releases and full backup validation.
- [ ] **OPS-08 P2:** crash diagnostic export, log redaction, database integrity check, restore validation.
- [ ] **OPS-09 P2:** dependency security scanning, SCA, fuzz tests, threat model reviews and penetration suite.
- [ ] **OPS-10 P2:** load/performance regression harness, large-campaign fixture and performance profiling.
- [ ] **OPS-11 P2:** data portability, privacy overview, retention controls and complete local data wipe.

### 11.O Optional ecosystem ideas beyond direct competitors

- [ ] **OPT-01 P3:** offline-first collaborative player sheet editing with explicit sync/conflict design; impossible while only DM offline without some other always-on trusted service.
- [ ] **OPT-02 P3:** optional battlemap generator using locally supplied reusable tiles / procedural geometry.
- [ ] **OPT-03 P3:** local AI-assisted game prep/culling/notes under explicit opt-in, private by default; no online inference requirement.
- [ ] **OPT-04 P3:** portable companion app, tablet-facing in-person TV/battlemap table mode.
- [ ] **OPT-05 P3:** accessibility gamepad/stream deck shortcuts, extra-monitor GM dashboard.
- [ ] **OPT-06 P3:** multi-party campaigns, live co-GM event ownership, external collaboration integrations.

---

## 12. CORE USER STORIES WITH TESTABLE ACCEPTANCE CRITERIA

Implement the following as reproducible acceptance scripts. Tests must use a real Rust server and actual authenticated browser sessions, not a React test with a mocked API. For scenarios involving secrets, inspect the network payload **as well as** what is drawn on screen.

### US-01 — First-run campaign and invitation (P0)

**Given** a clean install with no database, **when** DM starts application, creates `The Amber Keep`, uploads a map and generates an invite, **then** the local browser shows the campaign and two independently named players can join using distinct permissions. A rejected/expired invite fails with a helpful error. The host dashboard clearly shows LAN address and does not claim public reachability without a test.

### US-02 — Scene and token sync (P0)

**Given** DM, Alice and Bob, **when** DM adds a token for each, Alice moves hers and Bob attempts to move Alice's without permission, **then** DM and both players converge to the same authorized Alice token coordinates, while Bob's unauthorized movement is rejected and persisted state is unchanged. Both players can see any intentionally public tokens.

### US-03 — Secret DM content (P0 SECURITY GATE)

**Given** a dungeon with a hidden room and secret creature, **when** DM creates a monster inside, adds a private journal and rolls a blind check, **then** Alice and Bob cannot discover monster art/name/coordinates, private text or blind roll details via UI, REST, media URL guessing, WebSocket messages, search, export, browser source, caches or direct ID requests. If DM reveals the room/creature, authorized events/assets become available. Reconcealing them revokes visibility. Repeat after reconnect and role revocation.

### US-04 — Dice confidentiality and consistency (P0)

**Given** a stable campaign, **when** players use `2d6+3`, a GM whisper, and a blind check, **then** server produces and stores valid results and each recipient receives precisely the authorized view. Modifier precedence works, invalid expressions fail safely, and client-submitted fabricated results cannot replace server results. Rolling twice with identical `requestId` returns the same prior receipt rather than making a second roll.

### US-05 — Combat roundtrip (P0)

**Given** 2 PCs and 1 NPC, **when** DM starts combat, requests initiatives, manually adjusts HP, advances round, then restarts host, **then** turn order, round, HP and all authorized chat history are restored. Players cannot silently modify NPC HP.

### US-06 — Fog and lighting (P1)

**Given** walls, doors, an unlit corridor and a token carrying a lamp, **when** the token moves/open door, **then** both collision and visible region change coherently, previously explored regions render according to fog policy, a hidden second room remains opaque and its private entities remain absent from network data. Test per-player and party-shared modes and change user permissions during an active game.

### US-07 — Character sheet-driven attack (P1)

**Given** an SRD fighter with an equipped weapon, **when** the player rolls an attack, **then** the correct ruleset-version modifiers, attack result, damage expression and roll visibility are applied. Damage to a target follows configured DM consent/automation level. A rejected action consumes no resources. Manual DM correction is visible in audit history and reversible via supported workflow.

### US-08 — Persistence and recovery (P0/P1)

**Given** an active session with 100+ changes, **when** host restarts, **then** all acknowledged data reappears. Simulate interruption during an upload and interruption during a DB transaction: content is either fully committed or safely rolled back; partial corrupt blobs cannot be served. Export → restore into another user directory must preserve intended data and ACLs.

### US-09 — Multiple levels (P2)

**Given** a tower with floors at 0, 4 and 8 meters, **when** Alice walks up stairs and Bob remains below, **then** elevations, fog, visibility, wall collision, light and template targeting use consistent vertical geometry. A token cannot see secrets through a solid floor. DM can edit level two without accidentally moving level zero objects.

### US-10 — Packages, macros and malicious content (P1/P2)

**Given** a user-imported module with a legitimate dice macro and an intentionally malicious journal/import payload, **when** it is installed/previewed, **then** only documented manifest permissions are available and XSS/arbitrary server filesystem access are blocked. Module incompatible versions are refused with actionable errors. Disabling a module leaves campaign data recoverable.

### US-11 — A/V and remote browser joining (P1)

**Given** a properly configured HTTPS host and TURN where required, **when** three browser users enable voice and one enables video, **then** each user gets explicit permission prompts, can mute/stop independently, and reconnects cleanly after network drop. Host never auto-starts microphone or camera without consent. Unsupported network setups yield diagnostic guidance instead of a silent broken experience.

### US-12 — Local-first operation (P0)

**Given** a host and two laptops on LAN with outbound internet disconnected, **when** a session is launched, **then** maps, tokens, journals, chat and dice continue to work without remote identity, CDN, analytics or cloud calls. Optional A/V on LAN may require device/browser-specific secure-context configuration, which must be documented honestly.

---

## 13. UX WORKFLOW SCHEMATICS

### 13.1 Host start

```text
Start hosting web server and open the DM browser
  -> detect/initialize local campaign store
  -> owner login/unlock
  -> choose campaign or create new
  -> Start hosting (loopback + optional LAN interface)
  -> verify service readiness + port/firewall status
  -> show local URL and invite wizard
  -> DM opens workspace; players join browser
  -> live campaign session
  -> clean Stop hosting with backup/close acknowledgement
```

### 13.2 Server command handling

```text
Client intent
  -> schema validation and payload limits
  -> authentication + origin/session checks
  -> campaign membership + capability check
  -> scope-specific authorization (actor/token/scene)
  -> validate game rules + conflict revision + rate limits
  -> execute within transaction, update state and revision
  -> append audit/roll/event receipt as needed
  -> derive visibility-scoped results per connected client
  -> send ack/error to sender + filtered events to recipients
  -> gracefully recover after disconnect with filtered snapshot
```

### 13.3 DM scene construction

```text
Create scene
  -> choose background/upload asset
  -> calibrate grid/units
  -> add tokens/characters/items
  -> configure layers + initial fog
  -> draw walls and portals
  -> place light/sounds/templates/regions/notes
  -> preview as actual player role
  -> save and preload
  -> activate/push to players
```

### 13.4 System-aware roll

```text
Click attack/skill/spell/roll
  -> ruleset resolves actor + item + targets
  -> build validated normalized dice AST + modifiers
  -> player sees preview and adjusts allowed choices
  -> server validates ownership, resources and visibility
  -> server rolls and optionally records effect/action
  -> generate scoped result card and immutable roll receipt
  -> authorized users see roll; GM controls follow-up resolution
```

---

## 14. CRITICAL ALGORITHMS AND IMPLEMENTATION NOTES

### 14.1 Visibility / fog is a SECURITY PROBLEM, not only a shader problem

Keep **visual raycasting** and **authorized scene projection** coordinated but separate:
1. Define server-side visibility model from owned tokens, vision modes, walls, obstacles, darkness, elevation and sharing rules.
2. Compute or safely approximate visible geometries on the authoritative server (or trusted host worker) for deciding whether to reveal token metadata and associated assets. Never rely on a client to provide proof of visibility.
3. Send obscured map geometry appropriately. If a map image itself contains visual secrets in inaccessible sections, **downloading the full background file leaks that image even if fog hides it**. For strict content secrecy, support server-side map/level tile partitioning and authorization-aware tile serving, or warn that user-uploaded monolithic map bitmaps are download-visible to entitled scene viewers. Do not claim a full-map asset is cryptographically hidden by client fog.
4. Separate geometry known to a player from unknown geometry; clients do not need exact private positions or layouts for unrevealed locations. Terrain image confidentiality is distinct from token/document confidentiality.
5. For normal VTT play, basic image fog may hide visually; for **strict no-data-leak mode**, use protected map tile delivery and server projection. Make the privacy level visible in UI and test it. Never silently advertise strong map confidentiality while shipping the entire secret map bitmap.
6. Maintain a revocation-safe cache invalidation strategy and serve assets through campaign access checks.

**Phase policy:** P0 scene maps may be delivered as an entire asset to players with an explicit `Background artwork can be downloaded by connected players` warning; P0 secret actors/tokens/journals must remain server-filtered. **Before releasing a "strict secret map" feature**, implement authenticated tile delivery (P1/P2) and prove the actual map bytes from unrevealed areas are unavailable. Don't let perfection block a playable P0 but do not disguise the remaining threat.

### 14.2 Dice algorithm

- Parse to a structured AST, normalize and validate counts/sides/recursion/expression length. Example bounds: max 1,000 dice, max 10,000 sides/die and max 64 AST depth; adjust with threat/performance tests.
- Use server OS CSPRNG for random draws. Roll once per accepted command, persist breakdown with deterministic request dedupe; never trust browser-computed outcomes.
- Separate displayed roll formulas from stored/private formula details; blind results require privileged projections.
- Provide unit/property tests covering probabilities, unsupported syntax, parser ambiguities, exploding/keep-drop/rerolls, modifier overflow, zero/negative dice and recursion bombs.
- Optional commit/reveal verification requires specific threat model (host remains trusted). Do not market “provably fair” without robust implementation.

### 14.3 Media pipeline

- Stream uploads to temporary files with byte/file-count quotas and MIME sniffing; do not load entire 200 MB video into RAM.
- Validate/decode image using maintained codecs, bound dimensions/decompression ratio, strip privacy-relevant EXIF when desired, generate thumbnails via background task, atomically rename by content hash on success.
- Scene asset references are opaque IDs resolved after ACL. Use content hash for dedupe but never expose raw hash as an unguarded public URL.
- Preview videos in-browser only with codecs supported by a documented browser set; unsupported files show conversion instructions.
- Place storage under user data directory, never app binaries, with `data/`, `assets/`, `backups/`, `logs/` and system-package dirs. Paths are canonicalized against configured root.

### 14.4 Rule-system extensibility

- Use `systemId`, `systemVersion`, `schemaVersion` on actor/item/character record. Validate on create/update and before loading modules.
- Systems define calculations as deterministic trusted DSL/AST, metadata plus safe host functions. First-party system may implement its validated rules in Rust.
- Third-party modules must declare granular capabilities and run in explicit sandbox with memory/CPU limits. Browser iframe origin + CSP isolation is necessary for untrusted UI modules; server Wasm handles sensitive deterministic computations under host-controlled capabilities.
- Future modules can register safe extensibility points: actor sheets, action resolvers, scene hooks, roll formatters, tool palette extensions, journal view types, data adapters and localized strings.
- Persist system/module versions and offer compatibility/migration previews; users should be able to disable a broken module, launch in safe mode and restore backup.

### 14.5 Audio/video practicality

- WebRTC browser peer connection works best for small groups; at ~8–12 players, mesh video scales poorly. Implement adaptive layout, resolution limits, optional voice-only and document advanced SFU topology as later optional scalability work.
- TURN relaying can consume bandwidth and has network costs; document optional self-hosted TURN (such as coturn) with time-limited credentials, no baked-in public servers and sensible permissions.
- Treat browser `getUserMedia` secure-context requirement seriously: local browser exceptions vary; remote internet A/V must be on HTTPS, with correct WSS and ICE diagnostics.

### 14.6 No silent data corruption from undo/redo

- Canvas authoring actions can be represented as invertible commands with scoped revisions.
- For multiplayer combat and sheet mutations, maintain an audit trail and explicit DM reverse/correction command. Do not let a client locally replay arbitrary historic state across other users' changes.
- Store snapshots periodically and event receipts judiciously; do not convert the entire DB into an unbounded event log without retention/compaction.

---

## 15. THREAT MODEL AND SECURITY TEST CATALOG

Maintain `docs/SECURITY.md` with assets, threat actors and trust boundaries. Assume untrusted players, leaked invitation codes, malicious user-uploaded HTML, malformed PNG/media payloads, hostile imported packs, browser XSS, an opportunistic exposed home internet port, and a player attempting to read DM secrets. The host DM is trusted to see campaign content but should not be asked to disable OS security features.

| Threat                                     | Required defense                                   | Automated test                  |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------- |
| User guesses another campaign's actor IDs  | Campaign-scoped authorization                      | `forged_actor_id_403`           |
| Player sends `actor.update` on DM-only NPC | Ownership/capability validation                    | `npc_mutation_denied`           |
| Player guesses hidden monster's asset URL  | Asset ACL + secret projection                      | `hidden_asset_403`              |
| Hidden room text appears in WS snapshot    | Per-user serialized projection                     | `ws_secret_fields_absent`       |
| Player changes body role field to `gm`     | Server ignores client role claims                  | `role_escalation_denied`        |
| Player fetches blind-roll outcome          | Separate roll visibility projection                | `blind_roll_secrecy`            |
| Cross-site WS establishment                | Handshake origin/token validation                  | `ws_origin_rejected`            |
| Malicious journal markup executes          | Sanitization/CSP/iframe policy                     | `journal_xss_blocked`           |
| Upload `../../db.sqlite` filename          | Safe normalized content store                      | `upload_traversal_blocked`      |
| SVG contains embedded script               | Reject or safe rasterize SVG                       | `svg_script_blocked`            |
| Zip pack decompresses 1 TB                 | Size/count/depth caps                              | `archive_bomb_rejected`         |
| Huge dice expression consumes server       | AST and evaluation bounds                          | `dice_bomb_rejected`            |
| Rapid WS flood                             | Limits, backpressure, disconnect                   | `ws_flood_bounded`              |
| Join code brute force                      | Entropy, expiry, rate limits                       | `invite_rate_limit`             |
| Cached secret after role revoked           | Revocation and cache invalidation                  | `revoke_secret_while_connected` |
| Concurrent player writes lose data         | Revision control / conflict UX                     | `concurrent_journal_conflict`   |
| Crash mid-write corrupts campaign          | WAL/transactions and recovery                      | `recovery_after_crash`          |
| Plugin attempts host filesystem read       | WASM capabilities sandbox                          | `plugin_fs_denied`              |
| Unrevealed map delivered as full image     | Protected tile serving or explicit risk disclosure | `secret_map_tile_denied`        |

Use fuzzing/property testing on parsers: dice grammar, geometric collision, archive import, JSON protocol, data migrations, WASM module manifests and role projections. Run a dependency audit and keep a simple software bill of materials for releases.

---

## 16. TESTING STACK AND RELEASE GATES

The canonical integrated runner is `pnpm verify`; `pnpm verify:release` runs the same checks and browser suite against the optimized host and matched web bundle from this source. Shell wrappers and CI delegate to it. Use `--list` only to inspect the plan, never as validation evidence. Automated success does not waive manual playable-session, LAN, platform or final-package smoke gates. See RELEASE.md and CONTINUOUS_DEVELOPMENT.md.

### Required commands (implement cross-platform equivalents)

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm test:e2e
pnpm build
```

Add scripts to orchestrate dev server + local host + test database + Playwright. Keep tests isolated and deterministic, with independent temporary directories per test. Seed users, invites, permissions, scenes and assets via first-party fixture tools; do not rely on live competitors, external registries during tests, or copyrighted assets. Document exact supported Node/Rust versions, OS prerequisites, env variables and data directory behavior.

### Multi-client test harness

- Start a fresh server; create DM in Playwright BrowserContext A and Player A/B in independent BrowserContexts B/C with distinct cookies.
- Run operations concurrently: movement, status effect, chat, dice, door interaction, scene switching, reconnection, permission changes.
- Assert server persistence and snapshot correctness; collect WS frames to prove forbidden fields absent.
- Failure injection: stop backend, restart DB, delay/drop WS messages, simulate reconnect, upload partial file, duplicate command request.
- Browser matrix: latest stable Chromium and Firefox, WebKit where practical. Host-first Windows manual smoke; browser player Chrome/Edge/Firefox on Windows/macOS/Linux.
- Manual smoke suite includes browser mic/camera permissions, TLS proxy, host firewall, server startup/shutdown independent of browser tabs, server updates, backup UI and low-end rendering fallback.

### Nonfunctional gates

- No high/critical known vulnerabilities in shipped runtime dependencies without documented mitigation/owner acknowledgement.
- Zero unauthorized secret disclosure in tests; a reported data leak blocks a release.
- No broken required user flows in P0 or P1 claimed releases.
- Measure main-session load time, rendering FPS, max peak memory for large scene, mean/p95 command processing and sustained WebSocket throughput; write values and test conditions in `docs/PERFORMANCE.md`.
- UI WCAG 2.2 AA _targets_ on DOM components and sensible canvas keyboard equivalents; record known exceptions, provide accessible sheet/chat alternatives.
- Run a fresh-install smoke and backup-restore smoke on each release build, not just dev mode.
- Seed/demo campaign uses entirely original or properly licensed assets with attribution and no remote content dependency.

---

## 17. DESIGN SYSTEM AND COMPONENT INVENTORY

Build `packages/ui` with reusable accessible primitives and story/example coverage: button, toggle, segmented tabs, dropdown, popover, tooltip, dialog, sheet, toast, progress, virtualized list, tree/folder view, breadcrumb, resizable panels, draggable dock, searchable command palette, number and dice formula inputs, markdown/rich-text editor, context menu, icon controls, user avatar, token preview, accessible hotbar, permission editor, file uploader and data grid.

**Component specifications:**
- Every input has visible/accessible label, validation, disabled/loading state and keyboard navigation.
- User-facing components use consistent tokens for spacing, typography, radii, shadows, z-index and color modes; fonts display all Slovak accented characters.
- Design responsive **player table** and compact character sheet separately from full DM authoring interface.
- Canvas object inspection uses one right-side inspector schema reused by tokens, lights, walls, doors, pins and templates where possible.
- Drag interactions have explicit cancel/rollback and optimistic preview, avoid losing selected object due to a server ack.
- Toolbars support active/hover/disabled states with real accessible descriptions; configurable shortcuts avoid browser collisions.
- Never implement an attractive mockup that does not launch through working host + authenticated client + persisted server behavior.

---

## 18. PROJECT DOCUMENTS CODEX MUST CREATE AND KEEP CURRENT

| File                               | Responsibility                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `AGENTS.md`                        | Short persistent operating guidance referencing this master plan; all Codex sessions read it |
| `docs/ARCHITECTURE.md`             | Actual as-built component map, command flow, caching, deployment, changes from this design   |
| `docs/DECISIONS.md` / `docs/ADR/*` | Dated decision, alternatives, security/performance tradeoffs                                 |
| `docs/FEATURE_MATRIX.md`           | Every `ADM-`, `MAP-`, etc. ID with current status and verification evidence; no dropped IDs  |
| `docs/PROGRESS.md`                 | Last verified milestone, working flows, tests, next blockers and outstanding regressions     |
| `docs/NEXT_TASKS.md`               | Ordered next 5–15 small engineering tasks with dependencies, acceptance tests, exact paths   |
| `docs/KNOWN_ISSUES.md`             | Repro steps, severity, workaround, linked issue and next action                              |
| `docs/SECURITY.md`                 | Threat model, trust boundaries, secret filtering and residual risks, TLS and media exposure  |
| `docs/HOSTING.md`                  | Windows LAN first, VPN/direct internet, HTTPS, CGNAT, firewall, TURN and troubleshooting     |
| `docs/DATA_MODEL.md`               | Entities, ownership, migrations, schema versioning, import/export                            |
| `docs/API.md`                      | REST/WS schemas, commands/events, errors, auth, examples                                     |
| `docs/CONTENT_LICENSING.md`        | Third-party content policy, actual attributions, current SRD version, import restrictions    |
| `docs/DM_GUIDE.md`                 | Campaign creation, host, scenes, fog, prep, encounters, secrets, backups                     |
| `docs/USER_GUIDE.md`               | Joining, connection, player controls, character sheets, dice, shortcuts                      |
| `docs/BACKUP_RECOVERY.md`          | Actual backup/restore instructions and verification                                          |
| `docs/RELEASE.md`                  | Packaging, version scheme, compatibility, release notes and smoke procedure                  |

**Initial `AGENTS.md` template:**

```md
# Project Hearth / Codex agents

1. Read `PRIVATE_VTT_CODEX_MASTER_PLAN.md`, `docs/PROGRESS.md`, `docs/FEATURE_MATRIX.md`, `docs/NEXT_TASKS.md`, and `docs/DECISIONS.md` at the start of work.
2. The DM-hosted Rust server is authoritative; no unauthorized data is sent to players.
3. Deliver vertical slices: real UI + real API + persistence + ACL + tests.
4. Follow phase gates and feature IDs; no demo-only false completions.
5. After code changes, run checks; record actual result and update progress documents.
6. Work on top unblocked next task; continue autonomously. Never replace this implementation project with another plan.
```

---

## 19. ORDERED BUILD PHASES — CODEX EXECUTION ROADMAP

**This section is the execution order.** Each phase lists prerequisites, tangible deliverables, exit gate and suggested first tasks. Execute sequentially through phase gates, while doing code cleanup/security throughout. Phase numbering is not a promise of timelines.

### PHASE 0 — Repository discovery, toolchain, foundation and honest demo

**Start here immediately.**

**Tasks**
1. Inspect files; create `AGENTS.md`, the progress docs, the fully populated feature matrix from §11 and an ADR for chosen versions.
2. Initialize pnpm workspace and Cargo workspace with source formatting, linting, typechecking, test and build commands.
3. Implement browser-based React + Axum web-server integration; health endpoint reports running campaign availability without leaking secrets.
4. Add SQLite migrations, configurable user-data root and smoke fixture; verify restarts and migration locking.
5. Add UI design tokens, routing, error boundary, translation structure, logging and central schema/protocol package.
6. Build an original introductory campaign seed with 1 background image, 2 token images and 1 journal page, all included locally and licensed/attributed.
7. Set up CI, dependency pinning, README, dev scripts on Windows/Linux shells.
8. Add a basic auth flow with password hashing (no insecure permanent guest mode).

**Deliverable:** fresh checkout can install, run host service, open web application, create/login owner, and access a saved sample campaign; CI compiles/tests.

**Exit gate:** `pnpm build`, Rust build/tests, first integration smoke, database restart and static-file serving actually pass. Feature matrix accurate. Do not jump to fancy lighting or 3D now.

### PHASE 1 — First playable private LAN tabletop (P0 core)

**Tasks, in order**
1. Build campaign create/open/archive, invite flow, player identity, server-side role/ACL and different client layouts (`ADM-01..05`, `OPS-01`).
2. Build SQLite persistence for actors, scenes, tokens, journal, chat and event receipts. Atomic command processor with single DM host and real WS snapshots/revisions.
3. Render background using Pixi; pan/zoom, square grid and token move with server-authorized ownership (`MAP-01..05`, `TOK-01..03`).
4. Add upload/store/retrieve media with permission checks, local thumbnail generation (`MED-01`).
5. Basic manual fog and DM overlay with server-filtered hidden entities. Explicit map-background download privacy warning (`VIS-01`).
6. Dice parser + secure server rolls, public/private/blind roll projections, compact dice tray (`DICE-01..02`).
7. Shared chat with whispers and typed roll messages (`COM-01..02`).
8. Generic actor sheet, editable owner fields, visible/private handouts and folder trees (`CHR-01..02`, `JRN-01..02`).
9. Combat tracker with initiative, rounds, HP manual adjustments (`CMB-01..02`).
10. Autosave/export/restore and disconnect/reconnect. Owner local host status/connected user count.
11. Reproduce US-01..05, US-08 and US-12 with actual three-browser E2E. Fix anything that leaks secret data.
12. Provide a simple headless server-start workflow and browser host dashboard; verify player URL-based join over LAN. Avoid OS-security bypass shortcuts.

**Exit gate P0:** DM + Alice + Bob can complete 30-minute demo encounter and all state persists after restart; all P0 security tests pass. Importantly: players cannot move unauthorized tokens or read private data by inspecting network responses. Produce a `P0_RELEASE_NOTES.md` with features and known limitations.

### PHASE 2 — Rich 2D mapping and Foundry/Roll20 visual basics (P1)

**Tasks**
1. Grid modes/measurement calibration, scene/asset library, scene folders, multilayer renderer, image/animated tiles and scene thumbnails (`MAP-06..12`).
2. Full wall geometry primitives, token collision, secure vision/lighting layers, normal/secret doors and windows (`VIS-02..08`).
3. Measure templates, area selection and token targeting; test movement and line of sight against geometry (`MAP-13..15`, `TOK-04..07`).
4. DM placeables inspector, multi-select, multi-edit, right-click menus, bulk workflows, undo/redo scoped to safe authoring operations.
5. Improved full-screen player table, dockable UI and preview-as-player, including actual player-scoped projections.
6. Map loading optimizations, texture caching, object culling, stress fixtures; partition map background tiles if strict map-art secrecy is promised.
7. End-to-end scenarios US-03/06 plus collision/vision property tests. Include door revocation and hidden token asset tests.

**Exit gate P1-map:** DM can prep a dungeon with walls, dynamic lighting, doors and handouts, and player sight/secret rules hold on 2 clients. Measured performance values recorded.

### PHASE 3 — Dice, ruleset and full character/combat loop (P1)

**Tasks**
1. Expand dice grammar, roll cards, rollable tables and card/deck private hands (`DICE-03..08`).
2. Finish system-neutral actor/item/effect APIs with schema versioning and activity/condition events.
3. Implement a **clearly identified SRD v5.2.1-only** D&D-style module from reviewed CC BY-4.0 sources. Add attribution, tests and demo characters. Keep source provenance on content records.
4. Implement functional PC/NPC sheets and inventory/spells/actions/conditions/rests/attacks/saves, with DM override. Prioritize the parts necessary for a complete rules-driven combat encounter (`CHR-03..10`, `CMB-03..07`).
5. Compendium search, source pages, drag/drop and macro hotbar actions.
6. Integrate template targeting into spell/action flows; do not apply damage invisibly or without configurable consent.
7. Test US-04 and US-07, plus game-rule fixture test corpus and 3-client encounter.

**Exit gate P1-rules:** a party can complete a short SRD 5.2.1 encounter with persistent character sheets, item/spell/resource tracking, initiative, attack/damage/conditions, private GM rolls and DM overrides, without manual DB edits.

### PHASE 4 — GM preparation suite and campaign authoring parity (P1)

**Tasks**
1. Rich multi-page journals, handouts/notes, permission-aware map pins, cross-links, quest tracker and backlinks (`JRN-03..07`, `MAP-15`).
2. Compendium packs, reusable actors/items/scenes, file galleries, media metadata and import/export tools (`EXT-01..05`, `MED-02..06`).
3. Soundboard, playlists, scene ambience, music and accessible player volume controls (`AV-01..05`).
4. Roll table UI, card stack actions, custom dice presets, robust no-code macros and DM action templates.
5. Host networking wizard, external URL troubleshooting, secure remote options, HTTPS/WSS mode, optional remote E2E test configuration (`ADM-07`, `OPS-03`).
6. Saved panel layouts, full hotkey customization, command palette, helpful onboarding and in-app guide.
7. Backup schedules, restore verification, operation logs and data-size dashboard.

**Exit gate P1-GM:** DM can prepare and run a several-session campaign with minimal repeated setup; assets/journals/notes sound/encounters are usable live; private notes stay private.

### PHASE 5 — Remote social play + content creation polish (P1)

**Tasks**
1. WebRTC voice/video opt-in with user privacy UX and user-selectable audio devices; signaling via host; optional TURN configuration (`COM-06..08`).
2. Reconnection, secure-context and network diagnostics, duplicate login handling, moderation/ban/whisper rules.
3. Party lobby, spectator/stream view, assistant roles, party communication and scene presentation.
4. Player tablet-friendly UI, localization (English + Slovak), high contrast and reduced-motion modes.
5. Package an easy-to-run self-hosted server with web-based onboarding, connection help and host firewall guidance; verify backups/migrations before upgrades. No desktop app.
6. Test an actual WAN scenario in a controlled environment. If WAN connectivity unavailable, clearly mark it unverified, use synthetic network tests, and document steps to verify.

**Exit gate P1-remote:** verified multi-browser remote host scenario via at least one documented secure connection strategy with honest limitations, plus recoverable A/V failures.

### PHASE 6 — Advanced Foundry v14 feature parity (P2)

**Tasks**
1. Native multi-level scenes, elevations, vertical wall/sight/light/fog interactions and level-specific placeables (`MAP-16`, `VIS-10`).
2. Geometric Regions with shapes, holes, behaviors, triggers, regions/templates attached to tokens, environment triggers (`MAP-17`, `EXT-11`).
3. Active-effect lifecycle with turn/round/time expiry, token appearance/vision/light transformations, reset and audit (`CHR-09`, `CMB-09`).
4. Shared fog/exploration policies across parties, elevation-aware measurements and collision algorithms.
5. Prefabs, bulk placeable palette, placeables sidebar, scene level filters and transitions (`MAP-18`, `UX-10`).
6. Robust visual/sound effects, weather, cinematic transitions, particles, token FX and performance downgrade modes (`AV-06..08`).
7. Tests US-09, dense multi-level map performance benchmark and fog/vision exploit scenarios.

**Exit gate P2-levels:** working 3-floor demo dungeon; floor/door/light/vision/region interactions tested with 3 user identities.

### PHASE 7 — Deep customization: modules, homebrew and extension ecosystem (P2)

**Tasks**
1. Formalize typed generic game-system SDK, system manifests, schema migration/revision and developer examples.
2. Declarative sheet editor, custom resources/attributes and user-defined rule actions.
3. Safe permissioned macro/automation system with an extensible event model, tests and migration tooling.
4. WASM host plugin sandbox plus explicit capabilities, quotas and failure isolation; UI extension sandbox. No direct unsandboxed JS on host.
5. Pack builder/importer, safe installer, dependency manager, version compatibility checker, safe mode and rollback.
6. Guided SRD 5.2.1 character builder, level-up flows, advanced NPC creation; consider separately shipped SRD 5.1 package.
7. Character/world content portability and selective legal importer adapters; review every importer's third-party terms and licensing.
8. Security regression suite includes malicious plugin, untrusted archives, package removal/re-enable and user content migrations.

**Exit gate P2-ecosystem:** a developer using only published SDK/docs can implement and install a new custom dice mechanic + actor sheet + item + action + compendium, without changing the main core. Host cannot be compromised by an untrusted module in the threat model.

### PHASE 8 — Production hardening, cross-platform and accessibility (P2)

**Tasks**
1. Browser compatibility on Windows/macOS/Linux and simple server deployment/start workflows with appropriate filesystem permissions; no native desktop application packaging.
2. Headless Docker/service profile with same server, explicitly designated owner DM, documented TLS/proxy and volumes.
3. Load tests at scale, memory/texture analysis, giant maps, audio mixers, A/V adaptive scaling and reconnect storms.
4. Database migrations from every previous released schema, backup restoration from realistic worlds, import rollbacks.
5. Keyboard/screen-reader/a11y review, localization completion, user preference migration and guides.
6. Structured crash/error diagnostics with secrets redacted, privacy/telemetry opt-in only if ever added.
7. Release automation, version signatures/checksums, SBOM, license audit, compatibility policy, changelog and tested rollback.

**Exit gate production:** full secure installation, hosting, playback, backup, restore and migration on all supported OS targets; comprehensive QA report with real benchmark measurements.

### PHASE 9 — Optional stretch and enhancements (P3)

Consider 3D tabletop, in-person shared TV mode, local AI tools, companion mobile app, spatial voice, local MCP integration and improved offline collaboration only after core requirements are stable. Each stretch feature requires its own threat/performance/licensing decision and feature flag. Do not let it preempt an unfinished foundational feature.

---

## 20. IMPLEMENTATION PRIORITY: FIRST 15 CODEx TASKS

**This is the recommended initial `docs/NEXT_TASKS.md` contents for an empty repository. Each task should ideally complete with code, tests and a small reviewable change.** Codex should adapt if substantial code is already present.
1. **T001** Inspect repository, toolchain, existing code and packages; record ADR-0001 architecture and initial progress; copy this master plan into root; generate complete feature matrix IDs.
2. **T002** Initialize pnpm/TypeScript strict monorepo + Rust Cargo workspace, scripts, lint/format/typecheck and CI that fails correctly.
3. **T003** Build Axum server `GET /api/health`, JSON error contract, log redaction, configurability, and Rust integration test.
4. **T004** Build SQLite SQLx migrations for campaign/user/membership/session and content root; isolated test DB; restart persistence test.
5. **T005** Build owner first-run/create/login, Argon2id hashed passwords, secure cookie/session and session revocation tests.
6. **T006** Build React basic routes/design tokens, first-run and campaign library; wired to real API; English strings externally located.
7. **T007** Create campaign, launch host session, demonstrate a second browser joining through invitation and membership server checks.
8. **T008** Implement versioned WS handshake, snapshot/event/ack/error envelopes and reconnection integration test.
9. **T009** Define scene, token, actor, journal and asset models + initial seed demo + serializer/ACL projection tests.
10. **T010** Implement Pixi game canvas, uploaded map image, pan/zoom and scene persistence through actual API.
11. **T011** Implement token creation, rendering, movement commands with owner authorization; two browser contexts synchronized.
12. **T012** Add DM-only layer + manual fog UI; prove private actor/token data absent from player snapshot; note background image confidentiality limitation.
13. **T013** Add server dice parser/roller, roll privacy, duplicate request idempotency and parser property tests.
14. **T014** Add chat/private whisper, minimal generic character sheet and DM-shared journals, all persistence/ACL covered.
15. **T015** Add combat tracker, export/restore, host stop/restart and three-browser end-to-end P0 demo, then issue P0 gap report.

If the repository already implements one of these tasks, verify its functionality before checking it off; skip duplicating it and move to next actual gap. Prefer small merged vertical slices over huge unreviewed rewrites.

---

## 21. BASELINE API AND PROTOCOL TARGETS

Codex should design and publish the actual API in `docs/API.md` before clients depend on it. The following is a starting route inventory, not a license to leave route stubs. Every route is authenticated and campaign-scoped except onboarding/login, health and public static application bundle. Explicit ownership checks apply to read routes as well as mutation routes.

```text
GET    /api/health
POST   /api/setup/owner                 # available only before owner configured
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/rotate-session
GET    /api/campaigns
POST   /api/campaigns
GET    /api/campaigns/:id
PATCH  /api/campaigns/:id
POST   /api/campaigns/:id/invites
POST   /api/invites/redeem
POST   /api/campaigns/:id/members/:userId/revoke
GET    /api/campaigns/:id/scenes
POST   /api/campaigns/:id/scenes
GET    /api/campaigns/:id/scenes/:sceneId
POST   /api/campaigns/:id/commands      # optional HTTP transport fallback
GET    /api/campaigns/:id/actors
POST   /api/campaigns/:id/actors
GET    /api/campaigns/:id/journals
GET    /api/campaigns/:id/combat
GET    /api/campaigns/:id/chat
POST   /api/campaigns/:id/assets        # authenticated streaming upload
GET    /api/campaigns/:id/assets/:id    # authenticated, visibility scoped
POST   /api/campaigns/:id/exports
POST   /api/campaigns/:id/backups
POST   /api/campaigns/:id/restores/verify
GET    /api/campaigns/:id/ws            # authenticated WS upgrade + protocol negotiation
GET    /api/host/network-status        # owner only
POST   /api/host/stop                 # owner only; confirmation token
```

### Commands/events to implement early

```text
campaign.join / campaign.memberChanged
scene.create / scene.created
scene.activate / scene.activated
scene.patch / scene.patched
token.create / token.created
token.move / token.moved
token.patch / token.patched
token.delete / token.deleted
fog.reveal / fog.patched
fog.hide / fog.patched
dice.roll / dice.rolled
chat.send / chat.messageCreated
actor.create / actor.created
actor.patch / actor.patched
journal.create / journal.created
journal.patch / journal.patched
combat.start / combat.started
combat.setInitiative / combat.changed
combat.nextTurn / combat.changed
combat.updateHp / combat.changed
permissions.change / permissions.changed
```

**Make all command errors actionable** with stable machine-readable codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND_OR_HIDDEN`, `VALIDATION_FAILED`, `STALE_REVISION`, `RESOURCE_LOCKED`, `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `INCOMPATIBLE_PROTOCOL`, `HOST_SHUTTING_DOWN` and an optional safe human message. Do not distinguish nonexistent from unauthorized secret IDs if it leaks presence.

---

## 22. CONTENT LICENSE AND LEGAL COMPLIANCE

The app itself may use permissively licensed rendering, UI and server libraries. The VTT **must not** copy competitor source code, logos, product names in its own branding, original UI icons, paid packs, character art, marketplace content or document text outside applicable license/permission. Benchmark **behaviors and public documentation**, not internal code.

### D&D and content

- Official D&D SRD materials can have Creative Commons grants, but **read the exact included license and attribution**. Official 2026 SRD index states SRD **v5.2.1** as available and SRD 5.1 as a separate previous family: <https://www.dndbeyond.com/srd>.
- Create separate `content/fantasy-srd/ATTRIBUTION.md`, provenance manifest for records and a build-time content validation script to prevent unlabeled proprietary references/assets.
- The SRD does not confer rights to all named monsters, settings, non-SRD character options, visual depictions or officially sold books.
- User imports are stored privately; warn users they must have rights/permission. Importers only use lawful documented formats and respect licenses.
- Fonts, icons, demo sounds, photos/maps and libraries must have attribution and distribution rights, tracked with their exact license.
- If publishing this software externally, confirm the owner's preferred code license and trademark/name clearance before public release.

---

## 23. OPERATIONAL SAFEGUARDS AND SUPPORT PLAYBOOK

**Security posture for a DM-controlled web server:** default bind to localhost; LAN binding is an explicit user action with firewall information; public internet binding requires HTTPS and clear warning. Do not configure an arbitrary public listener just to make remote joins appear easy. Avoid auto-accepting internet players without per-invite authorization.

**Storage:** show remaining disk space, suggest backups, handle low disk error without corrupting campaigns. Keep database/backups out of temporary build/install folders. Give user control over backup location.

**Updates:** before schema migration, make a backup, verify space, migrate, validate and offer rollback. For installed modules, show compatibility preview and safe mode. Keep data readable/exportable after uninstall if reasonably possible.

**Performance:** if host cannot sustain dynamic lighting, automatically offer downgraded shadows/particles and reduced live preview rates while preserving **visibility security**, not by sending forbidden secrets.

**Crash behavior:** local logs, database recovery, user-facing fault summary with export diagnostics; no silent data loss. After a GPU device reset/reload, restore canvas from authoritative snapshot.

**Privacy:** store no user registration information beyond the private host's participants/permissions unless needed. Display active A/V sharing and recording state clearly. Do not introduce built-in recording without explicit user request/consent and privacy review.

**Connection help:** support FAQs for Windows Defender firewall rules, public IPv4 vs CGNAT, IPv6, VPN access, WSS reverse proxy misconfiguration, certificate mismatch, stale invite, unsupported browser/media codec, microphone secure context and large-asset upload bottlenecks.

---

## 24. DEFINITION OF PRODUCT RELEASE MILESTONES

These are successive milestones of the same maintained Hearth application. Earlier versions are recovery artifacts, not parallel products. Reaching playable status does not stop the full roadmap.

### Release 0.1 — Private playable prototype

Minimum: all mandatory P0 features verified, no unauthorized content leaks, 1 DM + 2 players can actually complete a basic encounter over LAN, data persists, server and web builds are reproducible in documented dev environment. Manual fog is acceptable, with explicit warning about downloaded map art and no assertion of strict full-map confidentiality.

### Release 0.5 — Advanced VTT

P1 visual canvas, LOS/lighting/walls/doors, usable fantasy SRD ruleset, sheets/inventory/combat, rich GM assets/journals/compendiums, basic music, backups and secure remote-hosting documentation. Three-client test matrix and real scene performance report pass.

### Release 1.0 — Privately hosted full-feature product

P1 features verified, polished host UX, stable networking, A/V on supported network environments, straightforward self-hosted server distribution and browser onboarding, extensive automated QA, English/Slovak localization targets, full user/DM guide, no blockers in security/backup features. **Do not call it "full parity with Foundry/any plugin" if P2 features remain incomplete.** Clearly list capability gaps.

### Release 2.x — Deep modular/Foundry-v14 class platform

Core P2 features including levels, regions, safe modules, systems, extensible sheets, advanced effects, cross-platform hosts and stronger tooling are verified. Feature matrix compares concrete supported behaviors; optional P3 is never promised by this milestone.

---

## 25. COMPETITOR CAPABILITY REFERENCE AND GAP REVIEW

This product is inspired by _categories of functionality_ in major VTT tools. **Do not assume the following list contains every feature or every third-party module as of all future versions.** Codex should repeat a review of official docs occasionally and add new capability IDs instead of silently discarding them.

| Product/category                        | Capabilities specifically represented in our backlog                                                                                                                                                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Roll20**                              | maps/pages/layers, tokens, character sheets, dynamic lighting, fog, doors/windows, map pins, macros, dice/3D dice, decks, rollable tables, compendiums, turn tracker, audio/music, text/voice/video, handouts, imports/exports where lawful                                                                                 |
| **Foundry VTT v14**                     | documents/actors/items/journals, scenes, token vision, lighting, walls, doors, fog, modules and game systems, macros, sounds/playlists, cards, tables, scene regions, multi-level scenes, Active Effects v2, pop-out apps, placeables palette/list, shared party fog, scene transitions, particle VFX, HTTPS host usability |
| **Owlbear-like lightweight VTTs**       | frictionless invite, intuitive map drag/drop, simple token/fog/ruler workflows, low-ceremony player join                                                                                                                                                                                                                    |
| **Fantasy Grounds-like automation**     | rule-driven combat, actor/item/inventory sheets, effects, spell resources and monster automation, extensive compendiums where lawfully acquired                                                                                                                                                                             |
| **TaleSpire-like immersion (optional)** | dice animation, 3D/isometric appearance, terrain/lighting/ambience and dramatic presentation; full 3D world building not necessary for first release                                                                                                                                                                        |
| **General tabletop/boardgame mode**     | cards, hands, tokens, counters, alternate grid, clocks, custom dice, shared board, game-independent rules packages                                                                                                                                                                                                          |

### Sources consulted for this specification (official documentation; checked 2026-10-22)

- Foundry release listing (v14 current generation): <https://foundryvtt.com/releases/>
- Foundry v14.359 introduction including native levels, regions, effects, shared exploration and palette: <https://foundryvtt.com/releases/14.359>
- Foundry v14.369 HTTPS/network improvement: <https://foundryvtt.com/releases/14.369>
- Foundry current API: <https://foundryvtt.com/api/>
- Foundry module development: <https://foundryvtt.com/article/module-development/>
- Foundry self-host architecture: <https://foundryvtt.com/article/hosting/>
- Foundry port forwarding and CGNAT guidance: <https://foundryvtt.com/article/port-forwarding/>
- Roll20 tabletop help index: <https://help.roll20.net/hc/en-us/categories/360003756553-Roll20-Tabletop>
- Roll20 current map pins: <https://help.roll20.net/hc/en-us/articles/36271267343639-Map-Pins>
- Roll20 dynamic lighting: <https://pages.roll20.net/dynamic-lighting>
- D&D SRD and licensing: <https://www.dndbeyond.com/srd>

No external reference authorizes copying protected source code/assets or reusing proprietary API implementations. If an official source changes or contradicts a design assumption, update the relevant ADR and feature matrix.

---

## 26. THE FIRST CODEX RESPONSE REQUIRED AFTER READING THIS FILE

Do **not** respond by paraphrasing the plan. Do the real work and end with a compact report containing:
1. **Repository inventory:** what existed before you began.
2. **Files created/changed:** concrete paths.
3. **Working functionality:** exactly what can be launched and used, and with what commands.
4. **Checks run:** literal commands, passed/failed and notable diagnostics.
5. **Feature IDs:** which moved state and what verification evidence exists.
6. **What is not yet functional:** candid and specific, especially remote connectivity/security.
7. **Next actions:** top three unblocked tasks, already written in `docs/NEXT_TASKS.md`.

When the work session permits, complete **PHASE 0** and make progress on **PHASE 1** immediately. If no project directory exists, create it. If important user input isn't provided, adopt the defaults in this document and continue without interrogation.

## 27. FINAL PRODUCT ACCEPTANCE / LONG-TERM NORTH STAR

The project is ultimately successful when the following scenario works smoothly and safely:

A DM starts the Hearth web server on their computer or an owner-controlled server, opens the DM interface in a browser, creates a campaign with no external account, builds an intricate multi-floor adventure with imported maps, legally obtained assets, animated tiles, walls, secret doors, dynamic light, ambient sound, journals, handouts, hidden encounters and custom rules. The DM hosts via LAN or configured secure remote access. A full party joins from browsers, each controls their own characters, sees only appropriate levels/rooms/token details, chats and uses A/V voluntarily, rolls advanced dice, manages inventory and spells, fights encounters with condition/active-effect automation, and explores persistent party fog. DM can create homebrew via a safe extensible game-system API, share selective materials, undo/correct mistakes, safely back up and restore everything, and run multiple sessions with stable performance. The system remains useful even without subscriptions, commercial services, cloud accounts or a marketplace.

**Codex: Build it in verified increments, preserve every requirement in the feature matrix, keep it private and secure, and do not call unfinished features finished.**
