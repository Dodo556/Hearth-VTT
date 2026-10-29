use hearth_storage::Store;
use sqlx::sqlite::SqliteConnectOptions;

#[tokio::test]
async fn upgrade_nine_preserves_actor_chat_and_scene_bytes_and_combat_survives_reopen() {
    let root = tempfile::tempdir().unwrap();
    let previous = tempfile::tempdir().unwrap();
    let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    for entry in std::fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let name = entry.file_name();
        let name = name.to_str().unwrap();
        if name.ends_with(".sql") && name.split('_').next().unwrap().parse::<u64>().unwrap() <= 9 {
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
    sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at) VALUES('scene','camp','Keep',600,600,60,'map',1)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO actors(id,campaign_id,name,kind,asset_id,hp,max_hp,attributes,version,created_at) VALUES('actor','camp','Saved hero','character','art',8,20,'{\"Wisdom\":\"14\"}',7,1)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO tokens(id,scene_id,name,x,y,size,color,asset_id,visibility,actor_id) VALUES('token','scene','Hero',30,30,52,'#ffddaa','art','shared','actor')").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO chat_messages(id,campaign_id,sender_user_id,client_message_id,sender_name,body,visibility,created_at,revision) VALUES('message','camp','owner','nonce','DM','Saved private text','whisper',1,1)").execute(&pool).await.unwrap();
    pool.close().await;
    let store = Store::open(root.path()).await.unwrap();
    let actor: (i64, i64, String) =
        sqlx::query_as("SELECT hp,version,attributes FROM actors WHERE id='actor'")
            .fetch_one(&store.pool)
            .await
            .unwrap();
    assert_eq!(actor, (8, 7, "{\"Wisdom\":\"14\"}".into()));
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT body FROM chat_messages WHERE id='message'")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        "Saved private text"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM _sqlx_migrations")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        19
    );
    sqlx::query("INSERT INTO combat_encounters(id,campaign_id,scene_id,name,status,round,active_combatant_id) VALUES('encounter','camp','scene','Saved fight','active',3,'combatant')").execute(&store.pool).await.unwrap();
    sqlx::query("INSERT INTO combatants(id,encounter_id,token_id,initiative,sort_order) VALUES('combatant','encounter','token',14,0)").execute(&store.pool).await.unwrap();
    store.pool.close().await;
    drop(store);
    let store = Store::open(root.path()).await.unwrap();
    assert_eq!(
        sqlx::query_as::<_, (String, i64, String)>(
            "SELECT status,round,active_combatant_id FROM combat_encounters"
        )
        .fetch_one(&store.pool)
        .await
        .unwrap(),
        ("active".into(), 3, "combatant".into())
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT initiative FROM combatants")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        14
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM pragma_foreign_key_check")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        0
    );
    let backups: Vec<_> = std::fs::read_dir(root.path().join("backups"))
        .unwrap()
        .filter_map(Result::ok)
        .filter(|e| e.path().extension().is_some_and(|x| x == "sqlite"))
        .collect();
    assert_eq!(backups.len(), 1);
    let backup = sqlx::SqlitePool::connect_with(
        SqliteConnectOptions::new()
            .filename(backups[0].path())
            .read_only(true),
    )
    .await
    .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM _sqlx_migrations")
            .fetch_one(&backup)
            .await
            .unwrap(),
        9
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>("PRAGMA integrity_check")
            .fetch_one(&backup)
            .await
            .unwrap(),
        "ok"
    );
    backup.close().await;
    store.pool.close().await;
}
