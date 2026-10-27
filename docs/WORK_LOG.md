# Stage 1 execution record

Plan: `docs/superpowers/plans/2026-10-22-foundation.md`. Spec: the supplied master plan and foundation design. Existing workspace contained the attachment only, no repository/application/dependencies or instructions to preserve. A new `hearth-vtt` repository on `stage-1-foundation` isolates this project from the upload.

## Task 1 · host and storage

- Health acceptance test initially failed 404 versus expected 200.
- Storage initialization test initially failed because `users` did not exist; implemented SQLx migration, WAL/FK and exclusive root lock.
- Owner/auth tests initially failed 404 versus expected success/unauthorized. Implemented atomic setup, Argon2id, hashed revocable sessions, origin/CSRF/Host validation, bounded password work and generic errors.
- Added campaign/invite tests; projection test initially failed because routes were absent. Implemented protected scene/journal/art projection and transactional one-time invitations.
- Ten Rust integration tests plus one storage test pass, including setup/redemption races, restart, expiry, revocation, isolation and request bounds. Exact commands in PROGRESS.

## Task 2 · browser

- Three protocol rejection tests initially failed because unrestricted schemas accepted invalid responses; implemented strict version/shape/role checks.
- Real API client, owner/login/join forms, campaign management, native dialogs and original Pixi sample. No mock backend.
- Typecheck, recommended lint, protocol tests and production Vite build pass. Lazy-loaded eval-free Pixi preserves CSP and keeps the primary UI bundle below the build warning threshold.

## Task 3 · review and handoff

- Three independently authenticated real browsers completed setup, invitation, sample rendering, secret projection, access revocation, Unicode campaign create/archive and logout/login against built UI + actual Rust server.
- Fresh read-only review of commit 5b57841 found no backend critical defect and one important cache-boundary defect. Cross-tab identity-switch regression reproduced retained private journal UI (expected 0 private buttons, actual 1). Fix: protected QueryClient keyed by identity and cleared on unmount, with background session checking.
- Review minor (deferred): add the finer boundary assertions listed in K007; current code paths were judged correct, but evidence needs strengthening.
- Review exclusions retained as scope decisions: full gameplay, private unpublished scene authoring, existing-account/recovery workflows, retroactive erasure of downloaded data, native/physical LAN/TLS verification, future migration/backups/uploads/plugins and hostile local OS access. These remain future gates, not completed work.
- Decisions carried: retain Rust/local hosting; CLI before Tauri costs a future Windows lifecycle slice; one-use invitations preapprove one new account and cost a separate existing-account redeem/rejoin flow later. No public publication or public license choice.
- Final regression/build/check output and source checkpoint are recorded in PROGRESS. No master feature is promoted to VERIFIED for partial implementation.

Final: fixed identity-cache leak — cross-tab regression RED (private journal remained) → GREEN (identity-keyed protected cache); full 11-test Rust suite, 3-test protocol suite and three-client browser scenario pass. Final: minor (deferred): K007 security boundary assertions; next-task entry retained.

## Browser-only product correction

The user permanently removed native desktop app work. Updated the working master plan, guidance and roadmap to make the DM and players browser users of the same web app, retaining the headless Rust server. Removed the obsolete desktop-shell placeholder and corrected browser hosting help. Prior Tauri references in this historical record describe superseded decisions, not future instructions. All 179 feature IDs remain; host distribution is now server/browser delivery. Source startup uses the existing `pnpm start` entry point.

## Build 0.0.2 · live foundation · 2026-10-23

Plan: docs/superpowers/plans/2026-10-23-live-sync.md; spec: docs/superpowers/specs/2026-10-23-live-sync-design.md. Baseline700de4a. Existing stage-1-foundation branch retained; unrelated executable-bit changes in scripts/dev.sh and scripts/test.sh preserved outside the commit.

Task1 complete: v1 upgrade fixture, verified pre-migration backup/checksum, migration0002, command and client validation. Task2 complete: new real TCP tests first failed404; live authoritative command/subscription implementation then passed. Task3 complete: browser acceptance first failed missing live UI, then offline-state regression failed Live vs Reconnecting; explicit offline pause/reconnect handling passed. Main real browser scenario proves numeric, keyboard and drag controls, camera preservation and DM-tab independence. Task4 complete: fresh whole-change review, material regression fixes, checkpoint docs and private source archive.

