# Hearth VTT — Codex cloud development handoff

Prepared 2026-10-27. This is a continuation guide for the existing application, not a replacement specification. Read this file and the source before implementing. Do not rely on the previous chat being available.

## Start here

1. Read `AGENTS.md`, this file and `docs/CONTINUOUS_DEVELOPMENT.md`.
2. Read `PRIVATE_VTT_CODEX_MASTER_PLAN.md` in full: it is the authoritative architecture, 179-feature inventory, ordered phases and acceptance specification.
3. Read `docs/PROGRESS.md`, `docs/BUILD_OVERVIEW.md`, `docs/RELEASE_VALIDATION.md`, `docs/FEATURE_MATRIX.md`, `docs/NEXT_TASKS.md`, `docs/P0_GAPS.md` and `docs/KNOWN_ISSUES.md`.
4. Read `docs/DECISIONS.md`, `docs/ADR/0002-browser-only-product.md`, `docs/ADR/0003-continuous-playable-development.md`, `docs/API.md`, `docs/RELEASE.md` and `docs/BACKUP_RECOVERY.md`.
5. Inspect the actual GitHub checkout, current HEAD, versions, migrations and tests. If development advanced beyond this handoff, preserve newer work and reconcile these notes with it.

Work autonomously on the next unblocked roadmap slice. Do not restart, redesign working systems, replace the master plan or merely produce another broad plan. No ChatGPT Library connector, private chat history or particular third-party skill package is required to develop this repository; instructions and maintained sources are included here.

## Product and architecture

Hearth is a private, self-hosted, game-neutral VTT aiming at the full original Roll20/Foundry-class roadmap. A DM-controlled **headless Rust server** owns authoritative state. Both DM and players use the same browser application. A browser tab does not itself host the backend; closing the DM tab must not stop it.

Codex cloud is the development workspace, not a change to Hearth's product hosting model. Retain Rust/Axum/Tokio/SQLx/SQLite, React/TypeScript/Pixi, the shared protocol and the current workspace UI. Do not introduce Tauri, Electron, native desktop shells, a second backend, mandatory cloud accounts or a paid VTT engine. Finished host distribution must require no Node/pnpm/Rust/compiler/database installation by end users; a ready-to-run headless bundle remains to be delivered. Players already use browser links without a native client.

Maintain ONE authoritative codebase and primary release line. Temporary branches, worktrees, debug/release builds and disposable test hosts are engineering tools. Integrate or discard temporary work; do not maintain separate development/playable products. Playability is an early milestone, not the end of the full roadmap.

## Cloud continuation ·2026-10-29

Current source is0.0.25/schema20/wire1, with direct text/eraser tools, vertical UI standard, private GM notes/shared briefings token HP/manual markers/context actions and private journal folders/search. Preserve the newer commits; the0.0.13 baseline below is provenance. Consult BUILD_OVERVIEW, PROGRESS and RELEASE_VALIDATION for the tested candidate and remaining gates. Image handouts now upload privately and reveal/hide through journal/media authority; selected-player journal grants now protect page/image access; bounded opt-in journal formatting/source preview and private actor/journal reuse now exist, with K021/K022 corrected; dedicated content-library and remaining initiative/P0 workflows follow next; use UI_STANDARDS for all new workspace controls.

## Exact handoff baseline

- Application **0.0.13** in package.json, Cargo workspace and the three workspace Cargo.lock entries.
- Database schema **11**, with migrations0001..0011. Wire protocol/schema version1 is a different version and must not be confused with the database schema.
- Original final source revision: `bc836eff85bc8096e3718c12998954da50c43382`.
- Tested implementation revision: `6ca53d183841d5fa5a1b022a324a7d410e4b2ef4`; later edits recorded documentation/delivery evidence only.
- Recovered pre-handoff archive SHA256: `394b7ee55745fea08d3879a8480f2a28e8a2a590c8728d148b15ab140903458d` (223 files). Adding this guide changes the new archive's checksum, not the application version.
- This ZIP contains sources, assets, lockfiles, CI and documentation. It does **not** contain the old .git object database, dependencies, compiled host, generated web bundle or real campaign data. Historical SHA references are provenance; they may not resolve after importing into a fresh GitHub repository. The new GitHub HEAD becomes the integration reference.
- Status: **partially functional, not verified playable**. Automated candidate checks passed in the previous environment; manual P0/platform/distribution gates remain open.

