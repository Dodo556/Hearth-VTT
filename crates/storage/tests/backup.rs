use hearth_storage::{Store, backup};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{Connection, sqlite::SqliteConnectOptions};
use std::path::Path;

const ART: &[u8] = include_bytes!("../../../content/examples/amber-keep/warden.png");

async fn fixture(root: &Path) -> Store {
    let store = Store::open(root).await.unwrap();
    for query in [
        "INSERT INTO users VALUES('owner','owner','Game Master','password-hash',1,1)",
        "INSERT INTO host_profile(singleton,owner_id) VALUES(1,'owner')",
        "INSERT INTO device_sessions VALUES('old-session','owner',9999999999,1)",
        "INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('campaign','Recovery campaign','owner',1,1)",
        "INSERT INTO memberships VALUES('campaign','owner','dm',1)",
        "INSERT INTO invites VALUES('invite','campaign','old-invite','owner',9999999999,NULL,NULL,1)",
        "INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES('secret','campaign','Private note','SECRET BACKUP TEXT','dm',1)",
    ] {
        sqlx::query(query).execute(&store.pool).await.unwrap();
    }
    let sha = hex::encode(Sha256::digest(ART));
    std::fs::write(root.join("assets").join(format!("{sha}.png")), ART).unwrap();
    sqlx::query("INSERT INTO assets VALUES('art','campaign',?,160,160,?,1)")
        .bind(&sha)
        .bind(ART.len() as i64)
        .execute(&store.pool)
        .await
        .unwrap();
    store
}

fn parts(bytes: &[u8]) -> (Value, Vec<u8>) {
    assert_eq!(&bytes[..8], b"HEARTHB1");
    let length = u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as usize;
    (
        serde_json::from_slice(&bytes[12..12 + length]).unwrap(),
        bytes[12 + length..].to_vec(),
    )
}
fn encoded(manifest: &Value, payload: &[u8]) -> Vec<u8> {
    let header = serde_json::to_vec(manifest).unwrap();
    let mut bytes = b"HEARTHB1".to_vec();
    bytes.extend((header.len() as u32).to_le_bytes());
    bytes.extend(header);
    bytes.extend(payload);
    bytes
}

#[tokio::test]
async fn whole_host_backup_restores_committed_data_and_blobs_without_overwriting_live_data() {
    let source = tempfile::tempdir().unwrap();
    let store = fixture(source.path()).await;
    std::fs::write(source.path().join("assets/orphan.png"), "unreferenced").unwrap();
    std::fs::write(source.path().join("logs/private.log"), "do not export").unwrap();
    let prepared = backup::create(&store, source.path(), "0.0.10", 100)
        .await
        .unwrap();
    let archive = std::fs::read(&prepared.path).unwrap();
    let (manifest, _) = parts(&archive);
    assert_eq!(manifest["formatVersion"], 1);
    assert_eq!(manifest["schemaVersion"], 18);
    assert_eq!(manifest["files"].as_array().unwrap().len(), 2);
    assert_eq!(manifest["files"][0]["path"], "hearth.db");
    assert!(!manifest.to_string().contains("orphan"));
    assert_eq!(prepared.summary.counts.campaigns, 1);
    assert_eq!(prepared.summary.counts.assets, 1);
    assert_eq!(prepared.sha256, hex::encode(Sha256::digest(&archive)));
    sqlx::query("UPDATE journals SET body='NEW LIVE CONTENT' WHERE id='secret'")
        .execute(&store.pool)
        .await
        .unwrap();
    let restores = source.path().join("restores");
    let verified = backup::verify(&prepared.path, &restores).await.unwrap();
    assert!(
        Store::open(verified.dir.path()).await.is_err(),
        "Staged copies cannot be started"
    );
    let recovered = backup::restore(verified, 200).await.unwrap();
    assert!(recovered.starts_with(&restores));
    let copy = Store::open(&recovered).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT body FROM journals WHERE id='secret'")
            .fetch_one(&copy.pool)
            .await
            .unwrap(),
        "SECRET BACKUP TEXT"
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT body FROM journals WHERE id='secret'")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        "NEW LIVE CONTENT"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM device_sessions")
            .fetch_one(&copy.pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT revoked_at FROM invites WHERE id='invite'")
            .fetch_one(&copy.pool)
            .await
            .unwrap(),
        200
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM device_sessions")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        1
    );
    let sha = hex::encode(Sha256::digest(ART));
    assert_eq!(
        std::fs::read(recovered.join("assets").join(format!("{sha}.png"))).unwrap(),
        ART
    );
    assert!(!recovered.join("assets/orphan.png").exists());
    assert!(!recovered.join("logs/private.log").exists());
    copy.pool.close().await;
}