Ruling: reconnect always gets a fresh filtered snapshot instead of historical privileged replay — simplest safe current boundary; cost is a larger reconnect transfer until scoped replay is separately verified. Ruling: implement movement/ownership/visibility on existing sample tokens to prove T008 end to end — arbitrary uploads/actors/authoring retain their complete next-stage scope; cost is that only the sample table is editable now. Ruling: retain the existing private branch and package source — autonomous staged user instruction already authorizes a local checkpoint; no integration menu/public actions are needed.

Final: fixed queued ACL/visibility race — concealment_during_a_write_filters_later_queued_frames and revocation_during_a_write_stops_later_queued_frames RED→GREEN; reauthorize between awaited frames, five-second batch deadline. Final: fixed stuck pending busy state — useCampaignStream hook regression RED→GREEN. Final: fixed transient artwork recovery — injected first map/token download failures in the real browser RED→GREEN; retry without replacing the renderer/camera. Full Rust18/18, TS8/8, three-browser scenario1/1 pass.

Final: minor (deferred): K011 pending drag completion may reconcile destroyed containers after unmount; add a lifecycle regression/guard before expanding authoring. Review was one fresh read-only pass; no re-review dispatch. Scope decisions and actual limits are in DECISIONS, KNOWN_ISSUES and PROGRESS. User's requested cumulative build overview is now a recurring AGENTS rule and BUILD_OVERVIEW document.

Final: fixed hidden/unknown command existence distinction — forged hidden move vs random token ID regression RED (FORBIDDEN vs NOT_FOUND) → GREEN after the mutation lookup filters hidden rows; no receipt/revision created. This extends the material privacy fix pass, while K007 retains other future HTTP boundary coverage.


## Build0.0.3 · custom scene authoring ·2026-10-23

Baseline: recovered verified saved source0.0.2 in commit1d40673; existing private branch retained and two preexisting script mode changes excluded. Spec/plan: docs/superpowers/{specs,plans}/2026-10-23-scene-authoring*.md. Extend existing live commands/storage, not a new product scaffold.

Task1: canonical bounded raster upload, campaign-owned assets/quotas/dedupe/protected streaming and migration0003. Upload test RED404→GREEN; incremental embedded migration assertion/build.rs, malformed media query and real JPEG/WebP/quota checks resolved. Task2: private scene create/activate/conceal and token create/update/delete through existing atomic revision/receipt commands; protocol RED→GREEN and API/TCP/restart tests. Task3: local DM preparation UI, map upload, token editor/controller/visibility; real browser custom-table and pending-drag lifecycle regressions. K011 reproduced page error against disposed Pixi containers, then disposed guard GREEN.

One fresh whole-change review; no re-review dispatch. Fixed Important findings with RED→GREEN regressions: historical private draft events after activation during an awaited write; inconsistent authorized REST projection; per-response whole-image buffer amplification; stale edited token turning into create form. Invalid payload busy lock regraded material and fixed with hook RED→GREEN. Minor K012 delayed cancelled-dialog local selection is deferred. Final privacy sweep reproduced unfiltered campaign summary scene counts and filtered both detail/list SQL with a regression. No private preparation count reaches players.

Rulings: only active shared scene reaches players (no player scene browsing yet); actor ownership/linking next rather than unused placeholders; canonical PNG and bounded uploads (large/animated maps/media management deferred); private branch checkpoint only. Full-data backup includes uploaded blobs; automatic migration snapshots are database-only. Runtime assets remain local.

Verification: Rust24/24, TS11/11, browser3/3 (DM/Alice/Bob foundation, custom map authoring, delayed drag navigation), lint/types/build/format/179 IDs, production npm audit, Cargo metadata, Linux launcher health/start/stop. Windows/macOS/LAN/current browser matrix/full restore and sustained hostile load remain unverified. Exact current output in PROGRESS; source package excludes binaries, local stores and internal screenshots. Next: actor ownership/linking/scene management, then manual fog. User run/test instructions follow the implementation overview.

## Build0.0.4 ·2026-10-24

Actor model/sheets/ownership/token links, scene rename/delete and versioned edits restored and verified after workspace reset. One fresh pre-reset review found stale rename overwrite (fixed with server expectedName and real two-tab regression); Minor K013 emoji input limits deferred. K012 cancelled dialog and uncorrelated protocol error regressions RED→GREEN. Isolated browser assets avoid source-build mismatches. Final recovered Rust28/TS14/browser5, types/lint/build/format/179 inventory and Linux launcher start/health/shutdown pass. Full details/rulings/limits: PROGRESS. No new dependency/public action; no-development-tools final packaging requirement recorded. Next: manual fog.

