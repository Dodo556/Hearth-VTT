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
