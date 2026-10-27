# Hearth VTT · Build 0.0.13 · 2026-10-27

Corrected the recorded multi-player canvas startup blocker. Perpetual static Pixi redraws competed with later clients' initialization under software WebGL. An unchanged real scenario reproduced the failure; a temporary10FPS control confirmed the boundary and was removed. The renderer now coalesces scene/asset/camera/interaction changes into animation frames, animates live pings and stops when idle. Dragging and tools keep normal browser-frame responsiveness; no fixed FPS cap, timeout extension or removed player assertion. Disposal cancels pending frames.

A new real-GPU-call browser assertion failed before the fix and passed afterward; the original GM/Alice/Bob ruler/ping scenario passed21.0s. Four scheduler tests cover idle/coalescing, animation completion, disposal and changes during rendering. The extended final scenario also checks visible canvas pixel changes and resumed ping rendering; drawings/restart now assert real player renderer readiness.

One independent whole-change review found a lost-context redraw gap. A forced real WebGL loss/restore regression failed (draw count remained10), then passed after a restored-context invalidation listener was added with cleanup. The restored canvas matches its previous pixels and returns to idle; focused GM/two-player scenario27.2s. No second review or deferred minor.

A later complete run passed12/13 browser cases but character joining correctly received429 from the shared test host after11 cumulative auth attempts inside60seconds. Isolated the seven independent later scenarios into temporary selected-candidate hosts/data roots; left the production limiter and assertions intact. Focused character scenario passes24.0s. Final integrated evidence below supersedes this failed intermediate run only after a fresh complete pass.

Current version is0.0.13/schema11. No migration, persistent data format, protocol, authorization, dependency or architecture change. One application and the complete179-ID roadmap remain. Final integrated evidence: one complete `pnpm verify:release` run passes workflow7, TypeScript63, Rust77, types/lint/format/Clippy,179-ID inventory, full web/optimized host build and browser13/13 in4.2m. Actual GM/player/narrow screenshots were captured and inspected. See RELEASE_VALIDATION.md for source identity, conditions, failed intermediate attempts and the review correction. Actual Windows/macOS, physical LAN/WAN, current browser matrix, portable distribution and the complete30-minute/P0 acceptance remain open; this is not verified-playable promotion.

## Previous policy/workflow checkpoint

# Policy/workflow revision · 2026-10-27 · application 0.0.12 unchanged

Inspected the latest accessible saved source rather than relying on the previous reply: package.json and Cargo both identify 0.0.12, schema11. No second development/playable product exists in this source. Accepted the owner's single continuously evolving application policy; linked AGENTS/master/ADR/README and rewrote the stale release instructions. All 179 roadmap IDs and feature states remain.

Added one shared cross-platform verifier for local wrappers/CI, version consistency checks, fail-fast child execution, live-root environment stripping and explicit candidate host selection for all browser/recovery/capture fixtures. The optimized candidate uses the same source and browser suite. No gameplay/schema change or playability promotion. Seven new Node workflow tests were observed missing-module RED→GREEN, and the existing 59 TypeScript tests/typechecks pass in this session. Fresh lint, 179-ID inventory and web build also passed. `pnpm verify:release` then failed closed at the unavailable Cargo executable; no current Rust/optimized-host/browser release run is claimed. Actual blockers are in RELEASE_VALIDATION.md.

## Previous application checkpoint

# Hearth VTT · Build0.0.12 · 2026-10-27

Saved GM-created lines and rectangles on shared and GM-only layers, colors, undo and keyboard gestures. Schema 11 retains verification and isolated recovery of schema 10 backups. Workspace maintenance removed an unfinished local drawing update; this build was reconstructed from the saved 0.0.11 project.

## Verification · 0.0.12

- Rust: 60 domain/server tests and 17 storage/upgrade tests passed across workspace and storage runs. The workspace run initially found migration assertions still expecting 10; these were updated. A later workspace run picked up one stale executable from the workspace build cache; the current test was rebuilt in a separate target directory and passed with workspace features. A single clean final workspace-wide run is not claimed. The maximum combined snapshot includes eight scenes with 64 drawings each alongside existing maximum content.
- TypeScript: 59 tests passed. Typecheck, Biome, the 179-ID feature inventory, host/web builds, Rust formatting and Clippy passed.
- Chromium 141/Linux: the new GM/two-player drawing scenario passed, including role projection, undo, keyboard input and host restart. A desktop screenshot (1600×1000) and a narrow screenshot (760×700) were captured from the real app and inspected. The older map-tool browser regression did not complete in this environment: a player canvas was still loading after both the normal 15-second wait and an isolated 45-second wait. This leaves player-side Pixi rendering under that setup unverified; the drawing test checked the players’ live connections and server projections, not their rendered canvases.
- A fresh independent code review found no critical or important findings. Actual Windows/macOS, physical LAN/WAN, current browsers, the full browser regression and the complete playable-P0 encounter remain unverified.

## Previous checkpoint ·0.0.11

# Hearth VTT · Build0.0.11 ·2026-10-27

First MAP-05 slice: local straight-line ruler in scene grid squares and ephemeral DM/player pings. Toolbar modes, mouse/keyboard interaction, visible instructions and current scene/fog checks are included. Pings do not change revisions or survive reconnect. No database migration or new dependency. Full drawings/layers, scene notes, configurable units/path measurement, complete P0 and ready-to-run host packages remain pending.

Exact0.0.10/version14 source recovered; baseline Rust71/TypeScript49 passed. Real socket, protocol, stream, toolbar and geometry tests were observed RED→GREEN. Initial real Chromium141/Linux DM/two-player browser scenario passed, exercising pointer/keyboard ruler, zoom, unchanged token coordinates, bidirectional pings and a private preparation scene. A fresh whole-change review identified rapid repeated Enter/clicks exceeding the existing socket frame limit; client cooldown and repeated-Enter handling address it, with a dedicated RED→GREEN regression. Visual inspection also exposed an overlapping ping badge and CSS-hidden tool hints; positions and visible guidance were corrected with browser coverage.

## Final actual verification ·0.0.11

| Command/check                                                                        | Result                                                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                     | PASS; existing pinned registry packages only                                                            |
| `CARGO_INCREMENTAL=0 cargo test --workspace --locked`                                | PASS72:3 domain,9 server unit,46 real API/TCP integration,14 storage/upgrade; doc tests pass            |
| `CARGO_INCREMENTAL=0 cargo clippy --workspace --all-targets --locked -- -D warnings` | PASS                                                                                                    |
| `cargo fmt --all --check`, included live-case rustfmt                                | PASS                                                                                                    |
| `pnpm test`                                                                          | PASS56; rapid-ping and map-visibility regressions included                                              |
| `pnpm typecheck`, `pnpm lint`, `pnpm check:features`                                 | PASS;179 IDs retained, none VERIFIED                                                                    |
| `pnpm build`, `CARGO_INCREMENTAL=0 cargo build --locked -p hearth-server`            | PASS; matching0.0.11 web and host                                                                       |
| `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141> pnpm exec playwright test`                 | PASS12/12 in7.8minutes, including all previous scenarios, new map tools and host recovery               |
| `node scripts/capture-preview.mjs <desktop.png> <narrow.png>` with Chromium141       | PASS; actual1600×1000 desktop and760×700 narrow map-tool views inspected, including unobscured guidance |

The independent reviewer found one material usability defect: holding Enter or rapidly clicking could exceed the existing incoming-frame limit before the host ping cooldown applied. A failing30-send regression passed after adding a monotonic500ms client limit and ignoring repeated Enter, while arrows still repeat. The browser test also checks repeated Enter. Visual inspection caught a badge overlapping scene controls, hidden instructions and narrow-screen guidance covered by the sidebar; the final captured desktop/narrow views and browser assertions verify the corrections. No second review or new deferred finding.

Browser acceptance used official Chromium141.0.7390.37 headless/Linux with actual isolated DM/two-player servers. The screenshot uses fictional Game Master/Alice/Bob data, real chat and live ping plus a real five-square ruler. Current Chrome/Firefox/WebKit, Windows/macOS, physical LAN/WAN and full P0/30-minute acceptance remain unverified. Source packaging excludes local stores, dependencies, build outputs and internal traces. Next: drawing/layers and scene notes, then token bars/status/context controls and host distribution.