## Build0.0.5 ·2026-10-24

Shared manual fog with persisted packed grid, rectangle/keyboard authoring, full-footprint token/media/movement filtering and event-time hidden-history protection. Rust32/TS18/browser6 pass with matching isolated browser/host builds. One fresh reviewer found no blocker; K014–K016 UI polish deferred. Full background disclosure and independent actor grants retained. Source launcher final smoke and archive validation recorded in PROGRESS. Next T013 server dice/private rolls.

## Build0.0.6 ·2026-10-25

Restored saved0.0.5 after workspace reset, then T013 typed host dice/private history/rate records. Four scopes, standard quick dice, current authorized history and persistent audit. One fresh review found creation-ID existence probing; host-owned result IDs/caller-scoped nonces and migration0007 fix it. Tab privacy reset regraded/fixed with a real browser RED regression. Fixed-source Rust42/TS21/types/lint/clippy pass; final full browser/launcher/archive evidence in PROGRESS. Two new Minor limits K017/K018 deferred. Next T014 chat/whispers/selected recipients/journal editing. Source remains private and developer-built.

## Build0.0.7 ·2026-10-25

Recovered exact saved0.0.6 after scratch cleanup; baseline Rust42/TS21 passed. Under the user's usage constraint, implement one bounded T014 journal slice: DM-only private create, guarded edit/delete and explicit shared/concealed projection. New migration0008 preserves old bytes/version1. Real host/protocol/UI RED→GREEN; keep existing20-frame flood limit and adjust the oversized fixture by reconnecting. Final Rust44/TS24, types/lint/build/clippy/format/179 IDs pass; matched full browser8/8 passes in5.1minutes. One focused fresh read-only review: no Critical/Important; existing K013 emoji-limit mismatch deferred. Plain text/whole-party sharing and later portable/platform gates retained, with costs in DECISIONS. Next chat/whispers/selected dice recipients. Private source only; no merge/push/deploy.

## Build0.0.8 ·2026-10-26

Restore saved0.0.7/version11 after scratch cleanup; baseline Rust44/TS24 green. Add bounded persisted public chat/private groups, member directory without usernames, selected dice/immutable recipients and chronological Chat roll cards.0009 preserves old dice JSON/nonces, extends CHECK and adds independent millisecond rate records. Server/DTO/cache/composer/selected Dice RED→GREEN. Rust49, TypeScript31, types/lint/build/clippy/format/179 IDs pass. One fresh review: fix duplicate-name recipient ambiguity with expanding stable account labels in selection, summaries and authors; targeted REDs +31-test green suite. Correct inaccurate COM dependency-column metadata updates and stale guides in the same final pass. Full browser initially showed selector/revocation-copy issues, then a concurrent-preview software-renderer startup stall and downstream fixture failure; inspect traces, retain timeouts/assertions, final isolated9/9 PASS5.7min. Real1600×1000 screenshot uses isolated fictional Game Master/Alice/Bob data and actual commands. No generated mockup, real personal data, extra dependency, public release or portable claim. Next T015 combat and full recovery/P0 gates.

## Build0.0.9 ·2026-10-26

Recover exact saved0.0.8/version12 after scratch cleanup; baseline Rust49/TS31 green. User requested a structural VTT interface, continued planned development and actual screenshot. Implement compact extensible shell/typed panels/preferences/nonmodal windows/stable portal, neutral scoped theme and unchanged renderer/camera; persisted generic scene encounter/manual initiative/linked HP via0010/current projections. One independent backend implementer; parent owns frontend/integration. No new dependency/native shell/public action. First full browser7/10 exposed one lost pending-drag catch and two changed-layout workflow assumptions; fix callback and explicitly open Journal/close inspector before painting. Fresh whole-change gpt-6-astra/high review found3 Important; HP identity/CAS, snapshot-before-ACK form versions and parent-size popup bounds reproduced RED→GREEN in one fix pass, no rereview or new deferred minor. Final locked nonincremental Rust58/TS43/types/lint/build/fmt/clippy/179 IDs pass; matched isolated browser10/10 PASS8.0min. Final actual fictional screenshot capture follows browser acceptance without competing renderers. Generic combat remains partial; recovery/P0/LAN/portable packages remain next gates. Decisions/costs and exact checks in DECISIONS/PROGRESS.

