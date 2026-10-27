# Full-host backup and isolated recovery · 0.0.10

Continue T015 after0.0.9. Preserve the browser-only product, authoritative Rust host, existing VTT shell and179 feature IDs. The master§0.1 explicitly authorizes reversible engineering decisions and continuous implementation; the user requests another working stage and an actual screenshot. These are implementation decisions, not new user approvals.

## Approach and scope

Select a complete host snapshot with all persisted accounts/campaigns/ACLs/receipts/content and referenced uploaded blobs. A campaign-only import would require account/ID remapping and would not recover the host. A raw directory download can capture inconsistent WAL state and incidental logs/backups. Use SQLite VACUUM INTO plus immutable hash-addressed blobs from that snapshot; live edits after the cutoff stay in the live host, not this backup.

Restore into a newly generated private directory only. Never overwrite, merge or switch the running store. The owner can inspect the result, stop the host and select that recovered data directory at restart. No new native UI, external service or installation requirement. Ready-to-run hosting packages, live restart orchestration, scheduled/encrypted/selective backups, older-schema imports and complete P0/LAN acceptance remain later gates.

## Format and validation

Use an openly documented uncompressed `.hearthbackup` format:8-byte `HEARTHB1`,4-byte little-endian manifest length, UTF-8 strict JSON manifest, then concatenated file bytes in manifest order. Manifest={formatVersion:1,schemaVersion:10,appVersion,createdAt,counts,files:[{path,byteSize,sha256}]}. DB first `hearth.db`; remaining files are sorted unique `assets/<64 lowercase hex>.png`. No arbitrary paths, archive directories, links, compression, trailing bytes or extra payloads. SHA256 protects corruption, not authenticity/encryption. No new archive dependency.

Bounds:512MiB complete archive,128MiB database,16MiB each asset,4096 unique blobs plus DB,1MiB manifest,512million decoded pixels across assets. Validate lengths before allocation/copy, streaming64KiB buffers and create-new files. Only current schema10 is accepted: compare canonical SQLite schema and embedded migration records/checksums; integrity/FK checks, exactly one coherent host owner, and exact referenced-blob set/size/hash/PNG dimensions. Reject alternate schema/triggers, missing/extra blobs, corruption, malformed metadata, future/old versions, path traversal and links. Source originals remain bundled in the host. Exclude logs/backups/restores/temp/orphan blobs and external environment configuration.

TempDir owns every failed/interrupted operation. Restore candidates have a `.restore-in-progress` marker; Store refuses to start one. Finalize in place in its unique `restores/hearth-restored-<random>` directory; this avoids a directory-replacement race. Clear all device sessions and revoke unused invitations transactionally, retaining accounts/passwords/memberships/ownership/game data. Flush files/directories before removing the marker and keeping the directory. Failed validation leaves live data and existing recovery copies unchanged. An interrupted candidate is unusable until separately cleaned/recreated; no crash-durability certification is claimed.

## Storage interfaces

`backup::create(&Store, data_root:&Path, app_version:&str, now:i64) -> Result<PreparedBackup>`: temp directory, archive path, exact byteSize/SHA256 and SnapshotSummary.
`backup::verify(archive:&Path, restore_parent:&Path) -> Result<VerifiedBackup>`: private staged directory, exact byteSize/SHA256 and validated SnapshotSummary.
`backup::restore(VerifiedBackup, now:i64) -> Result<PathBuf>`: clear sessions/invites, sync, remove marker, keep unique directory. No caller-chosen target path.
Summary={formatVersion,schemaVersion,appVersion,createdAt,counts:{users,campaigns,scenes,tokens,actors,journals,messages,rolls,encounters,assets}}; assets counts unique uploaded blobs. Serializable camelCase, no secret text/passwords/identities in summaries.

## Owner browser API

All routes require current authenticated host owner, including when a campaign DM is not the owner. Existing Host/Origin/custom-header/no-store guards remain. Authenticate before reading uploads and again before publication/finalization. One recovery operation at a time; detached bounded work retains its permit if the HTTP caller leaves. Existing media in-flight response authorization semantics apply to begun downloads.
- GET `/api/host/recovery` → `{schemaVersion:1,dataDirectory:string,prepared:BackupInfo|null,verified:VerificationInfo|null,lastRestore:RestoreInfo|null}`.
- POST `/api/host/backups` `{}` → `{schemaVersion:1,backup:BackupInfo}`.
- GET `/api/host/backups/:id` → attachment from the current prepared backup; no path from the client. Keep its TempDir alive through streaming.
- POST `/api/host/restores/verify` raw `application/octet-stream` file → `{schemaVersion:1,verification:VerificationInfo}`.512MiB byte limit and60-second upload deadline, independent of Content-Length. Invalid upload returns generic INVALID_BACKUP without parser/SQL/path details.
- POST `/api/host/restores` `{verificationId:UUID}` → `{schemaVersion:1,restore:RestoreInfo}`; consume the matching current verification once. Missing/expired/replaced IDs reject without restoring.

BackupInfo={id:UUID,byteSize,sha256,summary}; VerificationInfo adds expiresAt (15min) to the same fields; RestoreInfo={directoryName,createdAt,summary}. State keeps one prepared file, one verification and last receipt. Prepared files last until replacement/restart; downloads retain old objects while in flight. Expired verification is discarded on next recovery access; shutdown cleans remaining temporary work. Recovery copies persist; owner manages their disk space. No full archive is buffered in HTTP/JS memory.

## UI and acceptance

Reusable lazy BackupRecovery dialog from owner-only campaign-library navigation and table header. Compact neutral styling, two clear steps: prepare/download, choose/verify/create recovery copy. Show real checksums/counts/verification and restart instructions with relative recovered directory name. Explain whole-host private content and sign-in/invitation reset. Never claim an OS download is saved before the browser confirms it. Poll state only while open; keep typed File body uploads; disable conflicting work and modal dismissal while pending. Changing selected file cannot reuse another file's verification.

Prove real backup/upload/verify/recovery, current owner ACL (including non-owner DM), malformed streams/files, stale verification, current schema/reference validation, sessions invalidation, persisted game bytes/assets/ACLs and restored DM/Alice/Bob reads. Existing ten browser scenarios remain. Screenshot shows actual new recovery UI with fictional data; do not compete with the browser suite while capturing. Full P0 gap/30-minute encounter/LAN/portable gates stay pending.

The owner-only status exposes the configured absolute data directory so a recovery copy can be located and started. This operational path never enters player projections. Full-host backups intentionally include private whispers/rolls of all participants; normal Chat/dice routes still filter them, and ordinary campaign DMs cannot back up the host. Physical host-owner trust therefore also applies to this explicit export surface.