## Previous checkpoint ·0.0.10

# Hearth VTT · Build0.0.10 ·2026-10-26

T015 whole-host backup and isolated browser recovery. Owner-only download/strict file verification/generated recovery copies; full SQLite/registered artwork/account/game ACL persistence, with sessions/unused invites reset only in the recovered copy. Browser-only VTT/headless Rust architecture retained; original feature shell unchanged. No new registry package, native app, external service or public action. Current schema10,512MiB archive bounds; full format/limits/privacy/startup instructions in BACKUP_RECOVERY. All179 IDs preserved; partial recovery IDs remain IN_PROGRESS. P0_GAPS records the remaining essentials and actual30-minute/LAN/distribution gates.

Recovered exact saved0.0.9/version13 (181files, SHA9732c1e39a861d1468c1c4f6c9afa43926b213453f8b970cdb7097697935cee5). Fresh isolated stage-recovery/baseeaf0571; baseline Rust58/TS43 pass. Storage missing-module RED→GREEN6 meaningful round-trip/malformed/schema/blob/PNG/link tests. Real owner API404 RED→GREEN3 tests; cancellation/gate cleanup adds1. Strict protocol/dialog missing modules RED→GREEN4 tests; TS47/types pass. The initial Rust68 gate passed; final schema-maintenance coverage raises the Rust suite to71. SQLx borrowed-Connection migration HRTB Send issue traced to dependency Acquire boundary and resolved with the same one-connection Pool migration pattern used by Store.

Initial real browser recovery acceptance PASS1/1 in26.4seconds: actual download, corrupt file rejection, upload verification and persisted isolated copy; new host accepted original owner/two-player credentials and identical scoped REST documents, artwork access and stale-cookie rejection. Added restored Pixi/Combat/Journal UI checks plus independent recovered HP mutation for final full11-scenario run. No competing screenshot browser. The fresh whole-change review and final evidence are recorded below. Chromium141.0.7390.37/Linux from official Google Chrome-for-Testing archive; default future browser payload unavailable, no current-browser/platform claim.

One fresh read-only whole-change gpt-6-astra/high review eaf0571..392ce7d found3 Important, no Critical/Minor. All observed RED→GREEN: checksummed sqliteXevil trigger evaded LIKE underscore filtering; staged candidate lacked its marker while digest/extraction was pending; reopened/polled dialog adopted another window’s receipt, with a second regression for active receipt replacement. Fix complete canonical-schema comparison (only exact planner-statistics tables exempt), install/sync marker before archive reads, and local file-bound verification with remote-change disabling. Deterministic marker test queues archive work behind one held blocking worker, without timing guesses/test hooks. Query-cache notifications are asynchronous; the UI test waits for the same disabled-state assertion via waitFor. No weakened assertion, second review or new deferred finding. Full locked Rust71/TS49/types/lint/clippy/fmt/matched0.0.10 host/web pass; fixed-source recovered-host browser1/1 passes50.2seconds including restored rendering/panels and independent HP edits.

First full browser10/11: old ten scenarios passed. The new recovery fixture assumed the entire host contained one artwork file, but previous scenarios left3, correctly present in a whole-host backup. The assertion now independently hashes every uploaded source asset over authorized HTTP and checks all campaigns/encounters; recovered owner campaign list is compared too. All original privacy/data/ACL and timeout checks remain. Final full11-browser run passed in8.1minutes, with no competing screenshot browser.

## Final actual verification ·0.0.10

| Command/check                                                                                           | Result                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                        | PASS; same244 registry dependency name/version/source tuples as0.0.9                                                                                 |
| `CARGO_INCREMENTAL=0 cargo test --workspace --locked`                                                   | PASS71:3 domain,9 server unit,45 real API/TCP integration,14 storage/upgrade; doc tests pass                                                         |
| `CARGO_INCREMENTAL=0 cargo clippy --workspace --all-targets --locked -- -D warnings`                    | PASS                                                                                                                                                 |
| `cargo fmt --all --check`, included recovery-case rustfmt                                               | PASS                                                                                                                                                 |
| `pnpm test`                                                                                             | PASS49; all review regressions observed RED→GREEN                                                                                                    |
| `pnpm typecheck`, `pnpm lint`, `pnpm check:features`                                                    | PASS;179 IDs retained, none VERIFIED                                                                                                                 |
| `pnpm build`, `CARGO_INCREMENTAL=0 cargo build --locked -p hearth-server`                               | PASS; matching0.0.10 host/web                                                                                                                        |
| `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141> pnpm exec playwright test`                                    | PASS11/11 in8.1minutes; original ten regressions plus whole-host recovery                                                                            |
| Same browser command targeting `tests/e2e/recovery.spec.ts` after final storage-only schema enhancement | PASS1/1 in52.8seconds; recovered owner/two players, preserved content/ACL/artwork, old-cookie rejection, actual Pixi/panels and independent HP edits |
| `node scripts/capture-preview.mjs <desktop.png> <narrow.png>` with Chromium141                          | PASS; actual1600×1000 desktop and760×700 narrow recovery panel visually inspected; controls reachable, no browser errors                             |

The final schema enhancement compares every SQLite object while allowing only the exact known engine planner-statistics table definitions; real ANALYZE→backup→recovery compatibility is covered. The full11-scenario browser run preceded only this storage-only enhancement; the final71-test Rust suite, clippy, host build and focused real recovered-host browser run follow it. This distinction avoids overstating a single final full-suite run. Screenshot capture ran only after the acceptance browser ended, against isolated fictional Game Master/Alice/Bob data and actual backup download/upload/verification/copy creation. Its host/browser/temp data are cleaned on exit. The source checkpoint contains196 tracked files, excluding dependencies, build outputs, local stores, traces and internal QA images. Private branch retained; no public integration.

Whole-host recovery is now implemented within the documented current-schema/archive bounds. Complete playable P0, ready-to-run hosting packages, actual30-minute encounter/LAN/WAN/TLS, Windows/macOS, current-browser matrix, sustained load and comprehensive a11y/security/crash acceptance remain pending. The next implementation stage closes canvas/token P0 gaps recorded in P0_GAPS, followed by host dashboard and distribution gates.

## Previous checkpoint ·0.0.9

# Hearth VTT · Build0.0.9 ·2026-10-26

User-requested structural table redesign plus T015 generic combat. Browser-only roles/headless Rust authority retained; no new dependency, native shell or public action. Compact campaign/scene bars, actual tool rail, scoped workspace theme, resizable/collapsible sidebar, persistent feature state, reusable nonmodal token/combat windows and safe quick-dice preparation. Dedicated layout primitives/typed panel slots keep the renderer and future feature forms independent. Stable portal moves one Combat form between dock/window without remounting drafts. Local storage contains only account/campaign sidebar width/open/panel preferences.

Migration0010 adds one scene-bound encounter,32 entries, host IDs/scoped creation tombstones, manual initiative, deterministic ordering/turns/rounds, end/clear and current-authorized linked actor HP. No copied HP record, rules automation or hidden placeholders. Current scene/token/fog/actor projections filter before REST/live serialization; combat and affected-token events are content-free snapshots. Direct deletion reconciles current turn.9→10 upgrade/reopen and combined32-entry maximum snapshot covered. Every179 feature ID retained; CMB-01/02 and partial workspace UX remain IN_PROGRESS.

Recovered exact saved0.0.8/version12; baseline Rust49/TS31 passed. New command/schema/workspace/combat-form/guarded-modal tests observed RED→GREEN. Full locked Rust57, clippy and fmt pass with CARGO_INCREMENTAL=0 (environment incremental cache caused linker corruption; nonincremental checks pass). TypeScript40/types/lint/build pass. Matched0.0.9 host/web built. Focused real three-client workspace/combat scenario passes1/1: hidden NPC turns/raw frames, owner HP, same canvas/input identities, private drafts/scopes, keyboard/pointer resize and scene concealment.