Included vertical slices: accounts/login, campaign library and invitations, protected map uploads/private scenes, tokens and ownership, generic character/NPC sheets, linked token movement, manual shared fog, ruler/pings, saved shared/GM-only lines and rectangles with undo, scoped dice, chat/whispers, journals, generic combat and whole-host backup/isolated recovery. Partial feature states in FEATURE_MATRIX are deliberate; preserve every ID and do not mark broad features VERIFIED based on a small slice.

## Most recent implementation and pitfalls

0.0.13 fixed player-map startup under multiple browser clients. Perpetual Pixi redraws of unchanged scenes competed with later renderer initialization in software WebGL. `SceneCanvas.tsx` now uses `sceneRenderLoop.ts`: coalesce visual changes into a frame, animate live pings, return to idle. Preserve invalidation for assets, pan/zoom/fit, selection/movement, fog/drawing previews, ruler clearing, ping expiry and future tools. Do not restore the perpetual ticker or ship the temporary10FPS diagnostic throttle.

A review found that stopping the ticker also removed implicit recovery after WebGL context restoration. A listener now invalidates on `webglcontextrestored` and is removed on cleanup. The real regression forces loss/restoration, checks automatic redraw, exact pre/post canvas pixels and return to idle. Disposed scenes must never render or apply late asset completions.

Faster browser runs also exposed shared authentication-history dependence: the11th auth attempt inside60seconds correctly received429. Seven independent later foundation scenarios now use `tests/e2e/isolatedHost.ts` with their own temporary host/data/allocated loopback port and browser cleanup. The first3 foundation scenarios intentionally share their campaign. Keep production rate limits and every assertion intact; do not replace this with sleeps, retries, bypasses or skipped tests.

The shared verifier honors custom CARGO_TARGET_DIR and explicitly selects the optimized host for release browser/recovery fixtures. A workflow fixture that assumed the default target directory was corrected. An original output tree once failed optimized linking; an identical fresh target build and complete validation passed with the same pinned compiler and thin-LTO profile. Reproduce failures before blaming caches; do not change optimization or sum passing subsets to manufacture a green gate.

## Cloud environment and repository import

Import the **contents of the extracted hearth-vtt directory as the GitHub repository root**: package.json, Cargo.toml, AGENTS.md and this file should be at its top level. Include the existing .github workflow and configuration files. Uploading just the ZIP is not the intended source-tree import. Keep the repository private, following the owner's existing project policy. This handoff does not create, push or publish a GitHub repository.

