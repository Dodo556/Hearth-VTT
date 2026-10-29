use hearth_storage::Store;
use sqlx::sqlite::SqliteConnectOptions;
#[tokio::test]
async fn upgrade_eight_preserves_existing_roll_bytes_nonces_and_journal_versions() {
    let root = tempfile::tempdir().unwrap();
    let previous = tempfile::tempdir().unwrap();
    let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    for entry in std::fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let name = entry.file_name();
        let name = name.to_str().unwrap();
        if name.ends_with(".sql") && name.split('_').next().unwrap().parse::<u64>().unwrap() <= 8 {
            std::fs::copy(entry.path(), previous.path().join(name)).unwrap();
        }
    }
    let pool = sqlx::SqlitePool::connect_with(
        SqliteConnectOptions::new()
            .filename(root.path().join("hearth.db"))
            .create_if_missing(true)
            .foreign_keys(true),
    )
    .await
    .unwrap();
    sqlx::migrate::Migrator::new(previous.path())
        .await
        .unwrap()
        .run(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO users(id,username,display_name,password_hash,is_owner,created_at) VALUES('owner','owner','DM','fixture',1,1)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('camp','Saved','owner',1,1)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO memberships(campaign_id,user_id,role,created_at) VALUES('camp','owner','dm',1)").execute(&pool).await.unwrap();
    let result = "{\"private\":\"unchanged result bytes\"}";
    sqlx::query("INSERT INTO dice_rolls(id,campaign_id,roller_user_id,visibility,revision,created_at,ast_json,result_json,client_roll_id) VALUES('old-result','camp','owner','self',1,1,'{}',?,'old-result')")
        .bind(result)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO dice_roll_rate(roll_id,campaign_id,user_id,accepted_at,client_roll_id) VALUES('old-result','camp','owner',1,'old-result')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES('page','camp','Original','exact original text','dm',1)").execute(&pool).await.unwrap();
    pool.close().await;
    let store = Store::open(root.path()).await.unwrap();
    let page: (String, String, i64) =
        sqlx::query_as("SELECT title,body,version FROM journals WHERE id='page'")
            .fetch_one(&store.pool)
            .await
            .unwrap();
    assert_eq!(page, ("Original".into(), "exact original text".into(), 1));
    let row: (String, String) =
        sqlx::query_as("SELECT client_roll_id,result_json FROM dice_rolls WHERE id='old-result'")
            .fetch_one(&store.pool)
            .await
            .unwrap();
    assert_eq!(row, ("old-result".into(), result.into()));
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT client_roll_id FROM dice_roll_rate")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        "old-result"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM _sqlx_migrations")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        19
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM pragma_foreign_key_check")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        std::fs::read_dir(root.path().join("backups"))
            .unwrap()
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().is_some_and(|x| x == "sqlite"))
            .count(),
        1
    );
    store.pool.close().await;
}