The first full browser regression exposed a persisted People-tab assumption in the cross-account journal test; explicitly open Journal before establishing the DM secret, then await identity change and reopen the authorized player panel. A real pending-drag/navigation regression also exposed a lost error-settling callback in the Table rewrite (unhandled “The table was closed.”); preserve stream-visible errors and settle canvas event promises as before. No weakened security assertions or expanded timeouts. Fresh review and final check evidence are recorded below.

One fresh read-only whole-change review (c158039..384220a) found3 Important defects and no Critical/Minor. All reproduced RED→GREEN in one fix pass: HP draft redirected by equal-version actor relink (server incorrectly ACKed); own-save snapshot before ACK left stale field versions; fixed-size popup failed to reclamp after stage shrink. Fix strict expectedActorId+version host guard and identity-bound draft, clean-state synchronization on completed save, and parent ResizeObserver. No second review/deferred new minor. Final locked Rust58, TypeScript43, types/lint/fmt/clippy, matched host/web build and179-ID check pass. Final browser/screenshot evidence follows after completion.

The first full browser run was7/10; failures were the journal-panel assumption, pending-drag product regression, and fog painting under the newly floating inspector. The latter test now explicitly closes the inspector before drawing on the covered canvas area. All original security/camera/fog/drag assertions and timeouts remain. No preview browser competes with acceptance.

## Final actual verification

| Command/check                                                                        | Result                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                     | PASS; pinned existing dependencies, no additions                                            |
| `CARGO_INCREMENTAL=0 cargo test --workspace --locked`                                | PASS58:3 domain,9 server unit,41 real API/TCP integration,5 storage/upgrade; doc tests pass |
| `CARGO_INCREMENTAL=0 cargo clippy --workspace --all-targets --locked -- -D warnings` | PASS                                                                                        |
| `cargo fmt --all --check` and included combat-case rustfmt                           | PASS                                                                                        |
| `pnpm test`                                                                          | PASS43; all review regressions observed RED→GREEN                                           |
| `pnpm typecheck` / `pnpm lint` / `pnpm check:features`                               | PASS;179/179 IDs, none VERIFIED                                                             |
| `pnpm build` / `CARGO_INCREMENTAL=0 cargo build --locked -p hearth-server`           | PASS; matched0.0.9 host/web, lazy Actors/Combat                                             |
| `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141> pnpm exec playwright test`                 | Final PASS10/10 in8.0minutes; no competing preview                                          |

The final actual Chromium141.0.7390.37/Linux software-rendered run includes all nine prior scenarios and new DM/two-player workspace/combat behavior. New checks prove actual input/canvas identity, HP ACLs, hidden turns/raw-frame secrecy, turn wrap, scene concealment, dock/popout/private-draft retention, keyboard/pointer sidebar resize, right-edge popup reclamping after sidebar expansion, Pan over a token without token mutation, safe quick-dice scope and narrow overlay layout. Source/web/backend were matched before the isolated run. No assertions/timeouts weakened; no second review. Earlier failures are recorded above and not counted as passes.

Full-data export/restore,30-minute complete P0 encounter, installation-free hosting packages, Windows/macOS/physical LAN/WAN/TLS, current Chromium/Firefox/WebKit and comprehensive security/load/crash/a11y/tablet acceptance remain pending. Whole active backgrounds remain downloadable. Next unblocked stage is T015 full-data recovery and a P0 gap/encounter gate.

Final screenshot capture: `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141> node scripts/capture-preview.mjs <desktop.png> <narrow.png>` PASS. Actual1600×1000 desktop and760×700 narrow viewport visually inspected; populated tracker/Chat, controls reachable, no browser errors. Uses isolated fictional Game Master/Alice/Bob identities, actual host commands/HP/turns/chat/rolls and original art. Host/browser/temp store cleaned on exit. Source ZIP contains181 tracked files only; excludes local data, build outputs, dependencies, traces and internal QA screenshots.

## Previous checkpoint ·0.0.8

# Hearth VTT · Build0.0.8 ·2026-10-26

T014 chat/whisper/selected-roll slice: persisted literal public/private group messages, current-member directory without usernames, chronological chat+roll cards and selected-recipient host dice. Sender/roller included; no implicit DM override. Existing journals/characters/maps/tokens/fog and four dice scopes remain. Private drafts/recipients survive dock navigation and missing recipients block new private sends. Input1000 Unicode scalars,1–8 other recipients; latest1000 saved/latest20 projected messages, plus20 roll cards. Independent precise millisecond message budgets survive history pruning/sockets. No new dependency.

0009 rebuilds dice CHECK, preserving old result JSON/nonces, and adds chat/rate/recipient tables. All reads/writes preserve current authorization/receipt/revision transaction boundaries. REST and snapshots filter before limiting; events are content-free markers. Current membership gates retained recipients. Combined maximum fixture fills selected roll recipients and20 maximum messages in addition to existing actors/journals/tokens/fog, within a768KiB write buffer. Input remains16KiB. All179 feature IDs retained; none VERIFIED.

Baseline saved0.0.7/version11 recovered after scratch cleanup; Rust44/TS24 passed before product changes. RED: unsupported chat command/missing roster, missing protocol snapshots/cache/composer/selected Dice. GREEN: Rust49, TypeScript31, types/lint/build/clippy. New8→9 upgrade proves old JSON/nonce/journal bytes, FKs and pre-upgrade snapshot. Validation initially expected403 after revocation, but existing hidden-read contract is404; corrected test after tracing authorized_read. Testing Library role queries do not accept Playwright's exact option; corrected test types. Real browser reached revocation but its text selector matched both mounted Chat/Dice warning nodes; scoped it to the visible Chat region. No product workaround.

Requested screenshot capture runs actual0.0.8 against isolated fictional Game Master/Alice/Bob identities and real command flows. Initial harness used wrong invitation envelope/route, fixed against actual API/router; capture then passed. Select controls received scoped styling after visual inspection. No personal account data or generated mockup.

One fresh read-only gpt-6-astra review found an Important UI ambiguity for duplicate display names, plus feature-matrix/guide reporting errors. The ambiguity reproduced RED before adding expanding unique ID-prefix labels in selectors, recipient summaries and sender/roll headers; TypeScript31/types/build pass after fixes. Corrected reporting in the same pass: dependency-column substring matching had unintentionally changed COM-03..11; restore their own baseline NOT_STARTED rows/descriptions and keep COM-01/02 IN_PROGRESS. No second review; no new deferred minors.

Browser runs exposed two test/verification issues: revocation may close through a REST poll or WS event with different safe error wording, so assert the closed-table/library action and absent private message/cards; concurrent screenshot generation coincided with a headless renderer startup timeout in the foundation fixture, causing a downstream missing-controller fixture failure. Trace shows the renderer loading and no unauthorized content. Keep original assertions/timeouts and repeat in isolation before a success claim. Final isolated browser acceptance passed9/9 in5.7minutes with the final matched0.0.8 bundle; no competing screenshot browser. All original assertions/timeouts remain, with the two semantic test-selector corrections described above. No portable/platform/LAN/WAN/full current-browser matrix/security audit claim. Next: T015 combat and full-data recovery, then P0 encounter acceptance.

## Final actual checks

| Command/check                                                        | Result                                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                     | PASS; no new dependency                                                                      |
| `cargo test --workspace --locked`                                    | PASS49:3 domain,9 server unit,33 real API/TCP integration,4 storage/upgrade; doc tests pass  |
| `cargo clippy --workspace --all-targets --locked -- -D warnings`     | PASS                                                                                         |
| `cargo fmt --all -- --check` and included-case rustfmt               | PASS                                                                                         |
| `pnpm test`                                                          | PASS31; duplicate-name selector/summary/sender/roll-card regressions RED→GREEN               |
| `pnpm typecheck` / `pnpm lint` / `pnpm check:features`               | PASS;179/179 IDs, untouched COM-03..11 restored                                              |
| `pnpm build` / `cargo build --locked -p hearth-server`               | PASS; matched0.0.8 host/web                                                                  |
| `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141> pnpm exec playwright test` | Final PASS9/9,5.7minutes; no competing preview                                               |
| `node scripts/capture-preview.mjs <absolute.png>` with Chromium141   | PASS; actual map/Chat/roll/whisper, isolated fictional demo;1600×1000 PNG visually inspected |

