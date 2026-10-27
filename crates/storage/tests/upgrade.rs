use hearth_storage::Store;
use sha2::{Digest, Sha256};
use sqlx::sqlite::SqliteConnectOptions;

#[tokio::test]
async fn upgrading_v1_preserves_data_and_creates_verified_snapshot_before_migration() {
    let root = tempfile::tempdir().unwrap();
    let v1 = tempfile::tempdir().unwrap();
    std::fs::write(
        v1.path().join("0001_foundation.sql"),
        include_str!("../migrations/0001_foundation.sql"),
    )
    .unwrap();
    let pool = sqlx::SqlitePool::connect_with(
        SqliteConnectOptions::new()
            .filename(root.path().join("hearth.db"))
            .create_if_missing(true),
    )
    .await
    .unwrap();
    sqlx::migrate::Migrator::new(v1.path())
        .await
        .unwrap()
        .run(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO users(id,username,display_name,password_hash,is_owner,created_at) VALUES ('owner','dm','Žofia','fixture',1,1)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES ('campaign','Keep','owner',1,1)").execute(&pool).await.unwrap();
    pool.close().await;
    let store = Store::open(root.path()).await.unwrap();
    let revision: i64 = sqlx::query_scalar("SELECT revision FROM campaigns WHERE id='campaign'")
        .fetch_one(&store.pool)
        .await
        .unwrap();
    assert_eq!(revision, 0);
    let backups: Vec<_> = std::fs::read_dir(root.path().join("backups"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|e| e == "sqlite"))
        .collect();
    assert_eq!(backups.len(), 1);
    assert_eq!(
        std::fs::read_to_string(backups[0].with_extension("sha256"))
            .unwrap()
            .trim(),
        hex::encode(Sha256::digest(std::fs::read(&backups[0]).unwrap()))
    );
    let backup = sqlx::SqlitePool::connect_with(
        SqliteConnectOptions::new()
            .filename(&backups[0])
            .read_only(true),
    )
    .await
    .unwrap();
    let version: i64 = sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations")
        .fetch_one(&backup)
        .await
        .unwrap();
    assert_eq!(version, 1);
    let name: String = sqlx::query_scalar("SELECT display_name FROM users WHERE id='owner'")
        .fetch_one(&backup)
        .await
        .unwrap();
    assert_eq!(name, "Žofia");
    let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_one(&backup)
        .await
        .unwrap();
    assert_eq!(integrity, "ok");
    backup.close().await;
    store.pool.close().await;
    drop(store);
    let reopened = Store::open(root.path()).await.unwrap();
    assert_eq!(
        std::fs::read_dir(root.path().join("backups"))
            .unwrap()
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().is_some_and(|e| e == "sqlite"))
            .count(),
        1
    );
    reopened.pool.close().await;
}
