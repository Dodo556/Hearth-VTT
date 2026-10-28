# Current cloud candidate ·0.0.16/schema13 ·2026-10-28

UI correction requested by the owner before further canvas features. No backend/protocol/schema/dependency change. The implementation replaces the horizontal drawing form with a vertical icon palette, shared tool-button states, a contextual editor and responsive overflow behavior; UI_STANDARDS.md is required by AGENTS.

Focused evidence: old select/missing icon component tests RED→GREEN; original browser panel exceeds the56px palette-width assertion. Updated full drawing workflow and1440/760/390/900×520 layout checks pass51.2s. Temporary swatch-picker outside dismissal also observed RED→GREEN. Complete optimized candidate gate, inspected captures and independent review follow here before final delivery. Prior0.0.15 test counts below are historical.

The visual check found the390px instruction hint overlapping camera controls; reserve a right-side lane. A repeat pixel equality failure was traced to a24×18px HTML camera readout region only; the actual tabletop pixels were identical. Hide that DOM readout in both compared canvas screenshots, retaining exact drawing/map equality. The next run passes this comparison and the camera-lane check, then reproduces the review's wide-sidebar case. No renderer behavior, assertion timeout or map assertion is weakened.

One fresh review of7d30bd4..8b9c643 found a supported641px/520px sidebar configuration hiding the editor, plus focus loss when a keyboard-selected swatch unmounts. The sidebar browser regression fails before the fix; available editor space and resize handling now govern sidebar coexistence. Focus-return unit regression also fails then passes after restoring focus to the color trigger on selection/Escape. Outside-pointer dismissal keeps the pointer destination. Final integration/capture evidence follows; no second review.

## Confirmed0.0.16 candidate evidence

Tested implementation: `d53b3cec357ef6a7068ab001dfe33ebb474c9756`; final edits are documentation/evidence only. Linux, Node24.19.0/pnpm11.25.0/Rust1.99.1, installed Chromium154.0.8037.57/headless/software WebGL, four Cargo jobs and CARGO_INCREMENTAL=0. Schema13 and wire1 are unchanged. No new runtime dependency; no backend/protocol/migration files changed.

One complete `pnpm verify:release` rerun is confirmed with child process status `{"code":0,"signal":null}` recorded by a Node spawn wrapper. Workflow assertions7 (direct named run), TypeScript76 in23 files, Rust85, lint/types/Rustfmt/Clippy, all179 IDs, matching optimized host/web and browser13/13 in4.0m pass. Drawing/privacy/restart/undo/context recovery and new responsive case50.4s. Every previous scenario remains; no skipped check, shortened functional assertion or increased timeout.

The prior complete run also printed all checks passed/browser13, but its enclosing shell reported1. Retain that anomalous run separately; it is not the confirmed exit0 evidence. Rerun the unchanged source and identical verification command with actual child status recorded, rather than infer process success from log prose. The final run above resolves the candidate exit-status gate.

The fresh whole-change review found one Important layout issue and a focus-loss issue initially labeled Minor. Focus loss prevented normal continuation/second Escape, so both were treated as functional fixes. Supported520px sidebars near641px and dynamic resize now collapse safely when editor space is insufficient; real browser RED→GREEN covers text and color controls. Swatch selection and picker Escape restore trigger focus, with component RED→GREEN. No new deferred review finding; earlier K019 remains unchanged. No second review.

Captures from the same implementation pass with fictional Game Master/Alice/Bob and zero page errors. Inspected1600×1000 palette-only and text-editor views,760×700 with sidebar, and390×700 with collapsed sidebar. The constrained hint leaves camera controls clear. Browser geometry additionally verifies900×520 short-height action reachability, editor/palette/dock separation, resize transitions and draft retention. Capture ran sequentially outside browser regression jobs:

`HEARTH_TEST_HOST_BIN=target/release/hearth-server node scripts/capture-drawings.mjs /workspace/artifacts/0.0.16/Hearth_VTT_0.0.16.png /workspace/artifacts/0.0.16/Hearth_VTT_0.0.16_narrow.png /workspace/artifacts/0.0.16/Hearth_VTT_0.0.16_palette.png /workspace/artifacts/0.0.16/Hearth_VTT_0.0.16_constrained.png`

