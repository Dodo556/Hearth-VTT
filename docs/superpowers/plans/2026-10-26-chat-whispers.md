# Chat and Whispers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline with one fresh final review.

**Goal:** Persistent campaign chat/private whispers and selected-recipient host dice, plus a genuine app screenshot.
**Architecture:** Reuse command receipts/revisions/current SQL projections; immutable recipient tables and bounded histories. React Chat and recipient picker share a current-member roster; snapshots own private caches.
**Tech Stack:** Existing Rust/Axum/SQLx, React/TypeScript/Zod/Pixi; no new dependency.
**Spec:** docs/superpowers/specs/2026-10-26-chat-whispers-design.md

## Global Constraints

- Browser-only clients, independent headless host, private source, no cloud runtime/new dependency.
- Message1–1000 Unicode scalars, latest1000 saved/20 visible;10 accepted/10000milliseconds;1–8 distinct other recipients for whispers/selected rolls.
- Existing scopes require empty recipients; no DM override for whispers/selected rolls.
- Host IDs/sender/time/results; current membership and receipt transaction remain authoritative.
- Migration0009 only; preserve old result bytes and179 feature IDs. Input16KiB, write buffer768KiB.

## Review Focus

- Hidden nonce/record IDs must not reveal another user's or campaign's private existence.
- Recipients disappearing during editing must block sending rather than widen scope.
- History filtering must happen before limits, including DM exclusion and reconnect/revocation.
- Concurrent snapshot updates must not erase a pending/new draft or change target identities.
- Combined maximum Unicode content must fit the outbound buffer; literal markup stays text.

### Task1: Server messages and selected roll authority

Files: domain commands/DTOs; server chat.rs, recipients.rs, security.rs, dice.rs, live.rs, commands.rs/lib.rs; storage0009 and upgrade tests; cases/chat.rs and maximum fixture.
Interfaces: chat.send; dice.roll recipientIds with selected scope; GET campaigns/:id/chat[/messageId], participants. Snapshot messages.
- [x] Write failing real API/WS privacy/receipt/validation tests; observe unsupported chat/selected RED.
- [x] Implement migration, validated recipient helper, bounded chat/rate/REST projection and selected-roll persistence.
- [x] Cover foreign IDs/nonces, history pruning/rates, archive/revocation/reopen,8→9 upgrade and combined snapshot; run Rust suite/clippy/format and commit.

### Task2: Browser chat, whispers and selected dice

Files: protocol schemas/tests, Chat.tsx, Recipients.tsx, RollCard.tsx, Dice/Table/useCampaignStream/api/i18n/styles and component tests.
Interfaces: Participant{id,displayName,role}; Chat receives messages/rolls/user/participants/send; selected dice receives same recipient roster.
- [x] Write failing protocol/cache/composer tests, then add schemas and message projection replacement/clear.
- [x] Implement stable recipient selections, literal history/roll cards, private labels/pending/error states and mounted dock panels.
- [x] Run TypeScript suite/types/lint/build and real-server DM+two-player chat/selected dice scenario; full browser regression, one fresh review and material fix pass.

### Task3: Verified delivery and screenshot

Files: docs/progress/feature matrix/overview/decisions/guides, versions; screenshot harness and source archive.
- [x] Capture/inspect a real running0.0.8 map/Chat screenshot using fictional demo accounts, without personal data.
- [x] Record actual checks/remaining scope and next combat/recovery task; preserve private branch and save source+requested screenshot.
