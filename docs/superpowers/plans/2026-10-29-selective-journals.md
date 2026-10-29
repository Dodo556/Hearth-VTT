# Selective journal sharing implementation plan

Goal: extend private/shared text/image journals with explicit GM-selected player readers, without rebuilding working media/journal systems. User authorizes autonomous inline implementation following NEXT_TASKS.

Design: retain stored dm/shared visibility and add schema19 journal_recipients(campaign_id,journal_id,user_id), with journal/member cascading references. Nonempty grants on a dm page derive selected visibility in the GM DTO. Players get the page as shared, with no recipient/folder metadata. UpdateJournal gets a journal-specific selected visibility and bounded recipientIds; all edits/share/hide stay atomic/versioned. Selected requires1–8 distinct current campaign players. Shared/dm require no recipients. Image changes require a private save with no grants. Hide clears grants; deleting/revoking membership cascades; other scene/actor/page image grants remain independent. Original18 pages retain scope/art/text unchanged; canonical10–18 backups upgrade only in copies. No new dependency or global Visibility enum change.
1. Add failing protocol and real host tests: Alice-only vs Bob, direct page/image reads and live frames, player/foreign/revoked/duplicate/empty recipients, stale saves, switch scopes/hide/independent grants.
2. Implement migration19, bounded player-grant validation, GM-only recipient DTOs, shared recipient-filter SQL for REST/live/media. Add current backup exact grants/coherence checks and original18 recovery.
3. Extend Journal sidebar with named Share page dialog and reuse recipient checkbox controls. Existing content editor preserves selected scope/recipients; new uploads reset to private. Explicit failed/stale/unavailable selection recovery, no silent widening, native keyboard/scroll behavior.
4. Run GM/Alice/Bob rendered selective sharing/revoke/reconnect/restart acceptance, original regressions, responsive captures. Run complete pnpm verify:release once candidate checks pass; fix actual failures and rerun as needed.
5. Update API/data/recovery/decisions/progress/matrix/build/next evidence, commit locally. Retain all179 IDs/partial states/manual platform/LAN/P0 gates. One independent final review; no worktree or setup repetition.

## Completion

Implementation `295ffcf1f3292ed91c2007c20de9ce88faa78d7d`. Final complete gate exits0: workflow7/TS110/Rust107/browser17 in6.2m, no skips. Current19 grants/art/version backup and original18 recovery join retained10–17 fixtures. Four-size sharing captures inspected. One independent review found no defects. Source/evidence saved locally; manual gates remain open.