This is a validated UI candidate, not verified-playable promotion. Physical LAN/30-minute encounter, target platform/current-browser matrix, accessibility/touch audit and ready-to-run host distribution remain open. Source commits are local; no automatic push/publication. UI_STANDARDS.md and AGENTS rule13 govern following workspace changes. Scene notes resume next.

## Previous validated0.0.15 evidence

# Current cloud candidate ·0.0.15/schema13 ·2026-10-28

Status: **complete automated candidate gate passed; not verified playable**. This is the same maintained Hearth application with literal text drawings added to saved lines/rectangles/freehand. No new dependency; wire schema1 remains. Manual LAN/30-minute encounter/platform/browser/distribution gates remain open.

## Actual0.0.15 evidence

Tested implementation revision: `b2a6e09ac336b6a85ea934605ffb4d99a2d8cdf6`. Later commits record documentation and the screenshot-fixture correction only; application source stays unchanged. Baseline is pushed0.0.14 revision2c8d92e. Linux, Node24.19.0/pnpm11.25.0/Rust1.99.1, installed Chromium154.0.8037.57/headless/software WebGL, four Cargo jobs and CARGO_INCREMENTAL=0. Every browser/recovered host uses the matched optimized0.0.15 candidate and disposable data.

Command: `source /workspace/hearth-tools/activate.sh`, then `pnpm verify:release`. One complete run, exit0. No retries/skips/assertion removal or timeout increases. Browser13/13 in3.7m; text scenario43.5s. `node scripts/verification.test.mjs` separately passes all7 named assertions; the shared runner reports one aggregate Node test file in this runtime.

| Check                    | Actual result                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Workflow                 | PASS7 direct assertions; shared runner aggregate passes                                                                                    |
| TypeScript               | PASS72 tests in22 files; strict web/test types pass                                                                                        |
| Rust                     | PASS85 workspace tests, none ignored; Rustfmt and Clippy pass                                                                              |
| Inventory                | PASS179 distinct IDs retained, none VERIFIED                                                                                               |
| Builds                   | PASS matching0.0.15 web and optimized host                                                                                                 |
| Browser suite            | PASS13/13 in3.7m, including every prior flow                                                                                               |
| Compatibility            | PASS12→13 rowids/order/nonces/point preservation, original-schema10/11/12 isolated recovery, literal shared/private text backup round trip |
| Snapshot bounds          | PASS full maximum-freehand and maximum-Unicode/escaped-text campaign snapshots, each within4MiB; inbound remains16KiB                      |
| Fresh independent review | No Critical/Important issue; one deferred Minor test-coverage gap K019                                                                     |

Browser evidence includes actual rendered GM/Alice/Bob text, literal markup/Unicode in authoritative data,1.2× zoom coordinates, an unchanged pixel strip below the box, private text/ID absence from player frames, text-edit/Escape cancellation, restart, reconnect and undo. Existing drawing/freehand/capture-loss/multiple-pointer/settings/offline/navigation coverage remains. Text is present during forced actual WebGL context loss/restoration; exact canvas pixels recover and real GPU draw calls return to idle. The strip comparison is not an all-edge/fallback clipping proof; see K019. The production mask and managed text-resource cleanup were independently inspected.

## Failures observed and resolved

New protocol/host/migration tests failed before implementation: unsupported text, malformed frame instead of expected player FORBIDDEN, and missing text column. Helper module initially absent. A pre-feature browser trace reached the final original Undo assertions then waited for the absent Text select option until the unchanged120-second timeout; it did not fail an earlier player-rendering assertion. Matched0.0.15 focused scenario then passed40.5s before the added text context/idle assertions.

Boundary exploration reproduced64.07−24.07 as39.99999999999999. Both helper and actual TCP host rejected an exactly40-pixel box; comparing normalized integer hundredths fixes the same failing tests, and the complete final gate includes that correction. After the version bump, pnpm's metadata refresh first hit restricted cache/store permissions; frozen reinstall with normal cache access passed without dependency/lockfile changes. No failed required check remains hidden by combining subset results.

## Review and retained boundaries