#[tokio::test]
async fn corrupt_truncated_and_path_forged_archives_leave_no_recovery_copy() {
    let source = tempfile::tempdir().unwrap();
    let store = fixture(source.path()).await;
    let prepared = backup::create(&store, source.path(), "0.0.10", 100)
        .await
        .unwrap();
    let original = std::fs::read(&prepared.path).unwrap();
    let (manifest, payload) = parts(&original);
    let mut variants = vec![
        b"bad magic".to_vec(),
        original[..original.len() - 1].to_vec(),
        [original.clone(), vec![1]].concat(),
    ];
    let mut corrupt = original.clone();
    *corrupt.last_mut().unwrap() ^= 1;
    variants.push(corrupt);
    for path in [
        "../escaped",
        "/tmp/escaped",
        "assets/../../escaped",
        "assets\\escaped",
        "hearth.db",
    ] {
        let mut changed = manifest.clone();
        changed["files"][1]["path"] = json!(path);
        variants.push(encoded(&changed, &payload));
    }
    for size in [0u64, 536870913, u64::MAX] {
        let mut changed = manifest.clone();
        changed["files"][0]["byteSize"] = json!(size);
        variants.push(encoded(&changed, &payload));
    }
    for schema in [10, 11, 12, 13, 14, 15, 16, 17, 19] {
        // A schema-18 database must not be accepted under a different manifest version.
        let mut changed = manifest.clone();
        changed["schemaVersion"] = json!(schema);
        variants.push(encoded(&changed, &payload));
    }
    let mut changed = manifest.clone();
    changed["counts"]["users"] = json!(99);
    variants.push(encoded(&changed, &payload));
    let mut changed = manifest.clone();
    changed["files"]
        .as_array_mut()
        .unwrap()
        .push(manifest["files"][1].clone());
    variants.push(encoded(&changed, &payload));
    let mut header = b"HEARTHB1".to_vec();
    header.extend(1048577u32.to_le_bytes());
    variants.push(header);
    let restores = source.path().join("copies");
    std::fs::create_dir(&restores).unwrap();
    for (n, bytes) in variants.into_iter().enumerate() {
        let file = source.path().join(format!("bad-{n}.hearthbackup"));
        std::fs::write(&file, bytes).unwrap();
        assert!(
            backup::verify(&file, &restores).await.is_err(),
            "Variant {n}"
        );
        assert_eq!(
            std::fs::read_dir(&restores).unwrap().count(),
            0,
            "Failed variant {n} leaked a candidate"
        );
    }
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT body FROM journals")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        "SECRET BACKUP TEXT"
    );
}

