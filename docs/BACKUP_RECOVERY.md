# Backup and recovery ·0.0.10

The host owner can open **Backup & recovery** from the campaign library or table header. Other campaign DMs and players cannot access host backups. The current format recovers the entire host into a separate directory; the live data directory is never replaced automatically.
1. Choose **Prepare host backup**. The host snapshots the committed SQLite state and includes every registered uploaded artwork file. Edits committed after that snapshot stay in the current host.
2. Choose **Download backup** and keep the `.hearthbackup` file somewhere safe. A prepared download exists only until replaced or the host restarts; preparing a file does not save it to your own backup location. Optional SHA-256 details identify the prepared bytes.
3. Select a backup and choose **Verify backup**. The host checks framing, limits, hashes, current database schema/migrations, integrity, foreign keys, owner identity coherence and referenced PNG artwork. Review the actual content counts. Verification lasts15minutes and is usable once. Select and verify the intended file in the current dialog; closing/reopening requires selecting/verifying it again. Another window replacing the receipt disables recovery rather than changing its target.
4. Choose **Create recovery copy**. A new `restores/hearth-restored-<random>` directory is retained under the displayed host data folder. Existing live data and other recovery copies remain unchanged. Invalid/corrupt inputs are discarded.
5. Stop the host. Set `HEARTH_DATA_DIR` to the full recovered folder shown in the dialog, then restart using the same launcher/server. In PowerShell: `$env:HEARTH_DATA_DIR = 'C:\full\path\hearth-restored-ABC123'`, then `pnpm.cmd try` for current source. On Linux/macOS: `HEARTH_DATA_DIR='/full/path/hearth-restored-ABC123' pnpm try`. Use your actual displayed path. The finished package will use its headless launcher; it is not delivered yet.
6. Sign in with accounts/passwords stored in the backup. Memberships, character ownership, private content, fog, encounters, receipts, chat and dice history are retained. All prior sessions and unused invitation links are disabled **in the recovered copy**; issue new invitations as needed. The live host's sessions/links are unaffected.

A successful isolated recovery is not an automatic switch or a password reset. Keep the original directory until you have checked the recovered host. Temporary candidates have `.restore-in-progress`; startup refuses these if interrupted. Recreate from a valid backup rather than manually removing that marker. Completed recovery copies persist and consume disk space; remove unused copies only after stopping any host that uses them.

Backups are unencrypted whole-host private data, including account password hashes, all participants' private whispers/rolls and hidden campaign content. This is an explicit trusted machine-owner export privilege. Ordinary campaign DMs have no such access; normal Chat/dice/document routes still filter by current permissions. Checksums detect corruption, not who created a file. Store and restore backups you trust.

Current bounds:512MiB archive,128MiB DB,16MiB per PNG,4096 unique uploaded blobs,512million decoded pixels,1MiB manifest. Schema10 and schema11 archives are supported. Larger stores can use the offline copy procedure below. Scheduled/retained/encrypted/selective backups, imports from other older schemas, automatic host switching and comprehensive crash/platform acceptance remain pending.

## Open backup format1

The uncompressed byte format is8 ASCII bytes `HEARTHB1`, a4-byte little-endian unsigned manifest length, strict UTF-8 JSON, then the concatenated payloads. Manifest fields: `formatVersion:1`, `schemaVersion:10` or `schemaVersion:11`, `appVersion`, `createdAt` (Unix seconds), `counts` (users/campaigns/scenes/tokens/actors/journals/messages/rolls/encounters/assets) and `files:[{path,byteSize,sha256}]`. Database is first at `hearth.db`; subsequent entries are unique sorted `assets/<lowercase SHA256>.png`. SHA256 refers to each file's complete bytes. No directories, links, arbitrary paths, compression or trailing bytes. Asset count is unique registered blobs. Logs, prior backups/recovery copies, orphan/temp files and external environment configuration are excluded. Original runtime example art stays in the matching host package.

## Offline full-directory alternative

Scheduled backups remain pending. This offline-copy alternative preserves the entire configured directory.
1. Stop the host with Ctrl+C and wait for it to exit. No other host may use this data directory.
2. Copy the **entire configured `HEARTH_DATA_DIR`** to a separate safe directory. Include `hearth.db`, any surviving `hearth.db-wal` / `hearth.db-shm` files, assets/ and settings you manage externally. Do not copy just an active WAL database file while the host runs.
3. To verify, use a **copy** of that backup as the data directory of an isolated host on a different loopback port; update HEARTH_ORIGINS accordingly. Sign in and inspect campaigns and membership access before trusting the backup.
4. To restore, stop both hosts, preserve a copy of the current directory, then restore the full chosen backup into the intended user-data directory and restart. Never overwrite a running database or delete an in-use lock file.

The current automated restart test closes/reopens the store and verifies acknowledged data/session behavior. The browser archive recovery route is tested separately; arbitrary offline-copy restoration and crash injection remain future acceptance gates. No destructive password reset tool exists; do not edit password_hash manually. Preserve your owner password and backups. Before upgrading an existing database, the host now automatically writes `backups/before-v<version>-<timestamp>.sqlite` using SQLite VACUUM INTO. It checks integrity and foreign keys, writes/syncs a sibling `.sha256`, and verifies the bytes before migration proceeds. Failure aborts startup without applying the pending migration. Preserve these files; they contain private accounts/campaign data. New empty stores need no pre-upgrade backup; reopening an already upgraded store does not create another.

Migration snapshots cover the database, not uploaded map/token media. Since build0.0.3, preserving the assets/ directory alongside the database is required for a complete backup. The authoring restart regression reopens both metadata and a saved uploaded blob; it is not a full backup restore test. The test restores a v1 database via normal upgrade and reads the original backup as a separate database; the new browser workflow is covered by its own tests, while power-loss recovery still needs verification. Do not overwrite a running database to roll back. Use the offline-copy procedure above and an isolated data root before trusting recovery.


Build 0.0.12 writes schema 11 backups. Schema 10 backups from the preceding build remain verifiable and can be restored into an isolated copy; the copy is migrated on first startup. Drawing records are part of whole-host backup data.


## Failed-update recovery and rollback

Whole-host archive recovery creates an isolated copy for a compatible host; it does not install or downgrade application code. Before updating, retain the prior host executable, its matched web bundle, version/schema details, external configuration and a verified full data/artwork backup. Test a candidate migration on a disposable copy first.

For rollback, stop both hosts, keep the failed candidate's current data untouched in a separate location, and restore a COPY of the pre-update data/artwork/configuration with the exact compatible prior application and web assets. Do not run an older host on the newer migrated database. Verify the restored pair on a separate loopback port before switching back. A current-source `pnpm try` may rebuild newer code and migrate again, so it is not by itself an application rollback command. Post-backup changes are not automatically merged. Automatic rollback and arbitrary schema downgrades are not currently implemented.

A pre-migration SQLite snapshot/checksum is a database safeguard only; preserve uploaded artwork separately or use a verified whole-host backup. Follow the permanent update policy in CONTINUOUS_DEVELOPMENT.md and the candidate gates in RELEASE.md.