Chromium141.0.7390.37 headless/software graphics on Linux. Real-server scenarios retain foundation identity/private projections/host independence, maps/uploads/token authoring, pending drag cleanup, generic actors/linked control, scene CAS, fog, four old dice scopes, journal authoring/conflicts and new chat/selected groups/reconnect/revocation. The final31 TypeScript suite and review fix are on the final source; Rust implementation was unchanged by UI review fixes. Failed intermediate browser runs are recorded above, not counted as passing. Screenshot capture is run separately to avoid the observed software-renderer contention.

One fresh read-only review, one material fix pass, no second review. All three findings addressed: duplicate names, incorrect feature reporting and stale guides. Existing K013–K018 retained; no new deferred minor. Rulings: correct inaccurate scope reporting rather than defer it, and isolate browser acceptance from preview work while preserving assertions/timeouts. Practical costs: extra verification time, no unsupported feature/performance claim. Kept private stage-chat branch; no merge/push/deploy/license action. Archive excludes build outputs, private stores, internal browser traces/screenshots/caches; the specifically requested fictional screenshot is a separate deliverable. Current source remains developer-built, not a portable host package or playable-P0 release. Next T015 combat/initiative/HP, full-data export/restore and P0/LAN encounter gates.

---

# Historical build0.0.7 record

# Hearth VTT · Build0.0.7 ·2026-10-25

Bounded T014 increment chosen under the user's usage-budget instruction: DM-authored plain-text journal CRUD, explicit whole-campaign sharing/concealment, named deletion confirmation and stale-form protection. New pages are private. Journal version guards prevent a later campaign revision from silently overwriting another tab's edit. UI preserves drafts across dock tabs and conflicts, with explicit Reload page; a removed target preserves text for copying. Literal markup is never interpreted as HTML.

Migration0008 adds version1 to existing pages without editing prior migrations. Commands share existing current DM/membership/archive, IMMEDIATE transaction, receipt and revision boundaries. Snapshot-only event markers contain no journal text/IDs; REST and snapshots filter current visibility before serialization. Limits16 pages, title80/body1000 Unicode scalars, body LF/TAB allowed. All179 feature IDs retained; JRN-01/02 remain IN_PROGRESS. Existing functionality and known limits remain as below.

## Verification and review

Baseline: saved0.0.6 source restored after scratch cleanup; Rust42 and TypeScript21 pass before product changes. New real-host tests first failed on unsupported journal commands; protocol first failed on missing version; UI first failed on missing component. The final matched host/browser bundle passed the focused journal scenario and the full eight-scenario regression. One fixture hit the existing20-frame flood limit; reconnecting the fixture solved it without changing product limits. Typecheck caught a still-used icon import; restored it. Biome flagged control-character regexes; use Unicode control category checks instead.

Current: Rust workspace44 passed, TypeScript24 passed, typecheck/lint/build/clippy/179-ID checks passed. Maximum Unicode snapshot fixture now also fills16 maximum journal pages; all content remains below512KiB. Upgrade fixture preserves original journal bytes at version1; saved edits persist after reopening the store. One fresh read-only gpt-6-astra review found no Critical/Important defect; defer the existing K013 emoji browser-cap mismatch. Review rulings and costs are in DECISIONS. Final full browser regression:8/8 pass in5.1minutes on Chromium141.0.7390.37 headless Linux; matched0.0.7 web/host builds, isolated temporary data/web directory.


| Actual command                                                                       | Result                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                     | PASS; pinned dependencies, no new dependency                                                |
| `cargo test --workspace --locked`                                                    | PASS44:3 domain,9 server unit,29 real API/TCP integration,3 storage/upgrade; doc tests pass |
| `cargo clippy --workspace --all-targets --locked -- -D warnings`                     | PASS                                                                                        |
| `cargo fmt --all -- --check` plus included journal/actor case rustfmt                | PASS                                                                                        |
| `pnpm test`                                                                          | PASS24                                                                                      |
| `pnpm typecheck` / `pnpm lint` / `pnpm check:features`                               | PASS;179/179 IDs                                                                            |
| `pnpm build` / `cargo build --locked -p hearth-server`                               | PASS; matching0.0.7 bundle/host                                                             |
| `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141> pnpm exec playwright test -g 'DM journal'` | PASS1 focused three-client scenario                                                         |
| `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141> pnpm exec playwright test`                 | PASS8/8,5.1minutes                                                                          |

The browser regression covers the existing identity/private projections, map/token authoring, drag cleanup, actors/linked ownership, scene conflicts, manual fog, dice privacy and new journal workflow. Journal scenario adds two authenticated players, raw frame checks, hidden direct reads, explicit publish/conceal, safe literal markup, dock draft preservation, two-DM stale drafts/reload, offline conceal catch-up, reload and named deletion. Real API tests additionally exercise receipt replay, stale page versions at a current campaign base, player denial, foreign/unknown equality, validation/cap, archive and store reopen. Upgrade fixture preserves original journal bytes/version1 while running old migrations through0008. No fresh launcher/platform/security-advisory audit is claimed; last Linux launcher evidence remains the historical0.0.6 check.

One fresh reviewer only; no material findings or second review. K013 deferred; two scope rulings and costs retained in DECISIONS. Kept private stage-journals branch; no merge/push/publish/license change. Source archive includes code/tests/docs/original fixture assets and excludes build outputs, data, internal screenshots/traces and development caches.

No portable host/platform/LAN/WAN/current-browser-matrix claims. Current source still requires development tools; all end-user UI remains in browsers. Chat/whispers/selected roll recipients remain the next actual T014 gap; combat/full restore follow.

---

# Historical build0.0.6 record

# Hearth VTT · Build0.0.6 ·2026-10-25

## Current increment

Browser-only DM/player app, independent authoritative Rust host. T013 adds host dice: bounded arithmetic/grouping, standard quick dice, public/DM+roller/self/blind scopes and persisted authorized history with original/normalized formula, faces/subtotals/total/scope/roller/time/revision. A blind player roller receives acceptance only; self-only excludes other DMs. Duplicate accepted requests return the prior receipt without rolling twice. Dice draft/scope now survives dock-tab changes. Existing campaigns/invites, private custom scenes/uploads, tokens/control/movement, generic actors/sheets/permissions, manual fog, stable camera, reconnect/receipts, backups and source launcher remain included. Private source checkpoint, not playable P0 or portable distribution.

Pure typed AST:120 ASCII bytes,64 nodes,12 nested levels,100 dice,1m sides/constants, finite±1e9 arithmetic; supports NdM/dM, unary signs, parentheses,+,-,*,/. OsRng.try_fill_bytes and bounded unbiased rejection supply faces; new result IDs also use fallible host entropy. No eval/scripting/new registry dependency. Keep latest1000 rolls and latest20 authorized DTOs; independent short-lived rate timestamps cannot be reset by history eviction. Whole-second timing(K018) is approximate, not an exact rolling10.000second guarantee. The host/database owner is trusted; blind filtering does not prevent inference from deterministic formulas or failed math.

Migration0006 adds results/AST/history/rate records. Migration0007 separates host-owned external result UUIDs from per(campaign,roller) clientRollId creation nonces; guessed private/foreign IDs cannot create an existence oracle. Existing0006 result bytes/IDs are preserved and adopted as caller nonces. Earlier migrations are unchanged. Snapshots/REST project current authorization in a shared read transaction, history filters before limit, and live roll events contain only snapshot markers. Cache replaces on snapshots and clears on revoked access. All179 feature IDs retained; DICE-01/02/05 remain IN_PROGRESS for broader scope.

## Actual verification