One fresh gpt-6-astra/high read-only review covered2c8d92e..b2a6e09: no Critical/Important correctness, authorization, privacy, migration or lifecycle issue. Minor K019: a below-box screenshot strip does not establish immediate all-edge clipping with difficult fallback/combining glyphs. Defer that additional rendering regression; no production mask defect was found and no stronger test claim is made. No second review.

Rulings on the review's declined scope: retain manual Windows/macOS/current-browser/LAN/session/distribution gates as explicit open acceptance work (cost: no portability or verified-playable guarantee); retain the existing trusted-backup contract rather than promise semantic repair of arbitrarily edited databases (cost: manual semantic corruption may leave restored content unusable); keep rich text/individual editing/scene notes in the subsequent handoff slices (cost: those tools are unavailable in0.0.15). No new runtime trust boundary or source-publication action.

## Captures and delivery

Desktop/narrow capture is run sequentially after the complete browser gate with fictional Game Master/Alice/Bob and actual saved shared text/freehand plus a private rectangle. Exact command after activation: `HEARTH_TEST_HOST_BIN=target/release/hearth-server node scripts/capture-drawings.mjs /workspace/artifacts/0.0.15/Hearth_VTT_0.0.15.png /workspace/artifacts/0.0.15/Hearth_VTT_0.0.15_narrow.png`. PASS: actual1600×1000 desktop and760×700 narrow images captured and visually inspected, zero page errors; narrow text controls are reachable without sidebar overlap. The first capture failed because the chosen start point(678.97,248.25) lay inside the measured toolbar rectangle(78,102)–(690.14,256). A separate diagnostic screenshot/bounds confirmed this; moving the gesture to scene(820,190)–(1260,310) fixes the fixture, with a guard that reports future toolbar overlap. No application code or test timeout changed and the integrated browser gate remained intact. Source packaging excludes databases, uploaded campaign artwork, dependencies, builds and credentials. Migrations0001..0012 remain byte-identical to the preceding source.

## Previous validated0.0.14 evidence

# Current cloud candidate ·0.0.14/schema12 ·2026-10-27

Status: automated candidate gate passed; not verified playable. Verified-playable promotion remains blocked by the existing P0/platform/distribution/LAN/session gates.

The imported0.0.13 source checkpoint c50056b passed one complete optimized gate in this cloud environment: direct workflow7, TS63, Rust77, types/lint/fmt/Clippy/inventory, full web/host builds and browser13/13 in3.3m on Chromium154.0.8037.57/Linux/software WebGL. Earlier restricted-sandbox TCP failures were all local listener permission denials; the successful full rerun used local sockets. Default Chromium156 download was domain-denied; no matching-browser or cross-platform claim.

The0.0.14 feature's new host/protocol/upgrade tests failed before implementation and passed afterward. Sampling tests cover bounded long paths and closed loops. Storage suite covers schema10/11 recovery and exact freehand point preservation. Existing drawing browser acceptance first caught an Undo-acknowledgement timing assumption: an HTTP-visible save preceded the browser becoming ready; the fixture now waits for the existing enabled control, retaining all functional assertions and timeouts. The expanded rendered GM/Alice/Bob stroke/undo/restart test subsequently passed, followed by the complete cancellation/zoom scenario (38.7s) and the full optimized gate.

## Actual0.0.14 cloud evidence

Implementation revision: `ca83eceab77d1587075bb1dedd66b05f324a75c6`; later evidence-only edits are separately committed. Linux, Node24.19.0/pnpm11.25.0/Rust1.99.1, Chromium154.0.8037.57/software WebGL, four Cargo build jobs, CARGO_INCREMENTAL=0, default target directory. All thirteen browser scenarios use matched optimized0.0.14 hosts and web assets with disposable data.

Commands: `source /workspace/hearth-tools/activate.sh` then `pnpm verify:release`. Exit0 in one complete run; browser13/13 in3.6m. Direct `node scripts/verification.test.mjs` also reports7/7 named workflow tests; the runner's `node --test` reports one aggregate file result in this runtime.

