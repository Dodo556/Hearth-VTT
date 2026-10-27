# Project Hearth / Codex agents

For migration/continuation in Codex cloud, read `CODEX_HANDOFF.md` first, then the authoritative master plan and current evidence required below. The handoff supplies setup and the next implementation slices; it does not replace the roadmap or permanent policy.
1. Read `PRIVATE_VTT_CODEX_MASTER_PLAN.md`, `docs/PROGRESS.md`, `docs/FEATURE_MATRIX.md`, `docs/NEXT_TASKS.md`, and `docs/DECISIONS.md` before working.
2. The DM-hosted Rust server is authoritative. Filter secrets before serialization and authorize every campaign read and mutation.
   Product direction is browser-only for both DM and players. Read `docs/ADR/0002-browser-only-product.md`; do not add Tauri, Electron, desktop shells, tray UI or Windows/macOS application installers. A headless hosting server is still required.
3. Work in verified stages: real UI, real API, local persistence, authorization and tests. Continue the top unblocked task autonomously.
4. Preserve every master-plan feature ID. Only VERIFIED means complete; partial features remain IN_PROGRESS.
5. Run relevant checks, record evidence and update progress documents. Never claim unperformed Windows, LAN, WAN or multi-client verification.
6. Bundle runtime assets locally. No cloud dependency, telemetry, paid VTT engine or proprietary game content.
7. Keep this private source project; do not publish or choose a public code license without the owner's instruction.
8. After every build/update/release, give a short overview of what the current build includes, what is still pending, checks actually run, and the next stage. Keep `docs/BUILD_OVERVIEW.md` current.
9. Finished user distribution must require no Node.js, pnpm, Rust, Visual Studio or database installations. Deliver a ready-to-run headless server package, preferably extract-and-run. All DM/player UI remains browser-based; source tools are development-only. Do not claim portable packages are verified before actual platform tests.

10. Permanent engineering policy: read `docs/CONTINUOUS_DEVELOPMENT.md` and `docs/RELEASE_VALIDATION.md`. Maintain one Hearth source/release line. Debug/release configurations and temporary test environments are tools, never separate development/playable products. Preserve the last verified playable baseline when one exists; continue the full roadmap on that same application.
11. Use `pnpm verify` for shared integrated checks and `pnpm verify:release` for an optimized candidate. CI and shell wrappers use these same checks. Failed, skipped, stale or unperformed required checks block promotion; a source checkpoint is not a verified release. Keep unfinished UI safely isolated. Verify persistence/multiplayer/authorization and impacted previous flows; release success also needs the recorded manual platform/LAN/session gates.
12. Protect real campaigns: test only with temporary roots or explicit copies; retain versioned migrations, complete data/artwork backups and verified pre-migration snapshots. Rollback means a compatible prior executable AND web/data/artwork/configuration state. Never assume an older host can open a migrated database. See BACKUP_RECOVERY and RELEASE for the safe procedure.