| Command/check                                                                                           | Result                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| cargo test --workspace --locked                                                                         | PASS42:3 domain parser/generated properties +9 server unit +27 actual API/TCP +3 storage/upgrade; doc tests pass |
| cargo clippy --workspace --all-targets --locked -- -D warnings                                          | PASS                                                                                                             |
| cargo fmt --all -- --check + included-case rustfmt                                                      | PASS                                                                                                             |
| pnpm test                                                                                               | PASS21 protocol/cache/composer/fog/dialog tests                                                                  |
| pnpm typecheck / pnpm lint                                                                              | PASS; final documentation pass repeated before delivery                                                          |
| pnpm build / cargo build --locked -p hearth-server                                                      | PASS matched0.0.6 bundle and host, isolated browser files                                                        |
| HEARTH_TEST_WEB_DIR=<matched bundle> HEARTH_CHROMIUM_EXECUTABLE=<Chromium141> pnpm exec playwright test | PASS7/7 on final fixed source,3.4min; includes tab-scope regression                                              |
| pnpm check:features                                                                                     | PASS179/179                                                                                                      |
| cargo metadata --locked --format-version 1                                                              | PASS244 registry packages; no new dependency                                                                     |
| Linux source launcher                                                                                   | PASS: frozen install/build/start, health0.0.6/matching nonce-aware browser bundle, Ctrl+C/closed port on Linux   |

Chromium141.0.7390.37 headless/software graphics on Linux. Player and DM dice screenshots inspected internally; screenshots/traces/binaries/local stores are excluded from source delivery. Parser tests include1024 generated valid round trips and10000 deterministic malformed/valid strings, math/count/depth/bounds and injected entropy failures. Real TCP/API tests prove four-scope projections/direct-ID equality, forged result rejection, dedupe/collision, retained older details, filtering before limit, pruning/rate across sockets, archive/revocation, storage reopen and private/foreign creation-ID protection. A real6→7 fixture proves nonce adoption, unchanged result bytes, FK integrity and backup. The combined snapshot fixture now fills16 max Unicode actors,32 grants each,100 max-name tokens,8 largest supported masks and20 large rolls inside512KiB.

## Review and recovery record

The workspace reverted to the old foundation at session start. Restored authoritative saved0.0.5/version8 (SHA69c1cc...) as4b638e3 before coding. Current restored tests were run; prior build evidence was not reused as proof. Implementation checkpointc0a8579 saved as source version9 before browser review. One fresh gpt-6-astra read-only whole-change review; no Critical issue, one Important global-ID existence oracle and three Minor findings. Promoted the ordinary dock-tab private→public reset to material because a sheet lookup could otherwise change privacy. Both reproduced RED, fixed in8f28f8a and covered by tests; no second review. Added fallible host-ID entropy and0007 upgrade coverage in the same fix pass.

RED→GREEN: missing domain dice module; unsupported real WS command; missing protocol/cache/Dice panel; rate budget replenishing after history eviction; private/foreign creation-ID oracle. Browser RED specifically observed self→public on dock navigation; final7/7 browser run proves the mounted-composer fix. One initial SQL LIMIT spacing error failed the initial snapshot and was corrected, not hidden by larger timeouts. Restored tooling/frozen packages and official Chromium141 used; a missing optional crashpad executable did not affect the verified browser. Full offline Cargo metadata lacked optional target packages; normal locked metadata downloads those legitimate pinned packages instead.

Deferred new Minor findings: K017 near-limit shorthand normalization may expand beyond the input limit, and K018 whole-second rate timestamps can expire <1second early. Existing K013–K016 remain documented. All reviewer-declined scopes and practical costs are recorded in DECISIONS: advanced/selected dice, bounded nonce retention, explicit revision conflicts, non-retractable prior knowledge/in-flight reads, full snapshot bandwidth, formula inference, trusted physical host/operational limits, pending command semantics, prior UI polish and later platform/production gates. No claim of crypto fairness/inference-proof blind rolling.

Windows/macOS/physical LAN/current Chromium/Firefox/WebKit, internet TLS/firewall, comprehensive load/crash and full export/restore remain unverified. Shared background files remain downloadable. Final headless host must need no Node/pnpm/Rust/Visual Studio/database installs; current developer source still does. Kept private branch and excluded the two preexisting script mode changes; no merge/push/deploy/license action. Next T014 chat/whispers, selected roll participants and journal CRUD/conflicts, then combat/recovery.

---

# Historical build0.0.5 record (superseded by this increment)

# Hearth VTT · Build0.0.5 ·2026-10-24

## Current increment

Browser-only DM/player app with an independent authoritative headless Rust host. This stage adds persisted shared manual fog: rectangle reveal/hide through map drag or zero-based keyboard grid form; cover/reveal all; enable/disable preserving exploration; translucent DM preview and opaque player mask. Bulk expose actions require confirmation. Fog updates retain the Pixi renderer/camera. Existing campaigns/invitations, private scene preparation/uploads/token CRUD/control, generic actor sheets/ownership/links, movement/reconnect/receipts, backups and source launcher remain included. Private source checkpoint, not playable P0 or portable host distribution.

Migration0005 adds fog_enabled/fog_bits only; earlier migrations are unchanged. Row-major LSB-first packed mask with lowercase hex DTO, grid<=256×256 and <=16384 characters. Entire token footprints must be revealed before players receive token metadata/art or move to a destination. Current hidden/unknown IDs have equal generic errors. Explicitly shared/granted actor sheets/portraits retain independent permission; full active background downloads remain the disclosed exception. Re-hide controls new delivery and cannot erase previous knowledge. Event-time tokenWasVisible plus sceneWasPublic and fresh current authorization prevent later reveal replaying secret preparation. Structural fog changes use current snapshots. No new dependency/cloud runtime requirement. All179 IDs retained; VIS-01/08/11 remain IN_PROGRESS for broader scope.

## Actual verification

| Command/check                                                                                                          | Result                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| cargo test --workspace --locked                                                                                        | PASS32:7 server unit +23 actual API/TCP integration +2 storage/upgrade; doc tests pass        |
| cargo clippy --workspace --all-targets --locked -- -D warnings                                                         | PASS                                                                                          |
| cargo fmt --all -- --check + explicit included-case rustfmt                                                            | PASS                                                                                          |
| pnpm test                                                                                                              | PASS18 protocol/mask/confirmation/hook/dialog regressions                                     |
| pnpm typecheck / pnpm lint                                                                                             | PASS on final source/documentation pass                                                       |
| pnpm build / cargo build --locked -p hearth-server                                                                     | PASS matching0.0.5 browser/host                                                               |
| HEARTH_TEST_WEB_DIR=<isolated verified bundle> HEARTH_CHROMIUM_EXECUTABLE=<Chromium141 path> pnpm exec playwright test | PASS6 real-server browser scenarios,2.8min                                                    |
| pnpm check:features                                                                                                    | PASS179/179                                                                                   |
| cargo metadata --locked --offline --format-version 1                                                                   | PASS244 registry packages, no new dependency                                                  |
| Linux source launcher                                                                                                  | PASS: frozen install/build/start, health0.0.5/browser bundle, Ctrl+C and closed port on Linux |

Browser: Chromium141.0.7390.37 headless/software graphics on Linux. Covered-player/translucent-DM screenshots inspected internally; forced renderer startup failure proves no uncovered player fallback image. Real DM/two-player rectangle reveal, metadata/art denial, cover, reconnect/reload and camera/renderer identity checks pass. Server tests add partial footprint denial, visible/covered movement, bounds/overflow, foreign/unknown scenes, archive/DM-only checks, receipts, independent actor sharing, exact reset padding and host storage reopen. A gated writer reveals during a queued batch without replaying hidden names/art. Maximum Unicode actor sheets plus8 largest supported scene masks fit512KiB; not every token/grant combination is an automated fixture.

## Review, decisions and limits

One fresh gpt-6-astra whole-change read-only review: no Critical/Important issue. Three deferred Minor UI findings: K014 bulk-confirmation error outside modal (close to read/retry), K015 retained brush hint after disabling fog, K016 overlapping GPU-fallback explanations. No second reviewer. Scope decisions and practical costs are exhaustive in DECISIONS, including shared grid/current snapshots, destination rather than path checking, ordinary in-flight authorization, non-retractable prior knowledge, fail-closed corrupted masks and unmeasured sustained load.

TDD: real-host missing fog.enabled RED→GREEN; missing TS fog helpers/schema and FogControls RED→GREEN. Source checkpoint version7 saved before browser verification. First full browser pass5/6: added failure test disabled WebGL, but Pixi correctly recovered through another renderer. Inspected installed autoDetectRenderer and trace; corrected the test to block renderer backend loading (actual initialization failure), then focused PASS and final full6/6. No product workaround. Stale restored Rust incremental linker symbols were cleared only for hearth-domain/hearth-server. Browser/host builds were matched sequentially with isolated browser bundles. Final source archive excludes data, binaries, test traces/screenshots and developer caches.

