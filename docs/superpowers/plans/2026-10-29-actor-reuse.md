# Actor reuse and copy recovery implementation plan

Continue66c2899 autonomously with superpowers:executing-plans inline, test-first and one independent final review. Existing clean work checkout and just-passed0.0.24 release gate are the baseline; do not repeat completed work.

**Goal:** Resolve K022 for journal copies and add same-campaign GM actor copies as the next EXT-01 foundation. Preserve Rust authority, UI_STANDARDS,16-record quotas and schema20/wire1. No new dependency/migration or dedicated library.

**Design:** A shared PrivateCopyDialog retains fixed destination ID/name, failed drafts and explicit stale reload. Reconcile that ID against the current authorized record list: if present, disable creation and offer Open saved copy even if the source was deleted/changed or quota filled. Pending work cannot be dismissed/opened. JournalCopy becomes a thin adapter; Actors uses the same dialog. This is a local builder decision under the user's autonomous continuation instruction.

`actor.copy` accepts exactly sourceActorId,expectedVersion,actorId,name. Current GM membership/campaign/archive/source version/fresh ID/media/quota checks run in the existing atomic transaction. Copy stored kind, portrait reference, biography, GM notes, current/max HP and custom properties; default private/version1. Never copy actor_ownership, token links/controllers/statuses or combat entries; source remains unchanged. Current HP is copied, not reset. Built-in/custom portrait authority stays independent. Separate libraries/items/scenes/cross-campaign reuse remain later work.

## Tasks

- [x] K022: add failing Journals regression for a committed destination arriving after send rejects; preserve title, disable retry and open/select the saved copy even if source removed and campaign full. Extract PrivateCopyDialog and make the regression and existing UI suite pass.
- [x] Host/protocol: observe unsupported actor.copy RED. Cover exact source fields/private version1/no owners or token links/source unchanged, player-owner rejection, REST/live secret absence, built-in/custom assets, receipt replay/conflicting reuse, stale/foreign/unknown/invalid source versions/occupied IDs/quota/archive. Implement CopyActor/domain routing/strict schema/actors apply; GREEN.
- [x] Actor UI: failing missing-action tests, then GM-only Use as template; full/offline/stale/deleted/failed title/recovery states via shared dialog. Keep existing wrapped actor controls and selection behavior.
- [x] Extend real GM/Alice/Bob workflow with uploaded portrait actor copy, copied GM notes/HP/properties, private REST/frame absence, explicit sharing, independent edits/source links and restart. Capture dialog and actions at1440×1000,760×700,390×700,900×520; assert containment/visibility. Add copied actor backup row/no grants/no token-link recovery fixture; original10–19 upgrade remains unchanged.
- [x] Bump0.0.25 only, frozen local-cache/store metadata refresh. Focused tests, one independent review, full pnpm verify:release; inspect screenshots before completion. Record actual evidence, K022 resolution/new limits and next library/P0 steps; retain179 IDs and manual LAN/platform/distribution gates. Commit locally, no automatic push.

## Review focus

Uncertain confirmation with destination appearing before/after an error, then source deletion or authorization loss; linked actor HP/version races; independent portrait grants; preserved private GM notes; source/destination name/permission changes while dialog is open. Review beyond tests; no automatic ownership, token or cross-campaign copying.

## Completion ·2026-10-29

Implementation `4c7b1a222813c2df09acd40ae46d10f5c30c16fe` passes complete optimized release verification: workflow7/TypeScript135/Rust115/browser17 in6.6m; final expanded workflow1.0m. K022/protocol/actor UI/real host regressions observed RED→GREEN. Current actor backup plus existing canonical10–19 recovery pass. Actual GM/Alice/Bob lost acknowledgement with unchanged15s client timeout, private actor copy/GM-note/ID filtering, independent edits and portrait sharing/restart pass. The new20s recovery assertion accommodates the actual timer without raising any existing timeout or overall120s case limit. Four-size dialog/action and saved-copy recovery captures inspected. One independent review found no blocking defect; Minor K013 protocol UTF-16 actor-copy name mismatch remains documented for actor/library/localization hardening. No second review or new scope ruling. Schema20/wire1/all20 migrations/dependencies unchanged. Local commits only; no push or real campaign update. Dedicated libraries/items/scenes/cross-campaign content and manual LAN/platform/30-minute/distribution gates remain open.
