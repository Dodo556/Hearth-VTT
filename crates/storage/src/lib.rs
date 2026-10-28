//! Local persistence; implemented after the foundation acceptance tests.
pub mod backup;
use fs2::FileExt;
use sha2::{Digest, Sha256};
use sqlx::Connection;
static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
};
use std::{
    fs::{File, OpenOptions},
    path::Path,
    sync::Arc,
    time::Duration,
};

#[derive(Clone)]
pub struct Store {
    pub pool: SqlitePool,
    _lock: Arc<File>,
}

impl Store {
    pub async fn open(root: &Path) -> anyhow::Result<Self> {
        anyhow::ensure!(
            !root.join(".restore-in-progress").exists(),
            "This recovery copy is incomplete and cannot be started"
        );
        std::fs::create_dir_all(root)?;
        for folder in ["assets", "backups", "logs"] {
            std::fs::create_dir_all(root.join(folder))?;
        }
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(root.join("host.lock"))?;
        lock.try_lock_exclusive().map_err(|_| {
            anyhow::anyhow!("This data directory is already in use by another Hearth host")
        })?;
        let options = SqliteConnectOptions::new()
            .filename(root.join("hearth.db"))
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Full)
            .busy_timeout(Duration::from_secs(5));
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;
        // Snapshot a consistent SQLite database (including WAL) before any upgrade.
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='_sqlx_migrations')",
        )
        .fetch_one(&pool)
        .await?;
        if exists {
            let version: i64 = sqlx::query_scalar(
                "SELECT COALESCE(MAX(version),0) FROM _sqlx_migrations WHERE success=1",
            )
            .fetch_one(&pool)
            .await?;
            if MIGRATOR.iter().any(|m| m.version > version) {
                let stamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)?
                    .as_nanos();
                let backup = root
                    .join("backups")
                    .join(format!("before-v{version}-{stamp}.sqlite"));
                sqlx::query("VACUUM INTO ?")
                    .bind(backup.to_string_lossy().as_ref())
                    .execute(&pool)
                    .await?;
                let mut check = sqlx::SqliteConnection::connect_with(
                    &SqliteConnectOptions::new()
                        .filename(&backup)
                        .read_only(true),
                )
                .await?;
                let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
                    .fetch_one(&mut check)
                    .await?;
                anyhow::ensure!(
                    integrity == "ok",
                    "Pre-migration backup failed integrity verification"
                );
                let violations = sqlx::query("PRAGMA foreign_key_check")
                    .fetch_all(&mut check)
                    .await?;
                anyhow::ensure!(
                    violations.is_empty(),
                    "Pre-migration backup contains broken references"
                );
                check.close().await?;
                let bytes = std::fs::read(&backup)?;
                let checksum = hex::encode(Sha256::digest(&bytes));
                let checksum_path = backup.with_extension("sha256");
                std::fs::write(&checksum_path, format!("{checksum}\n"))?;
                File::open(&backup)?.sync_all()?;
                File::open(&checksum_path)?.sync_all()?;
                anyhow::ensure!(
                    hex::encode(Sha256::digest(std::fs::read(&backup)?)) == checksum,
                    "Backup checksum mismatch"
                );
            }
        }
        MIGRATOR.run(&pool).await?;
        Ok(Self {
            pool,
            _lock: Arc::new(lock),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn migrations_create_identity_tables_and_enable_foreign_keys() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(&store.pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
        let version: i64 = sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations")
            .fetch_one(&store.pool)
            .await
            .unwrap();
        assert_eq!(version, 17, "The journal-folder migration must be embedded");
        let fk: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
            .fetch_one(&store.pool)
            .await
            .unwrap();
        assert_eq!(fk, 1);
    }
}
