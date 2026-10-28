//! Bounded whole-host snapshots. Recovery never writes into the running store.
mod database;
mod format;

use crate::Store;
use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};
use sqlx::{
    Connection,
    sqlite::{SqliteConnectOptions, SqliteJournalMode},
};
use std::{
    fs::{File, OpenOptions},
    path::{Path, PathBuf},
};
use tempfile::TempDir;

pub const MAX_ARCHIVE_BYTES: u64 = 512 * 1024 * 1024;
pub const MAX_DATABASE_BYTES: u64 = 128 * 1024 * 1024;
pub const MAX_ASSET_BYTES: u64 = 16 * 1024 * 1024;
pub const MAX_FILES: usize = 4097;
pub const MAX_MANIFEST_BYTES: usize = 1024 * 1024;
pub const MAX_PIXELS: u64 = 512_000_000;
const SCHEMA_VERSION: i64 = 17;
const MARKER: &str = ".restore-in-progress";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Counts {
    pub users: u64,
    pub campaigns: u64,
    pub scenes: u64,
    pub tokens: u64,
    pub actors: u64,
    pub journals: u64,
    pub messages: u64,
    pub rolls: u64,
    pub encounters: u64,
    pub assets: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnapshotSummary {
    pub format_version: u32,
    pub schema_version: i64,
    pub app_version: String,
    pub created_at: i64,
    pub counts: Counts,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Entry {
    path: String,
    byte_size: u64,
    sha256: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    format_version: u32,
    schema_version: i64,
    app_version: String,
    created_at: i64,
    counts: Counts,
    files: Vec<Entry>,
}
impl Manifest {
    fn summary(&self) -> SnapshotSummary {
        SnapshotSummary {
            format_version: self.format_version,
            schema_version: self.schema_version,
            app_version: self.app_version.clone(),
            created_at: self.created_at,
            counts: self.counts.clone(),
        }
    }
}
pub struct PreparedBackup {
    pub dir: TempDir,
    pub path: PathBuf,
    pub summary: SnapshotSummary,
    pub byte_size: u64,
    pub sha256: String,
}
pub struct VerifiedBackup {
    pub dir: TempDir,
    pub summary: SnapshotSummary,
    pub byte_size: u64,
    pub sha256: String,
}
pub fn private_parent(path: &Path) -> Result<()> {
    std::fs::create_dir_all(path)?;
    ensure!(
        std::fs::symlink_metadata(path)?.file_type().is_dir(),
        "Expected a real directory"
    );
    Ok(())
}
pub async fn create(store: &Store, root: &Path, version: &str, now: i64) -> Result<PreparedBackup> {
    let parent = root.join("backups");
    private_parent(&parent)?;
    let dir = tempfile::Builder::new()
        .prefix(".hearth-backup-")
        .tempdir_in(parent)?;
    let db = dir.path().join("hearth.db");
    sqlx::query("VACUUM INTO ?")
        .bind(db.to_str().context("Invalid local data path")?)
        .execute(&store.pool)
        .await?;
    File::open(&db)?.sync_all()?;
    let (counts, assets) = database::validate(&db, SCHEMA_VERSION).await?;
    let summary = SnapshotSummary {
        format_version: 1,
        schema_version: SCHEMA_VERSION,
        app_version: version.into(),
        created_at: now,
        counts,
    };
    let root = root.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let mut files = vec![format::describe(&db, "hearth.db".into())?];
        database::check_artwork(&root, &assets)?;
        for asset in &assets {
            let entry = format::describe(
                &root.join("assets").join(format!("{}.png", asset.sha)),
                format!("assets/{}.png", asset.sha),
            )?;
            ensure!(
                entry.byte_size == asset.bytes && entry.sha256 == asset.sha,
                "Artwork does not match its database reference"
            );
            files.push(entry);
        }
        let manifest = Manifest {
            format_version: 1,
            schema_version: SCHEMA_VERSION,
            app_version: summary.app_version.clone(),
            created_at: now,
            counts: summary.counts.clone(),
            files,
        };
        let path = dir.path().join("host.hearthbackup");
        format::write(&path, &manifest, |name| {
            if name == "hearth.db" {
                db.clone()
            } else {
                root.join(name)
            }
        })?;
        let (byte_size, sha256) = format::digest(&path)?;
        Ok(PreparedBackup {
            dir,
            path,
            summary,
            byte_size,
            sha256,
        })
    })
    .await?
}
pub async fn verify(archive: &Path, parent: &Path) -> Result<VerifiedBackup> {
    private_parent(parent)?;
    let dir = tempfile::Builder::new()
        .prefix("hearth-restored-")
        .tempdir_in(parent)?;
    OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(dir.path().join(MARKER))?
        .sync_all()?;
    sync_directory(dir.path())?;
    let archive = archive.to_path_buf();
    let (dir, manifest, byte_size, sha256) = tokio::task::spawn_blocking(move || -> Result<_> {
        let (byte_size, sha256) = format::digest(&archive)?;
        ensure!(byte_size <= MAX_ARCHIVE_BYTES, "Backup exceeds size limit");
        let manifest = format::extract(&archive, dir.path())?;
        Ok((dir, manifest, byte_size, sha256))
    })
    .await??;
    let (counts, assets) =
        database::validate(&dir.path().join("hearth.db"), manifest.schema_version).await?;
    ensure!(
        counts == manifest.counts,
        "Backup counts do not match its data"
    );
    ensure!(
        manifest.files.len() == assets.len() + 1,
        "Backup contains missing or unexpected artwork"
    );
    for (entry, asset) in manifest.files.iter().skip(1).zip(&assets) {
        ensure!(
            entry.path == format!("assets/{}.png", asset.sha)
                && entry.byte_size == asset.bytes
                && entry.sha256 == asset.sha,
            "Backup artwork references do not match"
        );
    }
    let summary = manifest.summary();
    tokio::task::spawn_blocking(move || -> Result<_> {
        database::check_artwork(dir.path(), &assets)?;
        Ok(VerifiedBackup {
            dir,
            summary,
            byte_size,
            sha256,
        })
    })
    .await?
}
pub async fn restore(verified: VerifiedBackup, now: i64) -> Result<PathBuf> {
    let db = verified.dir.path().join("hearth.db");
    let mut conn = sqlx::SqliteConnection::connect_with(
        &SqliteConnectOptions::new()
            .filename(&db)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Delete)
            .pragma("trusted_schema", "OFF"),
    )
    .await?;
    let result = async {
        sqlx::query("BEGIN IMMEDIATE").execute(&mut conn).await?;
        sqlx::query("DELETE FROM device_sessions")
            .execute(&mut conn)
            .await?;
        sqlx::query("UPDATE invites SET revoked_at=? WHERE used_at IS NULL AND revoked_at IS NULL")
            .bind(now)
            .execute(&mut conn)
            .await?;
        sqlx::query("COMMIT").execute(&mut conn).await?;
        Ok::<_, sqlx::Error>(())
    }
    .await;
    conn.close().await?;
    result?;
    tokio::task::spawn_blocking(move || {
        File::open(&db)?.sync_all()?;
        sync_directory(&verified.dir.path().join("assets"))?;
        sync_directory(verified.dir.path())?;
        std::fs::remove_file(verified.dir.path().join(MARKER))?;
        sync_directory(verified.dir.path())?;
        if let Some(parent) = verified.dir.path().parent() {
            sync_directory(parent)?;
        }
        Ok(verified.dir.keep())
    })
    .await?
}
fn sync_directory(path: &Path) -> Result<()> {
    #[cfg(unix)]
    File::open(path)?.sync_all()?;
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}