Final capture PASS: actual1600×1000 desktop and760×700 narrow view visually inspected, populated real combat/chat and original art, fictional preview accounts, no page errors. Source package contains181 tracked files only, with prior source identity retained at handoff. All rulings copied to durable docs; only this plan’s ignored temporary ledger is removed.

## Build0.0.10 ·2026-10-26

Exact0.0.9/version13 recovered after maintenance cleanup; Rust58/TS43 baseline passes. Implement T015 full-host snapshot/format/canonical-schema/PNG/hash/FK validation and isolated marker-protected recovery, then owner-only API with streaming files/one operation and lazy VTT/library tools. Missing storage/API/protocol/UI REDs→GREEN. One fresh whole-change review found3 Important, no Critical/Minor; all reproduced/fixed in one pass without rereview. Complete schema comparison, pre-extraction startup marker and locally file-bound verification close the findings. Full Rust71/TS49/types/lint/clippy/format/build/179 IDs pass. Full browser11/11 PASS8.1min; final storage-only schema-maintenance enhancement also passes full Rust71/clippy/build and recovered-host browser1/1 in52.8seconds. Final actual1600×1000 desktop/760×700 narrow recovery screenshots inspected after browser acceptance; no competing renderer or personal data. Native inline work, same244 pinned registry dependencies,196 tracked source files, private source checkpoint, no public action. Exact evidence/costs/limits in PROGRESS/DECISIONS; canvas/token P0 gaps and ready-to-run distribution remain next.

## Build0.0.11 ·2026-10-27

Restored exact saved0.0.10/version14. Implemented local grid-square ruler and bounded transient active/revealed-scene pings in existing renderer/live stream, with mouse/keyboard, current authorization and no schema or registry changes. Real-socket and UI/protocol tests RED→GREEN; initial three-client browser pass. One fresh read-only whole-change review found repeated Enter could exceed the socket frame budget; client cooldown and repeat suppression added with RED→GREEN coverage. Visual inspection identified the old workspace hiding new tool instructions and an overlapping ping badge; both adjusted and browser assertions added. Final Rust72/TS56/types/lint/clippy/format/build/179 IDs PASS; matched Chromium141 full browser12/12 PASS7.8min. Actual1600×1000 desktop and760×700 narrow screenshot visually inspected after responsive fix. Full details/limitations in PROGRESS. Next: drawing/layers/scene notes and token controls.


## Build0.0.12 ·2026-10-27

Rebuilt persistent drawing layers after workspace maintenance removed the unfinished local work. Rust 77 across domain/server and storage runs, TS 59, the new multi-client drawing browser test and desktop/narrow captures passed. The older map-tool browser test did not complete: a player canvas remained loading after a 45-second wait in headless Chromium. See PROGRESS for the stale build artifact, review and precise verification scope.


## Permanent single-application policy ·2026-10-27

Inspected current saved 0.0.12 source/schema11, master, matrix, progress, release scripts, CI and recovery code. Found one existing host/client application, stale release wording and duplicated/debug-only validation paths. Established CONTINUOUS_DEVELOPMENT and ADR-0003; centralized checks/explicit browser host selection with seven meaningful Node tests, version consistency and live-root isolation. App version, gameplay, migrations and roadmap remain unchanged. Current playability stays blocked; see RELEASE_VALIDATION for fresh results and remaining gates.

## 0.0.13 / player canvas startup

Reproduced the unchanged real GM/two-player map failure; traced successful auth/snapshot/artwork and long renderer initialization. Temporary10FPS control passes; removed it and all diagnostic logging. Observed the idle GPU-draw regression fail before rendering-on-change, then pass with the original scenario. Scheduler4 tests missing-module RED→GREEN; TypeScript63/types pass. Strengthened actual canvas/ruler/zoom/ping and player drawing/restart assertions. Matched version0.0.13/schema11, no data/protocol/dependency changes. Exact final integrated/review/visual evidence is recorded in RELEASE_VALIDATION.md.

Final0.0.13: complete shared optimized validation PASS workflow7/TS63/Rust77/browser13 in4.2m, with types/lint/Clippy/inventory/full builds. Actual fictional GM1600×1000, independently connected player1440×1000 and narrow760×700 screenshots captured and inspected. One Important review finding fixed RED→GREEN (automatic restored-context redraw), no Critical/Minor or second review. Shared-host auth history failure resolved through independent scenario fixtures, not production rate changes or assertion relaxation. All179 feature states and11 migrations unchanged. Manual P0/session/LAN/platform/portable-host gates remain open.
