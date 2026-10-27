# Hearth VTT · Build0.0.14

Continuing development in Codex cloud/GitHub: read [CODEX_HANDOFF.md](CODEX_HANDOFF.md) for setup, current evidence and the next implementation plan.

Hearth is one continuously evolving application. Source/debug and optimized builds are configurations of the same code, not separate editions. The permanent policy is in [CONTINUOUS_DEVELOPMENT](docs/CONTINUOUS_DEVELOPMENT.md); current promotion blockers are in [RELEASE_VALIDATION](docs/RELEASE_VALIDATION.md). Build0.0.14 adds bounded persisted freehand while retaining the player-canvas startup and WebGL restoration corrections; verified-playable promotion still requires the recorded P0/platform gates.

Build0.0.14 renders static scenes on change and keeps active pings animated. Player maps, ruler/zoom, drawing restart and context restoration have real browser regressions. Shared/GM lines, rectangles and bounded freehand strokes, color choices and undo are included and respect manual fog.

A private, self-hosted **web application** under development. The DM runs the hosting server and opens the DM interface in a browser. Players open an invitation link in their browsers; no player installation is required. There is no separate Windows/macOS desktop app planned. This increment supplies accounts, saved campaigns, one-use player invitations, custom private scenes/map uploads, generic actor sheets and permissions, linked token control, synchronized movement, shared manual fog, ruler/pings, host-generated private/blind/selected dice, chat/whispers, journals, generic combat and whole-host backup/isolated recovery. **It is not yet a playable VTT or release 0.1.**

The Rust/Axum process is the web server, not a native desktop interface. The same React application serves both DM and player roles. The server must keep running, but the DM browser tab does not need to remain focused or open. Browser-based hosting controls and a simple server-start workflow are the target; hosted internet access still requires secure network configuration.

## Run locally

Prerequisites: Node **24 LTS**, pnpm **11.25.0**, and Rust **1.99.1** (pinned by `rust-toolchain.toml`). On Windows, install the Visual Studio C++ build tools and Windows SDK required by the Rust MSVC toolchain. SQLite is bundled by SQLx; no database server or cloud account is needed.

Install pnpm once with `npm install --global pnpm@11.25.0`. Then run:

```sh
pnpm try
```

Or double-click `START-HEARTH.cmd` on Windows. This installs locked dependencies, builds the browser UI and starts the Rust host. The first build can take several minutes. The step-by-step [run and test guide](START_HERE.md) covers prerequisites, testing a player in a separate browser session and LAN configuration.

Open **http://127.0.0.1:8787**. Create the owner account, keep the sample-campaign checkbox enabled and explore The Amber Keep. Keep the Rust service running. Stop it with Ctrl+C; committed data stays in the host's user-data directory.

For development with hot reload, run `pnpm dev` and open **http://127.0.0.1:5173**. The Vite client proxies HTTP and WebSocket `/api` to the Rust host. All dependencies are bundled for production; a built session makes no required calls to external services.

## What works

- Owner setup/login/logout with Argon2id passwords, opaque revocable sessions and CSRF/origin checks.
- Campaign create/open/rename/archive/unarchive, local SQLite persistence and membership-scoped reads.
- DM-approved one-use expiring/revocable invitations for new player accounts; per-campaign access revocation.
- Local straight-line ruler in grid squares and brief shared map pings, with mouse and keyboard controls.
- PixiJS sample map, local pan/zoom/fit, two shared tokens and a DM-only token, DM-authored shared/private plain-text journals and protected original artwork. Live changes preserve local camera state.
- Live token drag/grid snap, arrow keys and numeric movement; DM player assignment and hide/reveal, authorized reconnect, saved revision/duplicate-request protection and verified pre-upgrade database snapshots.
- Private draft scenes with protected PNG/JPEG/WebP upload, local DM scene selection, explicit activation/concealment and square-grid sizing.
- Token create/edit/delete, uploaded or original art, name/size/position/visibility and assigned-player control. DM preparation stays off the player stream until activation.
- Dark interface, high contrast, reduced motion, keyboard forms and native modal focus containment.

Generic Character/NPC sheets now support portrait/biography/HP/custom properties/private DM notes, observer/owner permissions, linked tokens and versioned edits. Scene rename/delete are available. Manual fog, five-scope host dice, saved chat/whispers and journal authoring are included. Generic combat now supports manual initiative, turns/rounds and authorized linked HP. Whole-host backup/verification/isolated recovery are now available. Inventory/system rules and the complete P0 gate remain pending. The finished host must require no development-tool/database installations; ready-to-run portable packaging is not delivered yet. Physical LAN, Windows server execution and internet hosting are not verified. See the [current build overview](docs/BUILD_OVERVIEW.md), [progress](docs/PROGRESS.md), [next tasks](docs/NEXT_TASKS.md), [known issues](docs/KNOWN_ISSUES.md) and the full [master specification](PRIVATE_VTT_CODEX_MASTER_PLAN.md).

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm check:features
```

Playwright runs five scenarios against the compiled Rust service with an isolated temporary data root and separate DM/player browser identities: the live foundation, custom scene authoring, and navigation during an unacknowledged drag. `HEARTH_CHROMIUM_EXECUTABLE` optionally selects an already installed compatible Chromium binary. The build environment required that override because the newest browser downloads were unavailable; see `docs/PROGRESS.md` for the actual tested version.

For hosting server development and the complete API, data locations and backup procedure, see [hosting](docs/HOSTING.md), [API](docs/API.md) and [backup/recovery](docs/BACKUP_RECOVERY.md). The owner has not selected a public distribution license; this source bundle is private development work.

Saved public chat, private group whispers, chronological roll cards and selected-recipient dice are included. Chat → Whisper selects1–8 other current participants; DM receives it only if selected. Existing private/GM/self/blind rolls remain. Both composers keep privacy/drafts across dock tabs. Chat text is literal and bounded; no rich text or chat slash commands yet. A real screenshot can be captured against an isolated fictional demo with `node scripts/capture-preview.mjs /absolute/preview.png` after building the host/web bundle.

Build0.0.9 replaces the table dashboard with a compact VTT workspace: scene tabs, Select/Pan/fog tools, resizable/collapsible sidebar, floating token/combat windows and privacy-preserving quick-dice preparation. Combat is persisted and host-authorized; hidden tokens/fog/actor fields are filtered before delivery. Open Combat to prepare an encounter, add tokens and set initiative. See DM_GUIDE for the complete current workflow.

Build0.0.10 adds **Backup & recovery** for the host owner, available from the library and table header. Download a full host snapshot, verify a .hearthbackup file and create a separate recovery folder. No live overwrite; restart with that data directory. See [backup/recovery](docs/BACKUP_RECOVERY.md) for format, limits, privacy and actual startup instructions. [P0 gaps](docs/P0_GAPS.md) remain open.
