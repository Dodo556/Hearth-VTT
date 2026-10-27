# Hearth Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with a fresh whole-branch reviewer at the end. The supplied master plan authorizes immediate implementation.

**Goal:** Deliver a launchable private host, persistent authenticated campaigns and controlled player entry.

**Architecture:** Axum serves REST and the built React application. SQLx stores normalized local data. Server projections enforce membership and demo-content visibility before producing wire models.

**Tech Stack:** Rust stable, Axum, SQLite/SQLx, React, TypeScript, Vite, PixiJS, pnpm, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-foundation-design.md` and the supplied master plan.

## Global Constraints

- Self-hosted Rust is authoritative; no external identity, runtime CDN, analytics or proprietary content.
- Default bind is loopback; configured private LAN access is deliberate and requires owner setup first.
- Every campaign read/mutation checks current membership; secrets are filtered before serialization.
- Only VERIFIED means complete; retain all feature IDs and record actual verification.
- Do not publish code, choose a public license or disable Windows security.

## Review Focus

1. Concurrent initial owner setup must produce exactly one owner (server integration).
2. Two concurrent redemptions of one invitation must produce one account/membership (server integration).
3. Revoked or expired sessions and memberships must lose access on the next request (server integration).
4. Direct hidden asset/scene/journal reads must not reveal existence to players (server integration).
5. Non-ASCII display names and empty/oversized/malicious JSON must have predictable safe behavior (server + browser tests).

### Task 1: storage and host service

**Files:** root workspace manifests; `crates/domain/src/lib.rs`; `crates/storage/src/lib.rs`, `migrations/0001_foundation.sql`; `crates/server/src/{lib,main,config,error}.rs`; `crates/server/tests/foundation.rs`.

**Interfaces:** produces `Store::open(root: &Path) -> Result<Store>` with a SQLite pool and process lock; `AppState::new(config: Config) -> Result<AppState>`; `router(state: AppState) -> Router`.
- [x] Write HTTP health/setup/login/persistence/security acceptance tests against an initially empty router; run `cargo test --workspace` and observe missing behavior.
- [x] Implement migrations, WAL/FK/locking, configuration, JSON errors and bounded authentication; add campaign/invite projection routes to pass tests.
- [x] Run `cargo fmt --all`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`; expected no warnings/failures.
- [x] Commit runnable service and record evidence in progress.

### Task 2: authenticated browser experience

**Files:** `packages/protocol`, `packages/ui`, `apps/web/src/{api,App,main}.tsx`, feature modules and English catalog; original `content/examples/amber-keep` assets; frontend tests.

**Interfaces:** consumes `/api/health`, `/api/auth/me`, owner/auth routes, campaign/invite/member/scene/journal/assets routes documented in `docs/API.md`; produces browser entry, library and read-only sample canvas.
- [x] Add runtime contract tests for malformed versioned responses and shared fixtures; run and observe rejection tests fail before schemas exist.
- [x] Implement strict protocol schemas, owner/join/login forms, real campaign library and DM tools, Pixi sample scene, accessible UI states.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; expected pass.
- [x] Commit real API client and original assets.

### Task 3: multi-client validation and durable handoff

**Files:** `tests/e2e/foundation.spec.ts`, `playwright.config.ts`, scripts, CI, full required project docs and feature matrix.

**Interfaces:** consumes compiled Rust binary and frontend build; independent temporary data root per test server; produces reproducible test commands, source bundle and next-stage instructions.
- [x] Run real-browser owner plus Alice/Bob creation/join/projection/revocation tests and production static-serving smoke.
- [x] Fix actual failures, re-run relevant full suites and dependency audits; document residual risks.
- [x] Run fresh whole-branch review; fix material findings with regression tests.
- [x] Update all progress/feature/next-task documents, commit and package source excluding dependencies/build artifacts/secrets.
