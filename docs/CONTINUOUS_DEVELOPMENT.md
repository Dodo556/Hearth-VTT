# One Hearth: continuous playable development

Permanent owner policy, established 2026-10-27. This clarifies the existing master plan; it does not replace its architecture, feature inventory, phase order or acceptance gates.

## One application and release line

Maintain one authoritative source tree, one primary integration/release line and one progressively improving Hearth. The Rust host and React/Pixi browser client are parts of that application. DM and player permissions are roles, not product editions. Development servers, debug/optimized builds, temporary branches, worktrees, previews and isolated test hosts build the same maintained source. Integrate or discard temporary work when finished. Do not create independently maintained development/playable forks.

Retain older releases and their compatible data for recovery, not as parallel products. Once a playable milestone is verified, every promoted update must preserve that usable baseline while adding capabilities. Playability is a milestone on the full roadmap, not the end of development. Keep all master feature IDs and the existing versioning scheme.

## Complete iterations and honest promotion

Integrate each feature into the existing application. Build the complete host and browser client; run relevant unit/integration tests and the existing browser regression suite, including the previously working flows affected by the change. Verify real rendered player views as well as server projections, synchronization, authorization, reconnect, acknowledged saves, restart and applicable upgrade/restore paths. Fix regressions before promotion. Keep unfinished code behind a safe boundary without broken or misleading controls.

A source checkpoint may preserve unfinished work, but it is not a completed functional iteration, a release candidate that passed validation, or a replacement for a working installation. Failed, skipped, stale or unperformed required checks block promotion. Do not sum passing subsets to imply a clean full run. Distinguish historical results from evidence for the exact candidate. No test timeout may be dismissed as an environment issue without evidence; no assertion may be removed merely to obtain a pass.

Use the shared checks documented in RELEASE.md. A successful automated gate still does not imply all manual platform, network, distribution or playable-session gates passed. Record version/source revision, schema compatibility, commands, actual results and test conditions for every candidate. Update PROGRESS, BUILD_OVERVIEW, KNOWN_ISSUES, NEXT_TASKS and the feature matrix without promoting partial features to VERIFIED.

## Become playable, then keep improving

Prioritize regressions, persistence/recovery and blockers of the master plan's Phase 1 encounter before optional feature expansion. The playable gate remains the original P0 feature scope and US-01..05, US-08 and US-12: one GM plus two independently authenticated players must complete the 30-minute encounter over an actual LAN, with usable rendered maps/tools, ownership, fog/privacy, sheets, chat/dice, combat and persistence/restart/recovery. Required platform/startup checks and the no-development-tools hosting distribution gate remain explicit. Generic sheets and manual D&D adjudication can serve the first tabletop; complete SRD automation remains on the later roadmap.

After that gate: existing playable Hearth → feature change → integrated validation → updated playable Hearth. P1/P2/P3 work continues on this same application. A blocked candidate leaves the last validated installation available.

## Campaign protection and update procedure

Keep real campaign data outside source, build, installation and temporary test directories. Test with generated data or an explicit copy. Never point automated tests, previews or destructive experiments at a live campaign root. Preserve published migrations; add versioned migrations and upgrade fixtures proving existing records survive. Prefer compatible changes; document unavoidable compatibility limits.

Before applying an update to real campaigns:
1. Validate the candidate application, including its optimized host/browser build and fresh-install plus backup/restore smoke. Record required platform/LAN/session evidence before calling it playable.
2. Stop the old host cleanly. Preserve its executable, matched web assets, version/schema details and external configuration. Make a complete backup of its data and artwork; verify recovery on a disposable copy. Do not copy only a running WAL database.
3. Keep the old installation and original data intact. Validate any migration using a cloned data root, check preserved accounts/permissions/content and rendered multiplayer behavior, then deliberately switch to the validated candidate. Do not silently overwrite a working installation.
4. The host's existing pre-migration SQLite snapshot/checksum is an additional safeguard, not a complete media backup. If snapshot verification or migration fails, stop the update and preserve the evidence and original data.
5. To roll back, stop the candidate and preserve its data separately. Restore the prior application AND a compatible pre-update data/artwork/configuration copy. Do not assume an older executable can open a newer database; do not point it at the migrated live root. Verify the restored pair in isolation before switching back. Changes made after the backup are not automatically merged.

Current whole-host archive recovery makes a separate restored copy, preserves stored accounts/permissions/content, and resets sessions/unused invites in that copy. It is recovery with a compatible host, not automatic application downgrade or automatic rollback. Schema support and bounds are in BACKUP_RECOVERY.md. Automated rollback, universal downgrade compatibility and portable distribution are not claimed merely because this policy exists.

## Current recorded status

The policy was established on saved application0.0.12/schema11. Current application0.0.25/schema20 adds private actor/journal reuse and corrects K021/K022 alongside opt-in safe journal formatting to selected-player grants, private-first image handouts/reveal/hide, private journal folders/search, token HP/manual status markers/context actions, scene-owned private GM notes/player briefings, drawing erasing/editing and the vertical UI standard. It remains partially functional, not verified playable: the complete Phase1 encounter, real LAN/current-browser/platform checks and ready-to-run host distribution remain open. See RELEASE_VALIDATION.md and NEXT_TASKS.md for exact current evidence and next work.