#[tokio::test]
async fn checksummed_database_with_extra_trigger_is_rejected_before_restore() {
    let source = tempfile::tempdir().unwrap();
    let store = fixture(source.path()).await;
    let prepared = backup::create(&store, source.path(), "0.0.10", 100)
        .await
        .unwrap();
    let (mut manifest, payload) = parts(&std::fs::read(&prepared.path).unwrap());
    let old_size = manifest["files"][0]["byteSize"].as_u64().unwrap() as usize;
    let db = source.path().join("forged.db");
    std::fs::write(&db, &payload[..old_size]).unwrap();
    let mut conn = sqlx::SqliteConnection::connect_with(&SqliteConnectOptions::new().filename(&db))
        .await
        .unwrap();
    sqlx::query("CREATE TRIGGER surprise AFTER INSERT ON journals BEGIN DELETE FROM tokens; END")
        .execute(&mut conn)
        .await
        .unwrap();
    conn.close().await.unwrap();
    let changed = std::fs::read(&db).unwrap();
    manifest["files"][0]["byteSize"] = json!(changed.len());
    manifest["files"][0]["sha256"] = json!(hex::encode(Sha256::digest(&changed)));
    let combined = [changed, payload[old_size..].to_vec()].concat();
    let forged = source.path().join("forged.hearthbackup");
    std::fs::write(&forged, encoded(&manifest, &combined)).unwrap();
    assert!(
        backup::verify(&forged, &source.path().join("copies"))
            .await
            .is_err()
    );
}

#[tokio::test]
async fn missing_or_corrupt_source_artwork_cannot_be_offered_as_a_complete_backup() {
    let source = tempfile::tempdir().unwrap();
    let store = fixture(source.path()).await;
    let path = source
        .path()
        .join("assets")
        .join(format!("{}.png", hex::encode(Sha256::digest(ART))));
    std::fs::remove_file(&path).unwrap();
    assert!(
        backup::create(&store, source.path(), "0.0.10", 100)
            .await
            .is_err()
    );
    std::fs::write(&path, b"broken artwork").unwrap();
    assert!(
        backup::create(&store, source.path(), "0.0.10", 100)
            .await
            .is_err()
    );
    assert_eq!(
        std::fs::read_dir(source.path().join("backups"))
            .unwrap()
            .count(),
        0
    );
}

#[tokio::test]
async fn hash_consistent_non_png_artwork_is_rejected() {
    let source = tempfile::tempdir().unwrap();
    let store = fixture(source.path()).await;
    let bytes = b"<svg><script>not artwork</script></svg>";
    let sha = hex::encode(Sha256::digest(bytes));
    std::fs::write(
        source.path().join("assets").join(format!("{sha}.png")),
        bytes,
    )
    .unwrap();
    sqlx::query("UPDATE assets SET sha256=?,byte_size=?")
        .bind(&sha)
        .bind(bytes.len() as i64)
        .execute(&store.pool)
        .await
        .unwrap();
    assert!(
        backup::create(&store, source.path(), "0.0.10", 100)
            .await
            .is_err()
    );
    assert_eq!(
        std::fs::read_dir(source.path().join("backups"))
            .unwrap()
            .count(),
        0
    );
}

#[cfg(unix)]
#[tokio::test]
async fn linked_recovery_parent_is_rejected_without_writing_outside_the_store() {
    let source = tempfile::tempdir().unwrap();
    let store = fixture(source.path()).await;
    let prepared = backup::create(&store, source.path(), "0.0.10", 100)
        .await
        .unwrap();
    let outside = tempfile::tempdir().unwrap();
    let link = source.path().join("linked-restores");
    std::os::unix::fs::symlink(outside.path(), &link).unwrap();
    assert!(backup::verify(&prepared.path, &link).await.is_err());
    assert_eq!(std::fs::read_dir(outside.path()).unwrap().count(), 0);
}
#[tokio::test]
async fn checksummed_trigger_with_sqlite_like_prefix_cannot_modify_recovered_credentials() {
    let source = tempfile::tempdir().unwrap();
    let store = fixture(source.path()).await;
    let prepared = backup::create(&store, source.path(), "0.0.10", 100)
        .await
        .unwrap();
    let (mut manifest, payload) = parts(&std::fs::read(&prepared.path).unwrap());
    let size = manifest["files"][0]["byteSize"].as_u64().unwrap() as usize;
    let path = source.path().join("hidden-trigger.db");
    std::fs::write(&path, &payload[..size]).unwrap();
    let mut db = sqlx::SqliteConnection::connect_with(&SqliteConnectOptions::new().filename(&path))
        .await
        .unwrap();
    sqlx::query("CREATE TRIGGER sqliteXevil AFTER DELETE ON device_sessions BEGIN UPDATE users SET password_hash='changed'; END").execute(&mut db).await.unwrap();
    db.close().await.unwrap();
    let changed = std::fs::read(&path).unwrap();
    manifest["files"][0]["byteSize"] = json!(changed.len());
    manifest["files"][0]["sha256"] = json!(hex::encode(Sha256::digest(&changed)));
    let forged = source.path().join("hidden-trigger.hearthbackup");
    std::fs::write(
        &forged,
        encoded(&manifest, &[changed, payload[size..].to_vec()].concat()),
    )
    .unwrap();
    let result = backup::verify(&forged, &source.path().join("copies")).await;
    assert!(
        result.is_err(),
        "A trigger hidden by a LIKE wildcard must not pass schema validation"
    );
}

