# Hearth validation and release workflow

Hearth has one maintained application and one primary release line. Development servers, debug hosts and optimized hosts compile the same Rust/browser source. Temporary feature branches/test hosts are integrated or discarded; old releases are retained for compatible recovery, not maintained as separate products. CONTINUOUS_DEVELOPMENT.md is the permanent policy.

## Current status and terminology

Current application0.0.20/schema17 adds private journal folders/search alongside token HP/manual markers/context actions and persisted private/shared scene notes alongside drawing erasing/editing, freehand, the vertical UI standard and the player-canvas correction on the same source/release line. It remains partially functional with blocked verified-playable promotion until the master P0 and platform/distribution gates pass. RELEASE_VALIDATION.md records exact candidate evidence; historical results remain in PROGRESS.md.
- **Incomplete source checkpoint:** preserves work, including known blockers. It must not replace a working installation or be called a finished functional iteration.
- **Candidate:** exact integrated source plus matched host/browser/runtime assets undergoing checks. Any failed/unperformed required gate leaves it blocked.
- **Verified playable release:** a candidate that passed the original master Phase 1/0.1 acceptance and applicable platform/distribution gates. Later promoted updates must preserve that playable baseline.

There is currently no verified-playable designation to preserve. Do not create P0_RELEASE_NOTES or promote features to VERIFIED until their actual gates pass. Generic tabletop play can precede complete SRD automation; all advanced roadmap requirements remain.

## One shared automated check path

Install the pinned prerequisites from START_HERE.md, then run:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm verify
pnpm verify:release
```

`verify` runs version consistency, workflow tests, lint/types/TypeScript tests, Rust format/Clippy/workspace tests, feature inventory, the complete web/host build and browser suite. `verify:release` uses the same sequence, builds the optimized host and selects that executable for every browser/recovery fixture. They are validation configurations of the same app. CI and test.sh/test.ps1 delegate to this runner. CI is configured for Linux and Windows; configuration is not evidence that a remote job ran.

`pnpm test:e2e` builds the web/debug host and runs the browser suite for local iteration. It is not the full release gate. `node scripts/verify.mjs --release --list` prints the plan only and proves no checks passed. Do not pass browser filename filters to the release gate to exclude failing cases.

The runner stops on a failure or missing executable and returns nonzero. It rejects mismatched package/Cargo/lock versions, discards inherited live-host data/bind/origin/web settings and sets HEARTH_TEST_HOST_BIN plus HEARTH_TEST_WEB_DIR to the candidate build. All browser, restarted-recovery and capture hosts use the shared resolver, including Windows .exe and custom CARGO_TARGET_DIR. Test fixtures continue to create their own temporary data roots. Never substitute the real campaign directory.

Keep the tested source and artifacts unchanged through promotion. If stale workspace caches are suspected, rebuild and rerun in a fresh local CARGO_TARGET_DIR outside synchronized directories; record the rerun. A source version match alone does not establish that all bytes or all tests belong to the same candidate. Never combine partial passing totals into a claimed full clean gate.

## Promotion beyond automated command success

Before replacing a working installation, record these gates for the exact candidate:
1. Complete automated checks, including the full browser regression and applicable older-data migration/backup-restore tests. Confirm rendered player views, not only live connections or REST/WS projections.
2. Fresh-install and backup/restore smoke using the optimized candidate and final packaged runtime assets in an isolated root. The browser recovery scenario is part of the suite; it does not prove a not-yet-created portable package works.
3. All mandatory P0 features and US-01..05/08/12, the actual 30-minute GM/Alice/Bob encounter, acknowledged persistence/reconnect/restart, ownership/privacy and actual LAN joining.
4. Required target-OS/current-browser/startup/firewall checks and a ready-to-run headless distribution without development tools/database installation. Only claim supported configurations actually tested.
5. Candidate version/source/schema/compatibility, commands/results, test conditions, remaining limitations, dependency/license review, backup location and recovery instructions recorded. A blocked gate leaves the old validated installation available.

No automatic installation replacement, release tagging, public deployment or source publication is performed by the verifier. Keep this project private; external licensing/branding/publication remains subject to the owner's instruction.

## Campaign-safe update and rollback

Follow CONTINUOUS_DEVELOPMENT.md and BACKUP_RECOVERY.md. Keep real data outside build/install directories. Preserve the old application/web/configuration plus a verified full pre-update data/artwork backup. Test migration against a disposable copy; the host's verified SQLite pre-migration snapshot is additional protection, not a complete media backup.

Rollback restores a compatible old application AND pre-update data/artwork/configuration state. Never run the older host against a newer migrated database or casually overwrite a running store. Current archive recovery creates a separate copy and resets sessions/unused invites in that copy; it is not automatic binary downgrade. Preserve failed-update data separately; post-backup edits are not automatically recovered or merged.

## Continuing development

After verified playability: existing playable Hearth → integrated feature change → full applicable validation → updated playable Hearth. Before then, prioritize the recorded player-canvas blocker and Phase 1 gaps. Keep unfinished functionality isolated; continue the entire P1/P2/P3 roadmap after P0 succeeds. After each update report included/pending/actual checks/next in BUILD_OVERVIEW and the user handoff. Historical migration/build records are preserved in PROGRESS and versioned source history.