Windows/macOS/physical LAN/current Chromium/Firefox/WebKit, internet TLS/firewall, sustained load/crash and full-data export/restore remain unverified. Full background confidentiality, automatic/per-player vision/walls and richer paint shapes are future stages. Final ready-to-run host must require no Node/pnpm/Rust/Visual Studio/database installation; the current developer source still requires tools. Kept the existing private branch and preexisting script mode changes, no merge/push/deploy/license action. Next: T013 bounded server dice/private rolls, then T014–T015 chat/journal/combat/recovery.

---

# Historical build0.0.4 record (superseded by the current increment)

# Hearth VTT · Build0.0.4 ·2026-10-24

## Current increment

Browser-only DM/player interface, independent authoritative headless Rust host. This stage adds generic Character/NPC sheets (portrait, biography, HP and eight custom text properties), DM-only notes, per-player observer/owner grants, linked-token authority/direct sheet opening, concurrent sheet/scene-name edit protection and scene rename/delete. Accounts/campaigns/invitations, protected raster uploads/private preparation, token CRUD/visibility/control, live movement/reconnect/receipts, stable camera, pre-upgrade backups and source launcher remain included. Private source checkpoint, not playable P0.

Migration0004 only adds actors, member/actor-cascading ownership and nullable token links. Existing migrations remain unchanged. Linking clears old standalone controllers; linked shared tokens move for DM/current actor owners, observers only read. Actor IDs are null when unreadable in snapshots and queued token deltas. Token art/name remain independent. Actor deletion unlinks tokens; deleting active scenes clears players and cascades scene tokens, retaining uploaded art. Actor expectedVersion and scene expectedName prevent stale forms overwriting accepted changes; reload is explicit. Player DTOs never include private notes/grant rosters.

Limits:16 actors/campaign,32 grants/actor,8 properties(name40/value120), biography/private notes1000 each, names80, HP integer0..1000000/max>=1/current<=max. Outbound512KiB fits valid maximum Unicode sheets; input16KiB and existing write deadlines remain. No new dependency/runtime cloud requirement. All179 master IDs remain; partial work stays IN_PROGRESS.

## Actual verification on the recovered final source

| Command/check                                                                                                          | Result                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| cargo test --workspace --locked                                                                                        | PASS28:5 server unit +21 actual API/TCP integration +2 storage/migration; doc tests pass                  |
| cargo clippy --workspace --all-targets --locked -- -D warnings                                                         | PASS                                                                                                      |
| pnpm test                                                                                                              | PASS14 protocol/reducer/hook/dialog regressions                                                           |
| pnpm typecheck / pnpm lint                                                                                             | PASS                                                                                                      |
| pnpm install --frozen-lockfile / pnpm build / cargo build --locked -p hearth-server                                    | PASS                                                                                                      |
| HEARTH_TEST_WEB_DIR=<isolated verified bundle> HEARTH_CHROMIUM_EXECUTABLE=<Chromium141 path> pnpm exec playwright test | PASS5 real-server scenarios,1.5min total                                                                  |
| pnpm check:features                                                                                                    | PASS179/179                                                                                               |
| Source launcher smoke                                                                                                  | PASS on Linux: install/build/start, version0.0.4 health/browser bundle, Ctrl+C, port closed               |
| pnpm audit --prod --json                                                                                               | PASS:zero reported known vulnerabilities across25 runtime/optional dependencies; not a Rust advisory scan |
| cargo metadata --locked --format-version 1                                                                             | PASS:package-declared license inventory refreshed; no new registry dependency                             |

Formatting (including included actors.rs) and git diff checks PASS; the source archive is validated before saving. Browser: Chromium141.0.7390.37 headless/software WebGL on Linux. Actor screenshot inspected internally; no screenshots/binaries/local data are in source delivery. Windows/macOS/physical LAN/current Chromium/Firefox/WebKit, internet TLS/firewall, load/crash and full-data restore remain unverified.

Rust tests prove private sheet/portrait projection, observer/owner and forged private-field rejection, hidden/unknown/foreign actor equality, foreign links, old-controller removal, current control/revocation, request dedupe, member-cascade/FK integrity, valid maximum Unicode snapshots and persisted actor/grant reopen, scene CAS/deletion/media denial. A gated writer revokes an actor grant during a queued frame and proves later actorId/canMove/sheet data is filtered. Browser scenarios retain the three-identity foundation/camera/reconnect/art recovery and pending-drag cleanup, add three-account sheets/permissions/portrait/property/HP conflicts/scene deletion, and two-DM-tab scene rename conflicts. Pages report no pageerror in their checked workflows.

## Review and recovery record

One fresh whole-change review before the workspace reset found no Critical issue, one Important concurrent-rename overwrite and one Minor Unicode-control limit. The Important issue was reproduced in two real DM tabs (old form replaced newer accepted name), then fixed with transactional expectedName and explicit reload; the recovered server and two-tab browser regressions pass. No second review dispatch. Native HTML maxLength is stricter for emoji than server Unicode scalar limits: K013 deferred to localization/accessibility; ordinary Slovak/Latin unaffected. K011/K012 cleanup regressions remain and pass. K007 finer security boundaries remain queued.

An older browser artifact was paired with the changed server during verification and sent a rename without expectedName; wire tracing identified the mismatch. The test host now copies its browser bundle to an isolated temporary directory, and the final run used a freshly built, checked bundle with the matching host. A host protocol error without requestId now rejects the one pending command immediately instead of leaving a15-second busy timeout; hook regression RED→GREEN. Refresh browsers after upgrading both host and assets.

The user Continue message arrived after a workspace reset to Stage1. Saved source0.0.3/version3 was restored as b85ff31, then this stage reconstructed from its design/implementation/review record. Old test results were not treated as proof of recovered files. Recovered actor API RED404; protocol/late-callback/pending-error regressions RED before fixes, followed by current Rust28/TS14/browser5 GREEN. Intermediate source versions4/5 preserved progress; final checkpoint replaces the same source identity with the verified build. Current branch retained and two preexisting script mode changes excluded; no push/merge/deploy/public license action.

Rulings: bounded generic sheets before rules/inventory (another stage for automation); linked ownership replaces per-token control (unlink requires explicit reassignment); current full snapshots for actor/ACL changes (bandwidth cost until scoped deltas/pagination). Reviewer set aside full rules/inventory/fog, portable distribution and unverified OS/network/load acceptance as explicit later stages; documentation completed here. None is claimed complete.

The final distribution requirement is AGENTS rule9: ready-to-run headless host without Node/pnpm/Rust/Visual Studio/database installations, preferably extract-and-run. This source checkpoint is not that package yet. Next: T012 manual fog, then dice/chat/journal/combat/recovery and verified portable hosting.

---

# Historical build0.0.3 record (superseded by the current increment)

# Hearth VTT · Build0.0.3 · 2026-10-23

## Current increment

Browser-only DM/player app with an independent authoritative Rust host. This stage adds bounded custom scenes/map uploads and token CRUD to the live foundation. Cumulative scope: owner setup/login, saved campaigns, invitations/revocation, private/shared sample journals/art, stable local pan/zoom/fit, live assigned-player movement and DM visibility/control, reconnect/receipt protection, pre-upgrade database snapshots, plus the authoring below. Private development source checkpoint; not the playable P0 release. Recurring short product report: BUILD_OVERVIEW.md (AGENTS rule8).

New: sniffed PNG/JPEG/WebP upload, canonical RGBA PNG blobs, campaign ownership/deduplication/quotas and protected streaming; new private scenes with square-grid sizing; local DM preparation selection; explicit active scene/concealment; token create/edit/delete with name/art/size/position/visibility. New tokens default private. Players receive only the active shared scene and its shared tokens; switching local DM selection does not move them. Existing scene is active after upgrade. Migration0003 adds asset metadata and active/private scene state; the storage build script tracks newly added embedded migrations.