#[test]
fn recovery_candidate_is_guarded_before_any_archive_work_can_start() {
    // Occupy the only blocking worker to inspect the real candidate while the
    // production digest/extraction job is queued. No timing or test hook needed.
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .max_blocking_threads(1)
        .build()
        .unwrap();
    runtime.block_on(async {
        let root = tempfile::tempdir().unwrap();
        let input = root.path().join("incoming.hearthbackup");
        std::fs::write(&input, b"invalid input").unwrap();
        let parent = root.path().join("copies");
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        let held = tokio::task::spawn_blocking(move || {
            ready_tx.send(()).unwrap();
            release_rx.recv().unwrap();
        });
        ready_rx.await.unwrap();
        let copy_parent = parent.clone();
        let job = tokio::spawn(async move { backup::verify(&input, &copy_parent).await });
        tokio::task::yield_now().await;
        let guarded = std::fs::read_dir(&parent)
            .ok()
            .and_then(|mut entries| entries.next())
            .and_then(Result::ok)
            .is_some_and(|entry| entry.path().join(".restore-in-progress").is_file());
        release_tx.send(()).unwrap();
        assert!(job.await.unwrap().is_err());
        held.await.unwrap();
        assert!(
            guarded,
            "Candidate must be marked before digest/extraction, including when workers are busy"
        );
    });
}
#[tokio::test]
async fn database_maintenance_statistics_do_not_prevent_a_valid_recovery() {
    let source = tempfile::tempdir().unwrap();
    let store = fixture(source.path()).await;
    sqlx::query("ANALYZE").execute(&store.pool).await.unwrap();
    let prepared = backup::create(&store, source.path(), "0.0.10", 100)
        .await
        .unwrap();
    let verified = backup::verify(&prepared.path, &source.path().join("copies"))
        .await
        .unwrap();
    let restored = backup::restore(verified, 200).await.unwrap();
    let copy = Store::open(&restored).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT body FROM journals")
            .fetch_one(&copy.pool)
            .await
            .unwrap(),
        "SECRET BACKUP TEXT"
    );
    copy.pool.close().await;
}

#[tokio::test]
async fn schema_ten_backup_restores_and_migrates_without_losing_data() {
    static MIGRATIONS: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
    let root = tempfile::tempdir().unwrap();
    let old_db = root.path().join("old.db");
    let options = SqliteConnectOptions::new()
        .filename(&old_db)
        .create_if_missing(true)
        .foreign_keys(true);
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    let legacy = sqlx::migrate::Migrator::with_migrations(
        MIGRATIONS
            .iter()
            .filter(|m| m.version <= 10)
            .cloned()
            .collect(),
    );
    legacy.run(&pool).await.unwrap();
    for query in [
        "INSERT INTO users VALUES('owner','owner','Game Master','password-hash',1,1)",
        "INSERT INTO host_profile(singleton,owner_id) VALUES(1,'owner')",
        "INSERT INTO device_sessions VALUES('old-session','owner',9999999999,1)",
        "INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('campaign','Recovery campaign','owner',1,1)",
        "INSERT INTO memberships VALUES('campaign','owner','dm',1)",
        "INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES('secret','campaign','Private note','PREVIOUS VERSION NOTE','dm',1)",
    ] {
        sqlx::query(query).execute(&pool).await.unwrap();
    }
    pool.close().await;
    let db = std::fs::read(&old_db).unwrap();
    let manifest = json!({"formatVersion":1,"schemaVersion":10,"appVersion":"0.0.11","createdAt":100,
        "counts":{"users":1,"campaigns":1,"scenes":0,"tokens":0,"actors":0,"journals":1,"messages":0,"rolls":0,"encounters":0,"assets":0},
        "files":[{"path":"hearth.db","byteSize":db.len(),"sha256":hex::encode(Sha256::digest(&db))}]});
    let archive = root.path().join("legacy.hearthbackup");
    std::fs::write(&archive, encoded(&manifest, &db)).unwrap();
    let restored = backup::restore(
        backup::verify(&archive, &root.path().join("restores"))
            .await
            .unwrap(),
        200,
    )
    .await
    .unwrap();
    let reopened = Store::open(&restored).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT body FROM journals WHERE id='secret'")
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
        "PREVIOUS VERSION NOTE"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM device_sessions")
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM _sqlx_migrations")
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
        18
    );
}

