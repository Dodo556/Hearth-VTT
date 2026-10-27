# Plain-text journal authoring · 0.0.7

Implement one bounded T014 increment under the user's autonomous operating contract and current usage-budget constraint. Both roles remain browser clients of the independent Rust host. Keep existing Rust/Axum/SQLite and React/Zod stack; add no dependency.

DMs create private pages, edit title/body/visibility atomically, share to the entire campaign, conceal and delete with confirmation. Players read only currently shared pages. Plain text is rendered as text, preserving newlines; no HTML, markdown, links, uploads, per-player grants or rich-text editor. Chat/whispers/selected rolls remain the next increment.

Approaches: REST-only editing would duplicate the receipt/concurrency pipeline; rich multi-page documents would exceed this increment. Choose the existing WS command transaction with snapshot projection. Private content never appears in stored event payloads or player responses. Previously delivered knowledge cannot be erased.

Append migration0008 with journal version default1. Commands journal.create {journalId,title,body} (always private); journal.update {journalId,expectedVersion,title,body,visibility}; journal.delete {journalId,expectedVersion}. All require current DM, active membership and unarchived campaign. Existing campaign revision and receipts apply. Updates/deletes require exact journal version; stale forms preserve local drafts and offer explicit reload. Foreign/unknown IDs return equal hidden errors. Limits:16 pages/campaign, trimmed title1–80 Unicode scalars, body0–1000 scalars, LF/TAB allowed in body, other controls rejected. Existing pages retain bytes and start at version1.

The editor remains mounted during dock navigation. Save labels disclose sharing; publishing requires explicit Shared selection and save. Delete modal names the page. Offline/busy/archive disables mutations. Disappeared targets cannot be saved; server errors stay visible. Full reload/navigation may discard unsaved drafts, consistent with existing sheet editing.

Verify real-server private/shared REST and raw WS projections, receipt dedupe, stale version at current campaign revision, player/foreign/archive/revocation rejection, validation/caps and storage reopen. Browser scenario uses DM plus two players through create/edit/share/conceal/delete, literal markup and concurrent stale editing. Expand maximum snapshot fixture with16 largest journals. No claims of portable/platform/LAN verification.