Limits:8MiB input,4096px/side,16MiB canonical output, two concurrent uploads with10-second body deadline;32 assets/100MiB,8 scenes,100 tokens per campaign. Decoder allocation hint128MiB is not a process memory guarantee. Full backups now require the assets directory. Actors/ActorOwnership/linking/sheets, scene rename/delete, fog, dice/chat/combat, journal authoring, full restore and prebuilt server distribution remain next stages.

## Verification for this build

| Actual command/check                                                   | Result                                                                                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `cargo test --workspace --locked`                                      | PASS,24 tests:4 server unit +18 actual API/TCP integration +2 storage/upgrade; doc tests pass                                    |
| `cargo clippy --workspace --all-targets --locked -- -D warnings`       | PASS                                                                                                                             |
| `pnpm test`                                                            | PASS,11 protocol/reducer/hook/editor tests                                                                                       |
| `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141 headless path> pnpm test:e2e` | PASS,3 real-server browser scenarios,2.0min total                                                                                |
| Source launcher smoke                                                  | PASS on Linux: dependency install/build/start, health version0.0.3 and browser bundle, Ctrl+C shutdown with no listener retained |
| `pnpm audit --prod --json`                                             | PASS,zero reported known vulnerabilities across25 runtime/optional dependencies; not a Rust advisory scan                        |
| `cargo metadata --locked --format-version 1`                           | PASS,refreshed complete package-declared Cargo license inventory                                                                 |

Final documentation-pass checks: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm check:features` (179/179), `cargo fmt --all -- --check`, explicit included-case rustfmt check and `git diff --check` all PASS. Frozen dependency install also passes through the launcher. Browser: Chromium141.0.7390.37 headless/software WebGL on Linux. Actual Windows/macOS launcher execution, physical LAN/WAN/TLS/firewall, current Chromium/Firefox/WebKit, sustained load/crash and full-data restore remain unverified. Windows wrapper/prerequisites and exact local/LAN test instructions are supplied in START_HERE.md; this is still source distribution. No runtime cloud dependency.

Browser scenario1 retains owner/Alice/Bob account/campaign/invite/visibility/journal/media/cache tests plus live movement, camera/art recovery/reconnect and continued player movement after DM browser closure. Scenario2 uploads a custom map, prepares a private draft, creates/assigns/edits a token, activates/moves/conceals/reconnects/deletes it, checks protected media denial and restores the original active table. Scenario3 holds a real command acknowledgement, navigates away during a pending drag and verifies renderer cleanup without a page error. Custom table screenshot inspected internally; screenshots are excluded from source delivery.

API/TCP tests cover MIME sniffing, malformed/truncated/oversized/dimension-invalid images, canonical stripping of appended bytes, real JPEG/WebP acceptance, quota failure, upload dedupe, foreign-campaign asset denial, private preparation, scene/token command receipts and active-scene movement, concealment/media denial and metadata/blob restart. Eight simultaneous undrained large image responses have bounded first chunks; not a sustained-load benchmark.

## Review, regression evidence and scope

One fresh whole-change review found four Important issues. All were reproduced RED then fixed GREEN: queued private draft history exposed after an activation during a write (persist event-time publication and recheck current authority); REST authorization/projection split across inconsistent reads (one read transaction); whole-image buffers for every response (stream from disk); an edited token disappearing causing an accidental create form (explicit pinned edit target/mode). A further invalid pasted authoring payload locking the entire editor was regraded material and fixed by validation before setting busy, with a hook regression. No re-review dispatch.

Previously deferred K011 was reproduced by the pending-drag browser regression, then fixed with an explicit disposed guard. Minor K012 (cancelled dialog's delayed callback changing only local DM selection) remains documented for the next authoring slice. Existing K007 finer boundary assertions remain queued. No scene activation or player disclosure follows from K012.

A final campaign-summary regression reproduced private draft counts in player list/detail responses (2 instead of1); both summary SQL projections now count only player-visible active scenes, with DM count and concealed-zero assertions. Initial feature tests failed missing upload404, absent active/private state and rejected authoring wire commands. A malformed media authorization SQL parenthesis was caught by a protected-download test and corrected. New migration incremental tracking was corrected via a failing version assertion/build.rs. Material privacy/lifecycle regressions were verified before final suites. No master feature promoted to VERIFIED for a partial slice; all179 IDs retained.

The runtime workspace was an older Stage1 snapshot, so the saved verified0.0.2 source was restored first (commit1d40673) and its18 Rust tests passed before implementation. Existing private branch retained; two unrelated executable-bit changes on scripts/dev.sh and scripts/test.sh preserved outside commits. No public push, merge, deployment or license choice. The source archive is the private resumable checkpoint. NEXT_TASKS continues actor ownership/linking, then manual fog.

---

# Historical build0.0.2 record (superseded where0.0.3 adds functionality)

# Hearth VTT · Build 0.0.2 · 2026-10-23

## Current increment

Browser-only DM/player web app, independent authoritative Rust host. T008 live foundation plus bounded sample-token ownership/movement/visibility from T009–T011. Existing account/campaign/invitation/journal/art features are retained. This is a private development checkpoint, not the playable P0 release. The short recurring product report is BUILD_OVERVIEW.md; AGENTS rule8 records the user's requested report after every update.

Implemented: hearth.v1 cookie/Origin/subprotocol-checked WebSockets; transactional per-campaign revisions/events/receipts; strict move/assign/visibility commands with player ownership and coordinate bounds; saved request dedupe/collision/stale-base checks; filtered fresh snapshots and ordered small live events; queued-frame permission rechecks; session/member revocation and protected-cache eviction; bounded connections/messages/rates/writes/history and graceful shutdown. Fresh reconnect snapshots deliberately replace historical replay. A pending command keeps its exact ID/body through transport reconnect; interrupted authorization polling clears pending/busy state. The local Pixi renderer preserves pan/zoom across updates, with drag/grid snap, arrow-key/numeric controls and a DM controller/visibility inspector. Failed map/token downloads retry after reconnect or via Retry artwork.

Migration0002 adds revisions/controllers/receipts/events. Existing stores receive a consistent VACUUM INTO pre-upgrade database snapshot with integrity/FK and SHA-256 verification before migration. A real v1 fixture verifies preserved Unicode data, original backup schema/checksum and no duplicate backup on reopen. Migration0001 is unchanged. Whole-data export/restore/crash injection is still pending.

## Verification for this build

| Actual command                                                         | Result                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                                            | PASS, recommended Biome checks                                                                            |
| `pnpm typecheck`                                                       | PASS, strict app/shared/test types                                                                        |
| `pnpm test`                                                            | PASS, 8 tests: 7 protocol/reducer/random-ID +1 hook regression                                            |
| `cargo fmt --all -- --check`                                           | PASS                                                                                                      |
| `cargo clippy --workspace --all-targets --locked -- -D warnings`       | PASS                                                                                                      |
| `cargo test --workspace --locked`                                      | PASS, 18 tests:2 queued-permission unit +14 real API/TCP integration +2 storage/migration; doc tests pass |
| `pnpm build` + `cargo build -p hearth-server`                          | PASS, production web bundle and actual Linux host development build                                       |
| `HEARTH_CHROMIUM_EXECUTABLE=<Chromium141 headless path> pnpm test:e2e` | PASS, 1 comprehensive real-server/three-identity browser scenario, 46.8s scenario /48.3s total            |
| `pnpm check:features`                                                  | PASS, all179 original feature IDs retained                                                                |
| `pnpm audit --prod --json`                                             | PASS, zero reported vulnerabilities across25 runtime/optional dependencies                                |
| `cargo metadata --locked --format-version 1`                           | PASS, refreshed package-declared license inventory in DEPENDENCIES                                        |
| `git diff --check`                                                     | PASS                                                                                                      |

Rust tests use real TCP WebSockets for handshake, DM/Alice/Bob projection, forged movement, duplicate/colliding requests, stale revisions, concurrent moves, coordinate bounds, revocation/expiry and close/reopen persistence of positions/receipts/host stream ID. Two injected-sender tests commit concealment/revocation during a queued write and prove the next frame rechecks authorization. Reconnect always reads current state. No crash/power-loss or sustained load claim.

The real browser scenario retains first-run/invitation/private REST/art/journal/Unicode-campaign/account-switch regressions and adds live assignment, three-view movement convergence, numeric/arrow/drag controls, conceal/reveal, offline editing pause, fresh reconnect catch-up, identical canvas element/zoom preservation, failed background/token artwork recovery without reload, and player movement after closing the DM browser context. It records zero page errors and checks received player WS payloads for original private art/journal markers. Screenshots were inspected internally and are excluded from source delivery.

Actual browser: Chromium141.0.7390.37 headless with software WebGL on Linux, using the supported executable override. Current Chromium/Firefox/WebKit, Windows execution, physical LAN/WAN/TLS/firewall, sustained slow-consumer load and complete backup restore are unverified. CI is configured but not remotely run. Toolchain binaries were restored in this environment; original baseline product tests passed before the live slice, and the new WS tests failed404 before implementation. No runtime cloud dependency was added.

## Review and decisions

One fresh whole-change review found three Important issues and one Minor. The Important issues were reproduced and fixed: queued conceal/revoke race (2 Rust tests RED→GREEN), pending command leaving busy set after a polling error (hook test RED→GREEN), and artwork failure with no recovery (real browser regression RED→GREEN). A further hidden/unknown forged-move error equality regression failed then passed after filtering private rows before mutation lookup. The full suites pass after fixes. The minor pending-drag/unmount reconciliation issue is explicitly deferred as K011; do not lose it before expanding canvas authoring. Previous K007 finer boundary coverage remains queued.

Keep the existing private development branch and source checkpoint; no public push, merge, deployment or license decision. No master feature is promoted to VERIFIED for this bounded slice. All179 IDs remain. Per-token Actor/ActorOwnership, arbitrary protected media and authoring remain the next data-model stage. NEXT_TASKS gives exact continuation.

---

# Historical Stage 1 record (superseded where the current build above adds functionality)

# Hearth VTT · Stage 1 checkpoint · 2026-10-22

## Browser-only direction update

The user clarified the product direction after this checkpoint: both DM and players use the web app, while the DM runs the headless hosting server. Native desktop shells/installers are cancelled, not deferred. The existing Rust/React runtime already supports this split; its source is retained. The master plan, architecture, backlog, hosting guide, release guidance and in-app help now follow ADR-0002. The obsolete host-desktop placeholder is removed. No gameplay or remote-network feature is newly claimed.

## Repository inventory

Before work: only the supplied `PRIVATE_VTT_CODEX_MASTER_PLAN(1).md` attachment, no application/repository/tests or existing code. Node 24.19.0/pnpm 11.25.0 were present. Installed the official Rust 1.99.1 toolchain and created a new Cargo/pnpm repository on `stage-1-foundation`. The source specification is preserved in the root. All 179 master feature IDs are retained in FEATURE_MATRIX.

## Working increment

Actual Rust host and built React UI: versioned health, owner setup/login/logout, Argon2id/password validation, random hashed expiring/revocable sessions, membership-scoped persisted campaign create/open/rename/archive/unarchive, per-player single-use invitations with expiry/revocation and atomic redemption, campaign access revocation. Original seeded scene/journals/art are server-filtered for DM/player views and protected by authenticated media routes. Pixi supports local pan/cursor zoom/fit; this is a read-only sample, not synchronized gameplay.

Run from the source root: `pnpm install --frozen-lockfile`, `pnpm build`, `cargo run --locked -p hearth-server`; open `http://127.0.0.1:8787`. Hot reload: `pnpm dev`. No cloud account or runtime external request is required. Data lives in the configured user-local root, outside source/build/install folders. See README/HOSTING for Windows toolchain prerequisites and explicit private-LAN setup.