#[tokio::test]
async fn newly_created_backups_report_schema_eighteen() {
    let root = tempfile::tempdir().unwrap();
    let store = fixture(root.path()).await;
    let prepared = backup::create(&store, root.path(), "0.0.12", 100)
        .await
        .unwrap();
    assert_eq!(prepared.summary.schema_version, 18);
}

#[tokio::test]
async fn backup_preserves_shared_and_private_drawings() {
    let root = tempfile::tempdir().unwrap();
    let store = fixture(root.path()).await;
    sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at) VALUES('scene','campaign','Map',160,160,40,'art',1)").execute(&store.pool).await.unwrap();
    sqlx::query("INSERT INTO tokens(id,scene_id,name,x,y,size,color,asset_id,visibility,vitals_version,hp,max_hp,hp_visibility,statuses) VALUES('vitals-token','scene','Vitals',80,80,40,'#ffcc00','art','shared',9,7,13,'shared','[\"marked\",\"poisoned\"]')").execute(&store.pool).await.unwrap();
    for visibility in ["dm", "shared"] {
        sqlx::query("INSERT INTO scene_notes VALUES('scene',?,?,7)")
            .bind(visibility)
            .bind(format!("<b>{visibility} 🐉</b>\n\tExact text"))
            .execute(&store.pool)
            .await
            .unwrap();
    }
    for visibility in ["shared", "dm"] {
        sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y) VALUES(?,'scene','line',?,'#e8bc6a',10,10,20,20)").bind(visibility).bind(visibility).execute(&store.pool).await.unwrap();
    }
    let text = "<b>Literal 🐉</b>\nNorth gate";
    for visibility in ["shared", "dm"] {
        sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,text) VALUES(?,'scene','text',?,'#72b7e2',20,20,140,100,?)").bind(format!("text-{visibility}")).bind(visibility).bind(text).execute(&store.pool).await.unwrap();
    }
    let sort_order: i64 = sqlx::query_scalar("SELECT sort_order FROM drawings WHERE id='text-dm'")
        .fetch_one(&store.pool)
        .await
        .unwrap();
    let history=json!({"sort_order":sort_order,"id":"text-dm","scene_id":"scene","shape":"text","visibility":"dm","color":"#72b7e2","start_x":20.0,"start_y":20.0,"end_x":140.0,"end_y":100.0,"points":"[]","text":text,"font_size":24,"text_fit":true,"version":1}).to_string();
    sqlx::query("INSERT INTO drawing_history(scene_id,drawing_id,action,before_state) VALUES('scene','text-dm','update',?)").bind(&history).execute(&store.pool).await.unwrap();
    sqlx::query("UPDATE drawings SET font_size=48,text_fit=0,version=2 WHERE id='text-dm'")
        .execute(&store.pool)
        .await
        .unwrap();
    let points = "[{\"x\":10.12,\"y\":10.57},{\"x\":90.0,\"y\":20.0},{\"x\":10.12,\"y\":10.57}]";
    sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points) VALUES('stroke','scene','freehand','dm','#72b7e2',10.12,10.57,10.12,10.57,?)").bind(points).execute(&store.pool).await.unwrap();
    sqlx::query("INSERT INTO journal_folders(id,campaign_id,name,version) VALUES('folder','campaign','Exact 🐉',7)").execute(&store.pool).await.unwrap();
    sqlx::query("INSERT INTO journal_folders(id,campaign_id,parent_id,name,version) VALUES('child','campaign','folder','Nested',3)").execute(&store.pool).await.unwrap();
    sqlx::query("UPDATE journals SET folder_id='child'")
        .execute(&store.pool)
        .await
        .unwrap();
    let prepared = backup::create(&store, root.path(), "0.0.12", 100)
        .await
        .unwrap();
    let restored = backup::restore(
        backup::verify(&prepared.path, &root.path().join("restores"))
            .await
            .unwrap(),
        200,
    )
    .await
    .unwrap();
    let copy = Store::open(&restored).await.unwrap();
    assert_eq!(
        sqlx::query_as::<_, (String, Option<String>, String, i64)>(
            "SELECT id,parent_id,name,version FROM journal_folders ORDER BY id"
        )
        .fetch_all(&copy.pool)
        .await
        .unwrap(),
        vec![
            ("child".into(), Some("folder".into()), "Nested".into(), 3),
            ("folder".into(), None, "Exact 🐉".into(), 7)
        ]
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT folder_id FROM journals")
            .fetch_one(&copy.pool)
            .await
            .unwrap(),
        "child"
    );
    assert_eq!(sqlx::query_as::<_,(i64,i64,i64,String,String)>("SELECT hp,max_hp,vitals_version,hp_visibility,statuses FROM tokens WHERE id='vitals-token'").fetch_one(&copy.pool).await.unwrap(),(7,13,9,"shared".into(),"[\"marked\",\"poisoned\"]".into()));
    let notes: Vec<(String, String, i64)> =
        sqlx::query_as("SELECT visibility,body,version FROM scene_notes ORDER BY visibility")
            .fetch_all(&copy.pool)
            .await
            .unwrap();
    assert_eq!(
        notes,
        vec![
            ("dm".into(), "<b>dm 🐉</b>\n\tExact text".into(), 7),
            ("shared".into(), "<b>shared 🐉</b>\n\tExact text".into(), 7)
        ]
    );
    let visibility: Vec<String> =
        sqlx::query_scalar("SELECT visibility FROM drawings ORDER BY visibility")
            .fetch_all(&copy.pool)
            .await
            .unwrap();
    assert_eq!(visibility, ["dm", "dm", "dm", "shared", "shared"]);
    assert_eq!(
        sqlx::query_scalar::<_, String>(
            "SELECT before_state FROM drawing_history WHERE drawing_id='text-dm'"
        )
        .fetch_one(&copy.pool)
        .await
        .unwrap(),
        history
    );
    assert_eq!(
        sqlx::query_as::<_, (i64, bool, i64)>(
            "SELECT font_size,text_fit,version FROM drawings WHERE id='text-dm'"
        )
        .fetch_one(&copy.pool)
        .await
        .unwrap(),
        (48, false, 2)
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>(
            "SELECT text FROM drawings WHERE shape='text' ORDER BY rowid"
        )
        .fetch_all(&copy.pool)
        .await
        .unwrap(),
        [text, text]
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT points FROM drawings WHERE id='stroke'")
            .fetch_one(&copy.pool)
            .await
            .unwrap(),
        points
    );
}

