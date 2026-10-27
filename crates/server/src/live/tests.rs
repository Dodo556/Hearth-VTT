use super::*;
use hearth_domain::commands::{MoveToken, TokenCommand, TokenVisibility, Visibility};
struct GatedSink {
    state: AppState,
    hidden: String,
    revoke: bool,
    frames: Vec<Value>,
}
impl FrameSink for GatedSink {
    async fn write(&mut self, value: Value) -> ApiResult<()> {
        self.frames.push(value);
        if self.frames.len() == 1 {
            // A control change commits while an earlier write is in progress.
            if self.revoke {
                sqlx::query("DELETE FROM memberships WHERE user_id='player'")
                    .execute(&self.state.store.pool)
                    .await?;
                self.state.live.notify_access();
            } else {
                commands::execute(
                    &self.state,
                    "dm",
                    "camp",
                    &uuid::Uuid::new_v4().to_string(),
                    2,
                    TokenCommand::Visibility(TokenVisibility {
                        token_id: self.hidden.clone(),
                        visibility: Visibility::Dm,
                    }),
                )
                .await?;
            }
        }
        Ok(())
    }
}
async fn batch_race(revoke: bool) {
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
    for user in ["dm", "player"] {
        sqlx::query("INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,'fixture',1)").bind(user).bind(user).bind(user).execute(&state.store.pool).await.unwrap();
        sqlx::query(
            "INSERT INTO device_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,1)",
        )
        .bind(user)
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
    let mut view = View {
        epoch: 0,
        revision: 0,
        known: HashSet::new(),
    };
    assert!(snapshot(&state, "camp", "player", &mut view).await.is_ok());
    let hidden: String = sqlx::query_scalar("SELECT id FROM tokens WHERE visibility='dm'")
        .fetch_one(&state.store.pool)
        .await
        .unwrap();
    let shared: String =
        sqlx::query_scalar("SELECT id FROM tokens WHERE visibility='shared' LIMIT 1")
            .fetch_one(&state.store.pool)
            .await
            .unwrap();
    assert!(
        commands::execute(
            &state,
            "dm",
            "camp",
            &uuid::Uuid::new_v4().to_string(),
            0,
            TokenCommand::Move(MoveToken {
                token_id: shared,
                x: 630.0,
                y: 690.0
            })
        )
        .await
        .is_ok()
    );
    assert!(
        commands::execute(
            &state,
            "dm",
            "camp",
            &uuid::Uuid::new_v4().to_string(),
            1,
            TokenCommand::Visibility(TokenVisibility {
                token_id: hidden.clone(),
                visibility: Visibility::Shared
            })
        )
        .await
        .is_ok()
    );
    let mut sink = GatedSink {
        state: state.clone(),
        hidden: hidden.clone(),
        revoke,
        frames: Vec::new(),
    };
    let result = flush(&mut sink, &state, "camp", "player", &mut view).await;
    if revoke {
        assert!(
            result.is_err(),
            "A revoked subscriber must stop before the next queued frame"
        );
        assert_eq!(sink.frames.len(), 1);
    } else {
        assert!(result.is_ok());
        assert!(
            !serde_json::to_string(&sink.frames)
                .unwrap()
                .contains(&hidden),
            "A newly concealed token must not appear in later queued frames"
        );
    }
}
#[tokio::test]
async fn concealment_during_a_write_filters_later_queued_frames() {
    batch_race(false).await;
}
#[tokio::test]
async fn revocation_during_a_write_stops_later_queued_frames() {
    batch_race(true).await;
}

struct ActivateDuringWrite {
    state: AppState,
    draft: String,
    frames: Vec<Value>,
}
impl FrameSink for ActivateDuringWrite {
    async fn write(&mut self, value: Value) -> ApiResult<()> {
        self.frames.push(value);
        if self.frames.len() == 1 {
            commands::execute(
                &self.state,
                "dm",
                "camp",
                &uuid::Uuid::new_v4().to_string(),
                4,
                TokenCommand::SceneActivate(hearth_domain::commands::SceneRef {
                    scene_id: self.draft.clone(),
                }),
            )
            .await?;
        }
        Ok(())
    }
}
#[tokio::test]
async fn activation_during_a_write_never_replays_private_draft_history() {
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
    for user in ["dm", "player"] {
        sqlx::query("INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,'fixture',1)").bind(user).bind(user).bind(user).execute(&state.store.pool).await.unwrap();
        sqlx::query(
            "INSERT INTO device_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,1)",
        )
        .bind(user)
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
    let draft = uuid::Uuid::new_v4().to_string();
    let token = uuid::Uuid::new_v4().to_string();
    async fn action(state: &AppState, base: i64, value: Value) {
        let command = serde_json::from_value(value).unwrap();
        assert!(
            commands::execute(
                state,
                "dm",
                "camp",
                &uuid::Uuid::new_v4().to_string(),
                base,
                command
            )
            .await
            .is_ok()
        );
    }
    action(&state,0,json!({"type":"scene.create","payload":{"sceneId":draft,"name":"Draft","assetId":"amber-map","gridSize":60}})).await;
    let mut view = View {
        epoch: 0,
        revision: 0,
        known: HashSet::new(),
    };
    assert!(snapshot(&state, "camp", "player", &mut view).await.is_ok());
    let shared: String =
        sqlx::query_scalar("SELECT id FROM tokens WHERE visibility='shared' LIMIT 1")
            .fetch_one(&state.store.pool)
            .await
            .unwrap();
    action(
        &state,
        1,
        json!({"type":"token.move","payload":{"tokenId":shared,"x":630,"y":690}}),
    )
    .await;
    action(&state,2,json!({"type":"token.create","payload":{"tokenId":token,"sceneId":draft,"name":"UNPUBLISHED SECRET NAME","assetId":"vault-sentinel","size":52,"x":150,"y":150,"visibility":"shared"}})).await;
    action(&state,3,json!({"type":"token.update","payload":{"tokenId":token,"name":"Public guardian","assetId":"token-scout","size":52}})).await;
    let mut sink = ActivateDuringWrite {
        state: state.clone(),
        draft,
        frames: Vec::new(),
    };
    assert!(
        flush(&mut sink, &state, "camp", "player", &mut view)
            .await
            .is_ok()
    );
    assert!(
        flush(&mut sink, &state, "camp", "player", &mut view)
            .await
            .is_ok()
    );
    let serialized = serde_json::to_string(&sink.frames).unwrap();
    assert!(!serialized.contains("UNPUBLISHED SECRET NAME"));
    assert!(!serialized.contains("vault-sentinel"));
    assert!(serialized.contains("Public guardian"));
}

struct RevokeActorDuringWrite {
    state: AppState,
    actor: String,
    player: String,
    frames: Vec<Value>,
}
impl FrameSink for RevokeActorDuringWrite {
    async fn write(&mut self, v: Value) -> ApiResult<()> {
        self.frames.push(v);
        if self.frames.len() == 1 {
            commands::execute(&self.state,"dm","camp",&uuid::Uuid::new_v4().to_string(),2,serde_json::from_value(json!({"type":"actor.permission","payload":{"actorId":self.actor,"userId":self.player,"permission":"none"}})).unwrap()).await?;
        }
        Ok(())
    }
}
#[tokio::test]
async fn actor_revocation_during_a_write_filters_later_ids_and_control() {
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
    let player = uuid::Uuid::new_v4().to_string();
    let actor = uuid::Uuid::new_v4().to_string();
    for user in ["dm", &player] {
        sqlx::query("INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,'fixture',1)").bind(user).bind(user).bind(user).execute(&state.store.pool).await.unwrap();
        sqlx::query(
            "INSERT INTO device_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,1)",
        )
        .bind(user)
        .bind(user)
        .bind(security::now() + 3600)
        .execute(&state.store.pool)
        .await
        .unwrap();
    }
    sqlx::query("INSERT INTO campaigns(id,name,created_by,created_at,updated_at) VALUES('camp','Keep','dm',1,1)").execute(&state.store.pool).await.unwrap();
    for (u, r) in [("dm", "dm"), (player.as_str(), "player")] {
        sqlx::query(
            "INSERT INTO memberships(campaign_id,user_id,role,created_at) VALUES('camp',?,?,1)",
        )
        .bind(u)
        .bind(r)
        .execute(&state.store.pool)
        .await
        .unwrap();
    }
    let mut tx = state.store.pool.begin().await.unwrap();
    assert!(crate::demo::seed(&mut tx, "camp").await.is_ok());
    tx.commit().await.unwrap();
    sqlx::query("INSERT INTO actors(id,campaign_id,name,kind,asset_id,hp,max_hp,created_at) VALUES(?,'camp','PRIVATE SHEET','character','token-warden',12,20,1)").bind(&actor).execute(&state.store.pool).await.unwrap();
    sqlx::query("INSERT INTO actor_ownership(actor_id,campaign_id,user_id,permission) VALUES(?,'camp',?,'owner')").bind(&actor).bind(&player).execute(&state.store.pool).await.unwrap();
    let token: String =
        sqlx::query_scalar("SELECT id FROM tokens WHERE visibility='shared' LIMIT 1")
            .fetch_one(&state.store.pool)
            .await
            .unwrap();
    sqlx::query("UPDATE tokens SET actor_id=? WHERE id=?")
        .bind(&actor)
        .bind(&token)
        .execute(&state.store.pool)
        .await
        .unwrap();
    let mut view = View {
        epoch: 0,
        revision: 0,
        known: HashSet::new(),
    };
    assert!(snapshot(&state, "camp", &player, &mut view).await.is_ok());
    for base in 0..2 {
        assert!(
            commands::execute(
                &state,
                "dm",
                "camp",
                &uuid::Uuid::new_v4().to_string(),
                base,
                TokenCommand::Move(MoveToken {
                    token_id: token.clone(),
                    x: 630.0 + base as f64 * 60.0,
                    y: 690.0
                })
            )
            .await
            .is_ok()
        );
    }
    let mut sink = RevokeActorDuringWrite {
        state: state.clone(),
        actor: actor.clone(),
        player: player.clone(),
        frames: Vec::new(),
    };
    assert!(
        flush(&mut sink, &state, "camp", &player, &mut view)
            .await
            .is_ok()
    );
    assert_eq!(sink.frames[0]["payload"]["token"]["actorId"], actor);
    assert_eq!(sink.frames[1]["payload"]["token"]["actorId"], Value::Null);
    assert_eq!(sink.frames[1]["payload"]["token"]["canMove"], false);
    assert!(
        flush(&mut sink, &state, "camp", &player, &mut view)
            .await
            .is_ok()
    );
    assert_eq!(sink.frames.last().unwrap()["actors"], json!([]));
}

struct RevealFogDuringWrite {
    state: AppState,
    scene: String,
    frames: Vec<Value>,
}
impl FrameSink for RevealFogDuringWrite {
    async fn write(&mut self, value: Value) -> ApiResult<()> {
        self.frames.push(value);
        if self.frames.len() == 1 {
            commands::execute(
                &self.state,
                "dm",
                "camp",
                &uuid::Uuid::new_v4().to_string(),
                5,
                serde_json::from_value(
                    json!({"type":"fog.reset","payload":{"sceneId":self.scene,"mode":"reveal"}}),
                )
                .unwrap(),
            )
            .await?;
        }
        Ok(())
    }
}
#[tokio::test]
async fn fog_reveal_during_a_write_never_replays_hidden_preparation() {
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
    for user in ["dm", "player"] {
        sqlx::query("INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,'fixture',1)").bind(user).bind(user).bind(user).execute(&state.store.pool).await.unwrap();
        sqlx::query(
            "INSERT INTO device_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,1)",
        )
        .bind(user)
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
    let scene: String = sqlx::query_scalar("SELECT id FROM scenes")
        .fetch_one(&state.store.pool)
        .await
        .unwrap();
    let trigger: String =
        sqlx::query_scalar("SELECT id FROM tokens WHERE visibility='shared' LIMIT 1")
            .fetch_one(&state.store.pool)
            .await
            .unwrap();
    sqlx::query("UPDATE tokens SET x=30,y=30 WHERE id=?")
        .bind(&trigger)
        .execute(&state.store.pool)
        .await
        .unwrap();
    async fn act(state: &AppState, base: i64, value: Value) {
        assert!(
            commands::execute(
                state,
                "dm",
                "camp",
                &uuid::Uuid::new_v4().to_string(),
                base,
                serde_json::from_value(value).unwrap()
            )
            .await
            .is_ok()
        );
    }
    act(
        &state,
        0,
        json!({"type":"fog.configure","payload":{"sceneId":scene,"enabled":true}}),
    )
    .await;
    act(&state,1,json!({"type":"fog.paint","payload":{"sceneId":scene,"column":0,"row":0,"width":1,"height":1,"mode":"reveal"}})).await;
    let mut view = View {
        epoch: 0,
        revision: 0,
        known: HashSet::new(),
    };
    assert!(snapshot(&state, "camp", "player", &mut view).await.is_ok());
    act(
        &state,
        2,
        json!({"type":"token.move","payload":{"tokenId":trigger,"x":30,"y":30}}),
    )
    .await;
    let secret = uuid::Uuid::new_v4().to_string();
    act(&state,3,json!({"type":"token.create","payload":{"tokenId":secret,"sceneId":scene,"name":"FOG SECRET BEFORE REVEAL","assetId":"vault-sentinel","size":52,"x":300,"y":300,"visibility":"shared"}})).await;
    act(&state,4,json!({"type":"token.update","payload":{"tokenId":secret,"name":"Revealed guardian","assetId":"token-scout","size":52}})).await;
    let mut sink = RevealFogDuringWrite {
        state: state.clone(),
        scene,
        frames: Vec::new(),
    };
    assert!(
        flush(&mut sink, &state, "camp", "player", &mut view)
            .await
            .is_ok()
    );
    assert!(
        flush(&mut sink, &state, "camp", "player", &mut view)
            .await
            .is_ok()
    );
    let serialized = serde_json::to_string(&sink.frames).unwrap();
    assert!(!serialized.contains("FOG SECRET BEFORE REVEAL"));
    assert!(!serialized.contains("vault-sentinel"));
    assert!(!serialized.contains("tokenWasVisible"));
    assert!(!serialized.contains("sceneWasPublic"));
    assert!(serialized.contains("Revealed guardian"));
}