Concrete code paths: `crates/{domain,storage,server}`, `apps/web`, `packages/{protocol,ui}`, `content/examples/amber-keep`, `tests/e2e`, `scripts`, `.github/workflows/ci.yml`. API/security/data/hosting/user/DM/recovery/release documents reflect the current implementation.

## Verification performed

| Actual command                                                       | Result                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                     | PASS; frozen workspace dependency resolution                                                                                          |
| `pnpm lint`                                                          | PASS; recommended Biome rules, no diagnostics                                                                                         |
| `pnpm typecheck`                                                     | PASS; strict web/shared-package/test configuration                                                                                    |
| `pnpm test`                                                          | PASS; 3 protocol rejection tests                                                                                                      |
| `cargo fmt --all -- --check`                                         | PASS                                                                                                                                  |
| `cargo clippy --workspace --all-targets --locked -- -D warnings`     | PASS; no warnings                                                                                                                     |
| `cargo test --workspace --locked`                                    | PASS; 10 server integration + 1 storage test; doc-test targets also pass                                                              |
| `pnpm build`                                                         | PASS; production Vite/TS build, lazy Pixi, no large-chunk warning                                                                     |
| `cargo build -p hearth-server`                                       | PASS; actual Linux web-server development build                                                                                       |
| `HEARTH_CHROMIUM_EXECUTABLE=<installed Chromium path> pnpm test:e2e` | PASS; 1 comprehensive real-server scenario, 3 isolated identities plus same-cookie account-switch tab; 42.9 s scenario / 44.8 s total |
| `pnpm check:features`                                                | PASS after making whitespace parsing tolerate formatted Markdown; 179/179 IDs and valid statuses                                      |
| `pnpm audit --prod --json`                                           | PASS; zero reported runtime vulnerabilities across 25 runtime/optional dependencies                                                   |
| `cargo metadata --locked --format-version 1`                         | PASS; 214 registry package declared-license entries recorded in DEPENDENCIES; not a full Rust advisory scan                           |

Browser verification used Chromium **141.0.7390.37** headless, software WebGL, on this Linux environment. Newer Playwright browser downloads returned invalid archives; an official older build succeeded via the alternate mirror. Current Chromium/Firefox/WebKit, Windows server execution, physical LAN/WAN, firewall, A/V, server distribution and release performance remain **unverified**. Internal screenshots were visually inspected; no screenshots are included in the source deliverable.

The browser scenario exercises owner first run, real Pixi rendering, separate Alice/Bob identities, private token/journal/art filtering, access revocation, Unicode campaign creation/archive, logout/login and a second tab changing the shared cookie to Alice. Fresh review found one important client-cache issue; the regression failed with a private DM journal still present, then passed after protected caches were isolated by user identity and cleared on unmount. No browser page errors were recorded. Minor additional boundary assertions are queued as K007.

Initial red tests confirmed missing health/auth/storage/projection behavior and permissive protocol validation before implementation. Transient tooling failures (SQLx 0.9 disallowing dynamic SQL, stale incremental Rust artifacts, unavailable current browser binaries and Markdown table whitespace) were corrected; none is a remaining failed check. CI is configured for Linux/Windows but was not run on a remote repository.

## Feature state and release gate

Foundation-related ADM-01..06, MAP-01..03, TOK-01..02, JRN-01..02, MED-01, UX-01..02/04 and OPS-01..05/09 moved to SCAFFOLDED or IN_PROGRESS as detailed in FEATURE_MATRIX. No broad master feature is VERIFIED merely because a subset passed. Phase 0 still needs the simplified server-hosting workflow and migration/recovery work; desktop app work is no longer in scope. The P0 playable release gate is open.

Not yet functional: scene/map upload/authoring, actor/token ownership and movement, WebSocket command/reconnect synchronization, fog editing, dice, chat/whispers, actor sheets, combat, safe content imports, export/restore UI, owner recovery, existing-account invitation redemption, simplified server distribution and secure internet hosting. The whole-map download limitation is stated in the UI.

## Next three actions

1. T008: versioned authenticated WebSocket protocol, authoritative revisions/receipts, projection/revocation and reconnect tests.
2. T009–T011: editable scene/actor/token ownership models, validated protected map upload and synchronized owner-authorized movement.
3. T012: persisted manual fog and DM-only authoring with hidden-byte/asset/projection tests.

Exact dependencies, acceptance checks and follow-on tasks are in NEXT_TASKS. Resume there; do not restart the repository or re-plan the full product.

Browser-only correction checks: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm check:features` and `git diff --check`. These validate the documentation/help-text scope; the earlier full gameplay foundation test results above belong to the unchanged backend and core UI.