#[tokio::test]
async fn schema_eleven_backup_restores_and_migrates_without_losing_data() {
    restore_previous_drawing_schema(11).await;
}

#[tokio::test]
async fn schema_twelve_backup_restores_and_migrates_without_losing_points() {
    restore_previous_drawing_schema(12).await;
}

#[tokio::test]
async fn schema_thirteen_text_backup_upgrades_font_version_and_history() {
    restore_previous_drawing_schema(13).await;
}

async fn restore_previous_drawing_schema(schema: i64) {
    static MIGRATIONS: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
    let root = tempfile::tempdir().unwrap();
    let old_db = root.path().join("old.db");
    let options = SqliteConnectOptions::new()
        .filename(&old_db)
        .create_if_missing(true)
        .foreign_keys(true);
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    let legacy = sqlx::migrate::Migrator::with_migrations(
        MIGRATIONS
            .iter()
            .filter(|m| m.version <= schema)
            .cloned()
            .collect(),
    );
    legacy.run(&pool).await.unwrap();
    for query in [
        "INSERT INTO users VALUES('owner','owner','Game Master','password-hash',1,1)",
        "INSERT INTO host_profile(singleton,owner_id) VALUES(1,'owner')",
        "INSERT INTO device_sessions VALUES('old-session','owner',9999999999,1)",
        "INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('campaign','Recovery campaign','owner',1,1)",
        "INSERT INTO memberships VALUES('campaign','owner','dm',1)",
        "INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES('secret','campaign','Private note','PREVIOUS VERSION NOTE','dm',1)",
    ] {
        sqlx::query(query).execute(&pool).await.unwrap();
    }
    sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at) VALUES('old-scene','campaign','Old map',1440,960,60,'amber-map',1)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y) VALUES('old-line','old-scene','line','shared','#e8bc6a',10,20,30,40)").execute(&pool).await.unwrap();
    let points = "[{\"x\":10.12,\"y\":20.0},{\"x\":30.0,\"y\":40.0}]";
    if schema >= 12 {
        sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points) VALUES('old-stroke','old-scene','freehand','dm','#e65b5b',10.12,20,30,40,?)").bind(points).execute(&pool).await.unwrap();
    }
    sqlx::query("INSERT INTO drawing_creation_nonces VALUES('campaign','owner','old-nonce')")
        .execute(&pool)
        .await
        .unwrap();
    if schema == 13 {
        sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,text) VALUES('old-text','old-scene','text','dm','#abcdef',20,20,220,120,'Original label')").execute(&pool).await.unwrap();
    }
    if schema >= 15 {
        sqlx::query(
            "INSERT INTO scene_notes VALUES('old-scene','dm','OLD SCHEMA15 PRIVATE NOTE',5)",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO tokens(id,scene_id,name,x,y,size,color,asset_id,visibility) VALUES('old-token','old-scene','Old token',40,40,40,'#ffcc00','amber-map','shared')").execute(&pool).await.unwrap();
    }
    pool.close().await;
    let db = std::fs::read(&old_db).unwrap();
    let manifest = json!({"formatVersion":1,"schemaVersion":schema,"appVersion":"0.0.14","createdAt":100,
        "counts":{"users":1,"campaigns":1,"scenes":1,"tokens":if schema>=15 {1} else {0},"actors":0,"journals":1,"messages":0,"rolls":0,"encounters":0,"assets":0},
        "files":[{"path":"hearth.db","byteSize":db.len(),"sha256":hex::encode(Sha256::digest(&db))}]});
    let archive = root.path().join("legacy.hearthbackup");
    std::fs::write(&archive, encoded(&manifest, &db)).unwrap();
    let restored = backup::restore(
        backup::verify(&archive, &root.path().join("restores"))
            .await
            .unwrap(),
        200,
    )
    .await
    .unwrap();
    let reopened = Store::open(&restored).await.unwrap();
    let image: Option<String> =
        sqlx::query_scalar("SELECT asset_id FROM journals WHERE id='secret'")
            .fetch_one(&reopened.pool)
            .await
            .unwrap();
    assert!(
        image.is_none(),
        "Old text pages must not gain an image or sharing grant"
    );
    if schema >= 15 {
        assert_eq!(
            sqlx::query_as::<_, (String, i64)>(
                "SELECT body,version FROM scene_notes WHERE scene_id='old-scene'"
            )
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
            ("OLD SCHEMA15 PRIVATE NOTE".into(), 5)
        );
        assert_eq!(sqlx::query_as::<_,(Option<i64>,Option<i64>,i64,String,String)>("SELECT hp,max_hp,vitals_version,hp_visibility,statuses FROM tokens WHERE id='old-token'").fetch_one(&reopened.pool).await.unwrap(),(None,None,1,"controllers".into(),"[]".into()));
    }

    if schema == 13 {
        assert!(
            sqlx::query_scalar::<_, bool>("SELECT text_fit FROM drawings WHERE id='old-text'")
                .fetch_one(&reopened.pool)
                .await
                .unwrap()
        );
        assert_eq!(
            sqlx::query_as::<_, (i64, i64)>(
                "SELECT font_size,version FROM drawings WHERE id='old-text'"
            )
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
            (24, 1)
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM drawing_history WHERE scene_id='old-scene'"
            )
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
            3
        );
    }
    if schema >= 12 {
        assert_eq!(
            sqlx::query_scalar::<_, String>("SELECT points FROM drawings WHERE id='old-stroke'")
                .fetch_one(&reopened.pool)
                .await
                .unwrap(),
            points
        );
        assert_eq!(
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM drawings WHERE text IS NOT NULL AND id!='old-text'"
            )
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
            0
        );
    }
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT body FROM journals WHERE id='secret'")
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
        "PREVIOUS VERSION NOTE"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM device_sessions")
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM _sqlx_migrations")
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
        18
    );
    assert_eq!(
        sqlx::query_as::<_, (String, f64, f64, String)>(
            "SELECT shape,start_x,end_y,points FROM drawings WHERE id='old-line'"
        )
        .fetch_one(&reopened.pool)
        .await
        .unwrap(),
        ("line".into(), 10.0, 40.0, "[]".into())
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT nonce FROM drawing_creation_nonces")
            .fetch_one(&reopened.pool)
            .await
            .unwrap(),
        "old-nonce"
    );
}

