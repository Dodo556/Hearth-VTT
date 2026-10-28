use hearth_storage::Store;
use sqlx::sqlite::SqliteConnectOptions;

#[tokio::test]
async fn schema_twelve_upgrade_preserves_points_rowids_and_nonces_and_accepts_text() {
    static ALL: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
    let root = tempfile::tempdir().unwrap();
    let pool = sqlx::SqlitePool::connect_with(
        SqliteConnectOptions::new()
            .filename(root.path().join("hearth.db"))
            .create_if_missing(true)
            .foreign_keys(true),
    )
    .await
    .unwrap();
    sqlx::migrate::Migrator::with_migrations(
        ALL.iter().filter(|m| m.version <= 12).cloned().collect(),
    )
    .run(&pool)
    .await
    .unwrap();
    for query in [
        "INSERT INTO users VALUES('owner','owner','DM','fixture',1,1)",
        "INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('camp','Keep','owner',1,1)",
        "INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at) VALUES('scene','camp','Map',600,600,60,'art',1)",
        "INSERT INTO drawings(rowid,id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points) VALUES(7,'stroke','scene','freehand','shared','#e8bc6a',10,20,30,40,'[{\"x\":10.12,\"y\":20.0},{\"x\":30.0,\"y\":40.0}]')",
        "INSERT INTO drawing_creation_nonces VALUES('camp','owner','preserved')",
    ] {
        sqlx::query(query).execute(&pool).await.unwrap();
    }
    pool.close().await;
    let store = Store::open(root.path()).await.unwrap();
    let (rowid, points, text): (i64, String, Option<String>) =
        sqlx::query_as("SELECT rowid,points,text FROM drawings WHERE id='stroke'")
            .fetch_one(&store.pool)
            .await
            .unwrap();
    assert_eq!(rowid, 7);
    assert_eq!(points, "[{\"x\":10.12,\"y\":20.0},{\"x\":30.0,\"y\":40.0}]");
    assert_eq!(text, None);
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT nonce FROM drawing_creation_nonces")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        "preserved"
    );
    sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,text) VALUES('label','scene','text','dm','#72b7e2',20,20,220,120,'Literal 🐉')").execute(&store.pool).await.unwrap();
    sqlx::query("DELETE FROM drawings WHERE rowid=(SELECT MAX(rowid) FROM drawings)")
        .execute(&store.pool)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT id FROM drawings")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        "stroke"
    );
}

#[tokio::test]
async fn schema_eleven_upgrade_preserves_drawing_order_nonces_and_adds_point_storage() {
    static ALL: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
    let root = tempfile::tempdir().unwrap();
    let pool = sqlx::SqlitePool::connect_with(
        SqliteConnectOptions::new()
            .filename(root.path().join("hearth.db"))
            .create_if_missing(true)
            .foreign_keys(true),
    )
    .await
    .unwrap();
    sqlx::migrate::Migrator::with_migrations(
        ALL.iter().filter(|m| m.version <= 11).cloned().collect(),
    )
    .run(&pool)
    .await
    .unwrap();
    for query in [
        "INSERT INTO users VALUES('owner','owner','DM','fixture',1,1)",
        "INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('camp','Keep','owner',1,1)",
        "INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at) VALUES('scene','camp','Map',600,600,60,'art',1)",
        "INSERT INTO drawings(rowid,id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y) VALUES(2,'z-first','scene','line','shared','#e8bc6a',10,20,30,40),(5,'a-last','scene','rectangle','dm','#e65b5b',50,60,70,80)",
        "INSERT INTO drawing_creation_nonces VALUES('camp','owner','saved-nonce')",
    ] {
        sqlx::query(query).execute(&pool).await.unwrap();
    }
    pool.close().await;
    let store = Store::open(root.path()).await.unwrap();
    let rows: Vec<(String, String, String)> =
        sqlx::query_as("SELECT id,shape,points FROM drawings ORDER BY rowid")
            .fetch_all(&store.pool)
            .await
            .unwrap();
    assert_eq!(
        rows,
        vec![
            ("z-first".into(), "line".into(), "[]".into()),
            ("a-last".into(), "rectangle".into(), "[]".into())
        ]
    );
    let nonce: String = sqlx::query_scalar("SELECT nonce FROM drawing_creation_nonces")
        .fetch_one(&store.pool)
        .await
        .unwrap();
    assert_eq!(nonce, "saved-nonce");
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM _sqlx_migrations")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        15
    );
    sqlx::query("DELETE FROM drawings WHERE rowid=(SELECT MAX(rowid) FROM drawings)")
        .execute(&store.pool)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT id FROM drawings")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        "z-first"
    );
    assert!(sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points) VALUES('bad','scene','freehand','dm','#e65b5b',1,1,1,1,'[]')").execute(&store.pool).await.is_err());
    store.pool.close().await;
}