| Check                           | Result                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Workflow assertions             | PASS7, direct named run; shared runner aggregate file passes                                                           |
| TypeScript                      | PASS67 tests/21 files; types and lint pass                                                                             |
| Rust                            | PASS81 workspace tests, zero ignored; formatting and Clippy pass                                                       |
| Inventory                       | PASS179 distinct feature IDs; none VERIFIED                                                                            |
| Complete builds                 | PASS matching web and optimized host0.0.14                                                                             |
| Complete browser gate           | PASS13/13 in3.6m, no skips/retries/removed assertions                                                                  |
| Compatibility                   | PASS schema10/11 archive recovery, saved legacy line/nonce,11→12 order/point storage, exact closed-stroke backup bytes |
| Full snapshot                   | PASS2429902 bytes for maximum combined campaign content, within4MiB                                                    |
| Screenshots                     | PASS actual GM1600×1000 and narrow760×700, both visually inspected                                                     |
| Independent whole-change review | PASS; no Critical/Important code findings; stale API bounds corrected                                                  |

Browser drawing acceptance covers actual player pixels, a closed stroke authored at1.2× zoom, private keyboard path/raw-frame filtering, Escape, pointercancel, actual lost capture, extra pointers, color changes, offline/reconnect, navigation, host restart and undo. Existing context-restoration/idle rendering, campaign/token/actor/fog/dice/chat/combat and full-host recovery scenarios remain in the same full gate.

Screenshot command: `HEARTH_TEST_HOST_BIN=target/release/hearth-server node scripts/capture-drawings.mjs /workspace/artifacts/Hearth_VTT_0.0.14.png /workspace/artifacts/Hearth_VTT_0.0.14_narrow.png`, after sourcing the activation script. PASS with fictional Game Master/Alice/Bob and actual persisted shared freehand/GM rectangle; no page errors. Capture ran only after the complete browser gate ended. Both images were inspected; narrow controls remain reachable without sidebar overlap.

One fresh independent read-only whole-change review of c50056b..3e5f2b3 found no Critical/Important correctness, privacy, migration or lifecycle issue. Its one Minor finding was stale general API buffer limits. Final documentation updates align all three older buffer descriptions with the tested4MiB contract; no runtime code changed after the gate and a fresh lint check follows. No second review. Direct scene/tool/layer/permission-loss browser variants remain a future coverage recommendation; inspected shared reconciliation/disposal paths handle those changes. Manually rewriting trusted backup database semantics remains outside the unchanged recovery trust model: use trusted backups, and do not infer arbitrary semantic corruption repair. No new deferred code defect.

Residual limits: no actual LAN/30-minute P0 encounter, Windows/macOS/current Chromium156/Firefox/WebKit/firewall, portable package or WAN claim. The imported remote remains without a main ref; source commits are local and fresh-task restoration is unverified. Environment install/start instructions were saved as a draft, not published.

## Historical handoff candidate evidence ·not this cloud feature candidate

# Release validation status

Status: **Partially functional; verified-playable promotion remains BLOCKED.**

Current candidate: application0.0.13, database schema11. This is the same maintained Hearth application, with the player-canvas correction. No published migration, persistent format, protocol, authority or dependency changed. All179 feature IDs/states remain.

## Current candidate evidence ·2026-10-27

| Check                                    | Result  | Scope                                                                                                                               |
| ---------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Workflow tests                           | PASS,7  | Shared fail-fast/version/environment/candidate-host rules                                                                           |
| TypeScript tests                         | PASS,63 | Existing59 plus4 scheduler coalescing/animation/disposal tests                                                                      |
| Types/lint/inventory/web                 | PASS    | Matching0.0.13 browser bundle;179 IDs                                                                                               |
| Rust formatting/Clippy/workspace tests   | PASS,77 | One complete current workspace run, not a sum of stale/subset executables                                                           |
| Focused browser correction               | PASS    | Final map scenario29.0s: rendered GM/two-player tools, idle GPU calls, actual ruler/zoom pixels and forced context loss/restoration |
| Optimized host build                     | PASS    | Fresh output directory, pinned Rust1.99.1, unchanged thin-LTO profile                                                               |
| Complete optimized validation            | PASS,13 | One complete final shared command: workflow7/TS63/Rust77/types/lint/Clippy/inventory/web/optimized host; browser13/13 in4.2m        |
| Final review/screenshots                 | PASS    | One Important review finding reproduced/fixed RED→GREEN; real GM1600×1000, player1440×1000 and narrow760×700 images inspected       |
| Remote CI/manual platform/LAN/P0 session | NOT RUN | No corresponding acceptance claim                                                                                                   |