#[tokio::test]
async fn schema_fourteen_backup_upgrades_without_losing_drawing_state() {
    restore_previous_drawing_schema(14).await;
}

#[tokio::test]
async fn schema_fifteen_backup_preserves_notes_and_adds_unconfigured_token_vitals() {
    restore_previous_drawing_schema(15).await;
}

#[tokio::test]
async fn schema_sixteen_backup_preserves_notes_and_vitals_and_adds_root_organization() {
    restore_previous_drawing_schema(16).await;
}

#[tokio::test]
async fn journal_images_survive_backup_and_reject_foreign_campaign_references() {
    let root = tempfile::tempdir().unwrap();
    let store = fixture(root.path()).await;
    sqlx::query("UPDATE journals SET asset_id='art',version=8 WHERE id='secret'")
        .execute(&store.pool)
        .await
        .unwrap();
    let prepared = backup::create(&store, root.path(), "0.0.21", 100)
        .await
        .unwrap();
    let restored = backup::restore(
        backup::verify(&prepared.path, &root.path().join("restores"))
            .await
            .unwrap(),
        200,
    )
    .await
    .unwrap();
    let copy = Store::open(&restored).await.unwrap();
    let page: (String, String, i64) =
        sqlx::query_as("SELECT asset_id,visibility,version FROM journals WHERE id='secret'")
            .fetch_one(&copy.pool)
            .await
            .unwrap();
    assert_eq!(page, ("art".to_owned(), "dm".to_owned(), 8));
    assert_eq!(
        std::fs::read(
            restored
                .join("assets")
                .join(format!("{}.png", hex::encode(Sha256::digest(ART))))
        )
        .unwrap(),
        ART
    );
    sqlx::query("INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('foreign','Other','owner',1,1)").execute(&store.pool).await.unwrap();
    sqlx::query("UPDATE assets SET campaign_id='foreign' WHERE id='art'")
        .execute(&store.pool)
        .await
        .unwrap();
    assert!(
        backup::create(&store, root.path(), "0.0.21", 300)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn schema_seventeen_archive_preserves_pages_and_upgrades_images_to_unset() {
    restore_previous_drawing_schema(17).await;
}
