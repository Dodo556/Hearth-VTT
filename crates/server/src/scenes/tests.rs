use super::*;
use serde_json::json;
#[tokio::test]
async fn authorized_projection_keeps_one_snapshot_during_conceal_and_private_authoring() {
    let root = tempfile::tempdir().unwrap();
    let state = AppState::new(crate::config::Config {
        bind: "127.0.0.1:8787".parse().unwrap(),
        data_dir: root.path().into(),
        web_dir: root.path().join("web"),
        origins: vec!["http://localhost:8787".into()],
        secure_cookie: false,
        allow_lan: false,
    })
    .await
    .unwrap();
    let cookie = "a".repeat(64);
    for user in ["dm", "player"] {
        sqlx::query("INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,'fixture',1)").bind(user).bind(user).bind(user).execute(&state.store.pool).await.unwrap();
        sqlx::query(
            "INSERT INTO device_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,1)",
        )
        .bind(if user == "dm" {
            "dm".to_owned()
        } else {
            security::digest(&cookie)
        })
        .bind(user)
        .bind(security::now() + 3600)
        .execute(&state.store.pool)
        .await
        .unwrap();
    }
    sqlx::query("INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('camp','Keep','dm',1,1)").execute(&state.store.pool).await.unwrap();
    for user in ["dm", "player"] {
        sqlx::query(
            "INSERT INTO memberships(campaign_id,user_id,role,created_at) VALUES('camp',?,?,1)",
        )
        .bind(user)
        .bind(user)
        .execute(&state.store.pool)
        .await
        .unwrap();
    }
    let mut tx = state.store.pool.begin().await.unwrap();
    assert!(crate::demo::seed(&mut tx, "camp").await.is_ok());
    tx.commit().await.unwrap();
    let original: String =
        sqlx::query_scalar("SELECT active_scene_id FROM campaigns WHERE id='camp'")
            .fetch_one(&state.store.pool)
            .await
            .unwrap();
    let mut headers = HeaderMap::new();
    headers.insert(
        "cookie",
        format!("hearth_session={cookie}").parse().unwrap(),
    );
    // The real REST read scope must retain its authorization snapshot through
    // every scene/token query, while another connection prepares hidden content.
    let (mut read, user, dm) = authorized_read(&state, &headers, "camp")
        .await
        .unwrap_or_else(|_| panic!("read scope"));
    for (base, command) in [
        (
            0,
            json!({"type":"scene.conceal","payload":{"sceneId":original}}),
        ),
        (
            1,
            json!({"type":"token.create","payload":{"tokenId":uuid::Uuid::new_v4().to_string(),"sceneId":original,"name":"NEVER PUBLIC","assetId":"token-scout","size":52,"x":90,"y":90,"visibility":"shared"}}),
        ),
    ] {
        assert!(
            commands::execute(
                &state,
                "dm",
                "camp",
                &uuid::Uuid::new_v4().to_string(),
                base,
                serde_json::from_value(command).unwrap()
            )
            .await
            .is_ok()
        );
    }
    let projection = projected_scenes(&mut read, "camp", dm, &user)
        .await
        .unwrap_or_else(|_| panic!("projection"));
    assert_eq!(
        projection.len(),
        1,
        "Authorization and projection must share the earlier committed snapshot"
    );
    assert!(
        !serde_json::to_string(&projection)
            .unwrap()
            .contains("NEVER PUBLIC")
    );
}
