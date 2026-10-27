# Journal Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, with one final fresh review.

**Goal:** Persist and safely share DM-authored plain-text journal pages in browsers.
**Architecture:** Add versioned journal commands to existing authoritative transaction/receipt pipeline; reuse filtered snapshots and read routes. A focused Journals component owns reading/editing UI.
**Tech Stack:** Existing Rust/Axum/SQLx and React/TypeScript/Zod; no new dependency.
**Spec:** docs/superpowers/specs/2026-10-25-journal-authoring-design.md

## Global Constraints

- Browser-only clients; independent Rust host; no new dependency.
  -16 pages/campaign, title1–80 trimmed Unicode scalars, body0–1000 scalars; body LF/TAB only controls.
- Create private; update/delete require expectedVersion; no content in persisted event payloads.
- Existing migrations unchanged; new0008 only; preserve179 feature IDs.

## Review Focus

- Repeated structural/private changes must use fresh current projections, including concealment.
- A stale editor must preserve its draft and reject save even after stream revision advances.
- Deletion and disappearance must prevent unintended editing of a different selected page.
- Combined Unicode journal/actor/token/fog/roll maxima must fit512KiB.
- Plain-text markup and newlines must not create executable browser content.

### Task1: Authoritative versioned journal commands

Files: domain commands/Journal, server journals.rs/commands.rs/scenes.rs/lib.rs, storage0008, cases/journals.rs, live/tests.rs, storage tests.
Interfaces: journal.create {journalId,title,body}; journal.update {journalId,expectedVersion,title,body,visibility}; journal.delete {journalId,expectedVersion}; DTO adds version positive integer.
- [x] Write real API/WS privacy, version/receipt, limits and reopen tests; observe unsupported-command RED.
- [x] Add additive migration/domain command dispatch, private create, guarded update/delete, projection version and snapshot-only marker.
- [x] Run Rust workspace tests, formatting and clippy; commit server slice.

### Task2: Browser authoring and verified delivery

Files: protocol index+journal tests, Journals.tsx+test, Table.tsx, i18n/en.ts, styles.css, e2e foundation.spec.ts, package versions and release/progress documents.
Interfaces: Journals receives Journal[], dm, disabled, send; existing stream cache remains authoritative.
- [x] Write failing protocol and UI draft/conflict tests.
- [x] Add versioned schemas, persistent dock panel, explicit private/shared editor, reload and delete confirmation.
- [x] Run TypeScript suite/types/lint/build and real-host browser tests, including DM/two players.
- [x] Run one fresh focused whole-change review; fix material findings with regressions; update0.0.7 overview/evidence/next tasks; save the source archive.
