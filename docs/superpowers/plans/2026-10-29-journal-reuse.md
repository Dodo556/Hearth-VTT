# Journal reuse implementation plan

> Use superpowers:executing-plans inline; one final independent whole-change review.

**Goal:** Fix K021 and let a GM reuse a saved journal as a private page template.
**Spec:** NEXT_TASKS.md after0.0.23, master EXT-01/JRN-01/JRN-03 and UI_STANDARDS.md.
**Architecture:** Add journal.copy to existing authoritative transaction/receipt/snapshot routing. Copy persisted source body/format/image into a fresh private top-level page; source and recipient grants stay untouched. Existing records serve as reusable sources; a separate library and actor templates remain later work. Rust/Axum/SQLite + React/TypeScript; no dependency, schema20/wire1 unchanged.

## Constraints and decisions

Autonomous continuation and budget direction apply; execute in the existing clean cloud checkout on work. Baseline1f284b9 has the just-completed optimized0.0.23 gate; do not repeat it before changes. Same-campaign GM only, strict UUIDs, positive safe source version, fresh destination, existing16-page/80-title/1000-body limits. No sharing/folder/recipient overrides in copy payload. Reuse artwork reference rather than bytes; independent existing grants remain effective. Whole-host backup naturally includes ordinary copied journal rows/media. No cross-campaign transfer, new provenance/license claims or actor/library UI.

## Review focus

Stale/deleted source after dialog open; occupied destination and retry; source shared/selected grants never inherited; independent media grants remain effective; archived/revoked/player requests and page quota cannot bypass authority.

### Task 1: Formatting boundary

- [x] Add regression in journalFormatting.test.ts: all four block styles on one\ntwo selection[0,4) leave two untouched, collapsed[4,4) formats two, trailing selected newline does not create another block. Observe RED with focused Vitest.
- [x] In journalFormatting.ts find the last affected line using end-1 for nonempty selection, preserving collapsed caret behavior. Focused tests GREEN.

### Task 2: Reuse command and UI

- [x] Add failing protocol and real host journal.copy regressions. Payload: sourceJournalId, expectedVersion, journalId, title only. Assert player rejection, foreign/unknown source hiding, stale source refusal, fresh ID/quota/archive/revocation checks, private copied body/format/art/version1/no grants, source unchanged and receipt dedupe.
- [x] Add CopyJournal in domain and strict protocol union; is_journal and ID routing; journals.rs authoritative scoped INSERT…SELECT, using current source version and existing title/media/quota validation. Observe GREEN.
- [x] Add JournalCopy.tsx bounded dialog and tests: named Use as template action, editable Copy title, retained failed/stale title with explicit Reload template, deleted/disabled/full behavior, fixed destination ID per dialog, private disclosure and no player controls. Observe RED then GREEN. Journals.tsx selects created copy/clears search after ack.
- [x] Extend journal-handouts browser workflow with selected formatted source reuse, private copy/no player ID/source change, four-size reachable dialog, renamed/edited independent copy, restart and source concealment not recalling independent copied artwork grants. Keep all existing assertions and timeouts.
- [x] Extend current backup test with ordinary copied row/reference/no-grants roundtrip; schema remains20, original migrations1–20 unchanged.

### Task 3: Verify and record

- [x] Bump application0.0.24 only; frozen pnpm metadata refresh with workspace-local cache/store. Run focused checks then full pnpm verify:release. Inspect desktop/760/390/900 captures. One independent review; fix blocking findings with regression, document minor findings.
- [x] Record exact results/limits in BUILD_OVERVIEW, PROGRESS, RELEASE_VALIDATION, API, feature matrix, decisions, known issues and handoff. All179 IDs remain; EXT-01 partial. Commit locally; no automatic push or installation replacement. Next actor/content-library work and remaining P0/manual gates.

## Completion ·2026-10-29

Implementation `67f464fcfe1b191aadbc196fc3c544355d3bd9ba` passes complete optimized release verification: workflow7/TypeScript130/Rust112/browser17 in6.1m; final journal workflow37.2s. Format boundary/protocol/host/UI regressions observed RED→GREEN. Initial green gate was not promoted after screenshot inspection found clipped page actions: browser geometry failed at68% Share page visibility, then passed after scoped flex-wrap, and the complete gate was rerun. Four-size dialog and page-action captures inspected. One independent read-only whole-change review found no blocking issue; Minor K022 committed-copy timeout recovery remains documented for the next hardening slice. No second review, assertion removals, retries or timeout increases. Schema20/wire1/all20 migrations/dependencies unchanged. Local implementation/evidence commits only. Dedicated libraries/actors/items/scenes/cross-campaign reuse and manual LAN/platform/30-minute/distribution gates remain open.
