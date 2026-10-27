# Stage 1: private host foundation

Authority: `PRIVATE_VTT_CODEX_MASTER_PLAN.md`. The user explicitly instructs implementation in stages and the supplied operating contract authorizes sensible reversible defaults without another approval cycle.

## Outcome

Create the first runnable self-hosted increment: a Rust service, owner onboarding/login/logout, a persisted campaign library, single-use invitations and independently authenticated player access, plus a read-only original sample table. This establishes the actual client/server boundary before interactive multiplayer commands. It is a development foundation, not release 0.1 or a complete Phase 0 gate.

## Architecture

Retain the master plan defaults: strict TypeScript/pnpm, React/Vite, TanStack Query, PixiJS, Rust/Axum/Tokio, SQLite/SQLx WAL. Separate domain wire models, storage/migrations and HTTP orchestration. Use a versioned Zod protocol package and shared JSON contract fixtures. Per ADR-0002, both DM and players use the web app, served by the headless Rust backend. No Tauri/native desktop application is planned.

Alternative: Node-only service reduces first-build friction but departs from the required Rust foundation. Alternative: cloud-hosted website speeds a public preview but violates the private host model. Use neither.

## State and security

Persist users, opaque server sessions, campaigns, memberships, invites, seeded scenes/tokens/journals. Argon2id passwords; random session/invite secrets, SHA-256 hashes at rest, HttpOnly SameSite=Strict session cookie. Origin plus custom-header CSRF protection; fixed configured Host allowlist against rebinding. Auth rate limits and bounded password work. First owner creation is atomic. Non-loopback binds require explicit LAN opt-in, a private interface and an already configured owner. No internet-facing mode in this increment.

Campaign reads check current membership. Owner is the campaign DM; clients cannot supply roles. Invite issuance is DM approval for one new player account, with expiry/revocation and atomic one-time redemption. Hidden demo token/journal fields and their art are excluded from player APIs. No static directory route serves private content. A downloaded complete map can be inspected; the table must display that limit.

## UI

Original dark navy/amber identity, local system fonts with Latin Extended support, keyboard accessible forms and native modal dialogs, external English strings, loading/offline/error/empty states. Owner sees campaign management and invitation tools. Player sees only permitted campaign and shared demo content. Sample canvas supports local pan/zoom/reset; token editing and live synchronization are explicitly upcoming and have no misleading active controls.

## Acceptance

Real-server tests must cover initial setup, duplicate setup/races, password hashing, wrong credentials, logout revocation, session expiry, CSRF/Host rejection, validation, campaign persistence, cross-campaign isolation, invitation expiry/reuse/revocation, role escalation denial and hidden token/journal/art projection. Playwright must exercise owner and two isolated player browser contexts. Restart the server/store and confirm saved data. Build and serve the actual frontend through Rust. Cross-platform server/browser execution, easy server distribution and physical LAN tests remain unverified until exercised.