The first shared run stopped on a new Markdown formatting issue, which was corrected. The following run passed all checks through browser-bundle build but the original output tree's optimized host failed linking with undefined hidden Rust symbols. An identical fresh-target optimized build passed1m53s without source, compiler-version or optimization workarounds. That failed run is not release evidence; only a subsequent complete successful shared run can satisfy the automated candidate gate.

Browser validation uses official Chromium141.0.7390.37 headless/Linux with software WebGL and disposable campaign roots. Default current Chromium156 downloads returned invalid archives; current-browser acceptance remains open. Do not dismiss a product assertion failure as environmental.

Tested implementation revision: `6ca53d183841d5fa5a1b022a324a7d410e4b2ef4` (runtime restoration correction at `e3d22949c33f24dec63e790dbdce1a7f909df873`). Final command: `CARGO_INCREMENTAL=0 CARGO_TARGET_DIR=/tmp/hearth-clean-candidate HEARTH_CHROMIUM_EXECUTABLE=<official Chromium141 binary> pnpm verify:release`, using pinned Rust1.99.1. Later changes record documentation/delivery evidence only. All browser and recovered hosts use that optimized candidate; capture separately asserts matching host/application versions.

The independent review found one Important lost-context redraw gap, no Critical/Minor. Forced `WEBGL_lose_context` restoration reproduces it (draw count10 stays unchanged); a restored-context invalidation listener with cleanup passes the same test, with exact pre/post canvas pixels and idle again. No second review is claimed.

A subsequent complete attempt passed12/13 but an independent character scenario received the correct429 after11 cumulative auth requests on the shared test host/IP. Seven independent later scenarios now own temporary hosts, data roots, allocated loopback ports and browser cleanup, while the first3 intentionally sequential campaign flows remain together. Production limits and every functional assertion remain. The final fresh13/13 run supersedes that failed attempt; passing subsets were not combined.

## Resolved player-canvas blocker

The0.0.12 map-tool regression reproduces with live authenticated players, successful current projections and successful artwork downloads. Later Pixi initialization competes with perpetual static render loops; a temporary10FPS control resolves the original scenario and was removed. The implementation renders on visual change, coalesces frames, keeps active pings animated and cancels frames on scene disposal. No assertion timeout was increased or rendered-player requirement removed. The final browser scenario additionally checks actual ruler/zoom canvas pixel changes, resumed ping rendering and return to idle; drawing/restart now asserts actual player renderer readiness.

## Remaining promotion blockers

- The complete mandatory P0 scope, US-01..05/08/12, actual30-minute GM/two-player session and real LAN join are not verified complete. Freehand/text/notes, token bars/status/context, handout/folder/reusable content and remaining host/combat flows remain in P0_GAPS.
- Current-browser/Windows/macOS/firewall and final ready-to-run host distribution/install/update smoke remain open. No development-tools-free host package is being claimed.
- Whole-host isolated recovery, versioned migrations and verified pre-migration DB snapshots exist. Automatic rollback, universal schema downgrades and comprehensive failed-update/platform recovery remain unimplemented/unverified. Restore a compatible application/web/data/artwork/configuration pair.

No verified-playable release is designated as a last-known-good installation yet. Do not replace a real working campaign installation solely because focused or automated checks pass.

## Historical policy checkpoint

The preceding policy-only revision inspected saved0.0.12/schema11, established one application/release line and shared validation, and passed workflow7/TypeScript59/types/lint/inventory/web checks. Its full gate stopped at unavailable Cargo and did not execute Rust/optimized/browser stages. A fresh review found no important/critical issues. This history is retained separately from current0.0.13 evidence.

## Future candidate evidence

Record application version and exact source revision/archive identity; target OS/browser; matched host/web/runtime identity; old→new schema; exact commands/results; rendered GM/player and prior-flow regressions; fresh-install/backup/restore/upgrade/rollback evidence; real LAN and30-minute session evidence; complete compatible backup/application pair location; limitations and explicit promotion decision. A pending required item blocks that decision. See RELEASE.md and CONTINUOUS_DEVELOPMENT.md.