Connect the intended repository in Codex cloud, prepare the environment, inspect setup/check results and then start a task. Official current guidance: [Codex Cloud](https://learn.chatgpt.com/docs/cloud), checked2026-10-27. UI labels can change; repository instructions and locked project toolchains remain the source for Hearth setup.

Use Node24 LTS, pnpm11.25.0 and Rust1.99.1 with rustfmt/clippy, as pinned in the repository. Linux needs a C compiler/linker for bundled SQLite and browser system dependencies. Use the available environment installers; if rustup/pnpm are missing, install them through their legitimate official distribution before these commands. Do not silently downgrade manifests/lockfiles because a container lacks a tool.

From the repository root, dependency preparation is:

```sh
npm install --global pnpm@11.25.0
rustup toolchain install 1.99.1 --profile minimal --component rustfmt --component clippy
pnpm install --frozen-lockfile
cargo fetch --locked
pnpm exec playwright install --with-deps chromium
```

Skip the global pnpm install if the correct version is already available. Configure required registry/toolchain/browser download access in environment setup. Do not add an application cloud dependency. No OpenAI API key or production campaign credentials are needed for normal development/tests. Configure persistent environment values through the environment settings, or explicitly set them on each command; do not rely on an old temporary directory or a prior shell's exports.

Use the current Playwright browser first. The previous environment's default Chromium156 archive download was invalid; official Chromium141.0.7390.37 was used via `HEARTH_CHROMIUM_EXECUTABLE=<actual installed binary>`. That was a recorded fallback, not a claim about current-browser support. Never copy an old /tmp binary path into this environment, disable assertions, or call an unavailable-browser run passed.

## Run and validate

```sh
pnpm try              # source launcher, host defaults to127.0.0.1:8787
pnpm dev              # separate host/web development processes
pnpm verify           # complete shared debug validation
pnpm verify:release   # complete optimized candidate validation
```

See START_HERE.md for manual source startup and separate-player sessions. Use disposable data roots, not real campaigns, during cloud work. Test host ports/roots are managed by the harness. Run browser suites/capture harnesses sequentially to avoid shared output/port/resource interference. Current browser tests intentionally use one worker.

`verify:release` checks version consistency, workflow tests, lint, types, TypeScript tests, Rust formatting/Clippy/workspace tests, all179 feature IDs, the complete web/host build and the complete browser suite. It strips inherited live-host settings and selects the matching candidate executable for every browser/recovery host. `pnpm test:e2e` is a browser-iteration command, not the complete release gate; `--list` proves no checks ran. CI uses the same optimized gate on Linux/Windows, but remote CI was not run in the prior chat.

Previous actual0.0.13 evidence, **not a fresh result for your new cloud environment**:

| Check                               | Recorded result                                           |
| ----------------------------------- | --------------------------------------------------------- |
| Node workflow tests                 | 7 passed                                                  |
| TypeScript tests                    | 63 passed, including4 render-scheduler tests              |
| Rust workspace tests                | 77 passed in one complete run                             |
| Types/lint/Rustfmt/Clippy/inventory | Passed;179 IDs retained                                   |
| Web and optimized host builds       | Passed                                                    |
| Complete browser suite              | 13/13 passed,4.2minutes, Linux/Chromium141/software WebGL |
| Real screenshots                    | GM1600×1000, player1440×1000, narrow760×700 inspected     |

Re-establish the baseline in the new environment before changes. Use CARGO_INCREMENTAL=0 where investigating stale artifacts. If appropriate, set CARGO_TARGET_DIR to a fresh build directory and rerun the **whole** command; the verifier will select that directory's candidate. Failed/unperformed required checks block promotion. Keep failures named and visible, even if unrelated to new code. Windows/macOS, current browser matrix, physical LAN/WAN, portable packages and the complete30-minute/P0 session remain unverified.

## Next implementation plan — resume here

Follow NEXT_TASKS and P0_GAPS; this sequence elaborates them without replacing the master plan. Make small integrated increments; do not attempt the entire list in one change.

### Next slice: bounded freehand drawing (MAP-04)

1. Inspect current drawing commands/models,64-drawing scene cap, permissions, fog projection, persistence and undo. Relevant entry points: `crates/domain/src/lib.rs`, `crates/server/src/drawings.rs`, `crates/server/tests/cases/drawings.rs`, `packages/protocol/src/index.ts`, `packages/protocol/src/drawings.test.ts`, `apps/web/src/features/DrawingControls.tsx`, `SceneCanvas.tsx`, `Table.tsx`, and `tests/e2e/drawings.spec.ts`.
2. Define/document bounded points, coordinate validation, payload/storage/snapshot limits and simplification behavior before exposing the control. Preserve GM authoring authority and shared/GM-only privacy; keep strokes in scene coordinates across zoom/pan. Decide routine implementation details from the existing architecture.
3. Write failing tests, then implement host/domain/protocol/storage/rendering and real pointer/cancel behavior as one usable slice. Reuse authoritative commands/receipts/current projections. If persistence changes, add the next unused forward migration; never edit published migration0011 or assume schema12 is still unused after newer work.
4. Preserve conservative fog filtering, old drawings and undo, restart/reconnect and older-backup validation/upgrade. Extend maximum-combined-snapshot bounds/tests as needed. Do not expose an unfinished tool.
5. Run complete integrated validation and actual GM/two-player rendered tests; refresh progress/matrix/known issues/build overview and produce the next functional update. Fix regressions first.

### Following canvas slices: text and scene notes (MAP-04/05)

Add bounded literal text with appropriate input/coordinate validation, persistence, layers/privacy and readable rendering. Then implement scene-linked notes using an explicit server-authorized data model and existing journal patterns where suitable; do not save campaign notes only in browser state. Keep rendering on change and cancellation/scene-switch behavior correct. Add migrations/compatible backup handling only when required by the actual model. Rich text, individual editing/reordering and advanced measurement remain roadmap work; do not overclaim these from a minimal control.

### Finish remaining playable P0 work

Continue token HP/resource/status/context controls (TOK-03); handout/folder/reusable-content workflows and remaining initiative/status tasks; owner dashboard, network diagnostics and actual connection presence/count. A member list is not online presence. Follow dependencies in the feature matrix.

Develop and verify a ready-to-run headless host package with matched web/runtime assets and browser setup. No native desktop UI and no development-tool/database installations for the finished host package. Verify Windows/macOS/startup/firewall/current-browser behavior on actual targets; cloud Linux alone cannot establish those results.

Complete master US-01..05/08/12: one GM and two independently authenticated players, a real30-minute encounter, usable rendered tabletop/sheets/chat/dice/combat, authorization/privacy, acknowledged saves, reconnect/restart and compatible backup/restore. Perform a real LAN join; three localhost contexts are not that test. Only then designate a playable milestone/P0_RELEASE_NOTES. Generic sheets/manual D&D adjudication can precede full rules automation.

### Continue the full roadmap afterward

Master phases remain: rich2D mapping/walls/doors/vision; expanded dice and generic rules/SRD provenance/character automation; GM preparation/journals/media/audio; secure remote and optional A/V; levels/regions/effects; sandboxed modules/macros/homebrew; cross-platform/reliability/accessibility/localization hardening; optional stretch only after foundations. Read the complete master inventory rather than treating this paragraph as a scope reduction. Playability never means development is finished.

## Campaign and release protection

Use temporary databases or explicit copies. Never test destructive changes on live campaigns. Retain versioned migrations and verified pre-migration snapshots; a DB snapshot alone does not back up artwork. Before real updates, stop the host, retain its matched executable/web/configuration and a verified complete data/artwork backup, test upgrade/restore on a copy, then deliberately switch installations.

Rollback restores a compatible previous **application + web assets + data + artwork + configuration** pair. Do not run an older host on an assumed-compatible migrated DB or overwrite failed-update data. Existing recovery creates a separate restored copy, preserves accounts/passwords/game ACLs and resets sessions/unused invites there. It is not automatic application rollback. See BACKUP_RECOVERY and RELEASE for limits/procedure. Do not commit campaign databases, artwork uploads, credentials or generated build/dependency directories to GitHub.

After every completed update, report a brief cumulative feature overview, new behavior, exact tests run, remaining blockers and next slice. Provide a real app screenshot for gameplay/UI updates using fictional test data. Update the existing evidence documents; distinguish automated success from manual acceptance and do not invent percentage-complete claims.

## Suggested first task to send Codex

Read AGENTS.md and CODEX_HANDOFF.md, then the linked master plan and current evidence. Inspect the actual checkout and establish the0.0.13 baseline without discarding newer work. Continue the next unblocked P0 slice: bounded freehand drawings, integrated with the existing host, persistence, permissions, fog and renderer. Preserve one evolving Hearth, run the complete applicable validation, update progress documentation and report actual results. Do not redesign/restart the application or maintain a separate playable edition.

## Scope of this repack

This delivery adds the handoff and entry-point links only. App0.0.13, schema11, gameplay, dependencies, migrations and feature states are unchanged. Prior test results above are carried evidence, not tests rerun during this documentation-only repack. The complete original master plan and project documentation remain included.
