use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header},
};
use hearth_server::{AppState, config::Config};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

include!("cases/security.rs");
include!("cases/live.rs");
include!("cases/authoring.rs");
include!("cases/actors.rs");
include!("cases/fog.rs");
include!("cases/recovery.rs");

struct Host {
    app: Router,
    state: AppState,
    _dir: tempfile::TempDir,
}
impl Host {
    async fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let state = AppState::new(Config {
            bind: "127.0.0.1:8787".parse().unwrap(),
            data_dir: dir.path().into(),
            web_dir: dir.path().join("web"),
            origins: vec!["http://localhost:8787".into()],
            secure_cookie: false,
            allow_lan: false,
        })
        .await
        .unwrap();
        Self {
            app: hearth_server::router(state.clone()),
            state,
            _dir: dir,
        }
    }
    async fn request(
        &self,
        method: &str,
        uri: &str,
        body: Value,
        cookie: Option<&str>,
    ) -> (StatusCode, Value, Option<String>) {
        let mut request = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::HOST, "localhost:8787")
            .header(header::ORIGIN, "http://localhost:8787")
            .header(header::CONTENT_TYPE, "application/json")
            .header("x-hearth-request", "1");
        if let Some(cookie) = cookie {
            request = request.header(header::COOKIE, cookie);
        }
        let response = self
            .app
            .clone()
            .oneshot(request.body(Body::from(body.to_string())).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let cookie = response
            .headers()
            .get(header::SET_COOKIE)
            .map(|v| v.to_str().unwrap().split(';').next().unwrap().to_owned());
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, body, cookie)
    }
    async fn owner(&self) -> String {
        let (status, _, cookie) = self.request("POST", "/api/setup/owner", json!({"username":"gamemaster","displayName":"Dominik","password":"a long strong password","createDemo":true}), None).await;
        assert_eq!(status, StatusCode::OK);
        cookie.unwrap()
    }
    async fn campaign_id(&self, cookie: &str) -> String {
        let (_, body, _) = self
            .request("GET", "/api/campaigns", json!({}), Some(cookie))
            .await;
        body["campaigns"][0]["id"].as_str().unwrap().to_owned()
    }
    async fn invite(&self, owner: &str, id: &str) -> Value {
        let (status, body, _) = self
            .request(
                "POST",
                &format!("/api/campaigns/{id}/invites"),
                json!({"expiresInHours":24}),
                Some(owner),
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        body["invite"].clone()
    }
    async fn player(&self, owner: &str, id: &str, name: &str) -> (String, String) {
        let invite = self.invite(owner, id).await;
        let (status,body,cookie)=self.request("POST","/api/invites/redeem",json!({"code":invite["code"],"username":name,"displayName":name,"password":"a strong player password"}),None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["user"]["isOwner"], false);
        (cookie.unwrap(), body["user"]["id"].as_str().unwrap().into())
    }
}

#[tokio::test]
async fn health_is_versioned_and_does_not_expose_campaign_names() {
    let host = Host::new().await;
    let (status, json, _) = host.request("GET", "/api/health", json!({}), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["schemaVersion"], 1);
    assert_eq!(json["status"], "ok");
    assert_eq!(json["setupRequired"], true);
    assert!(json.get("campaigns").is_none());
}

#[tokio::test]
async fn owner_setup_is_atomic_password_is_hashed_and_logout_revokes_session() {
    let host = Host::new().await;
    let cookie = host.owner().await;
    let (status, body, _) = host
        .request("GET", "/api/auth/me", json!({}), Some(&cookie))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["user"]["isOwner"], true);
    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users")
        .fetch_one(&host.state.store.pool)
        .await
        .unwrap();
    assert!(hash.starts_with("$argon2id$"));
    let (status, _, _) = host.request("POST", "/api/setup/owner", json!({"username":"impostor","displayName":"Fake","password":"another long password","createDemo":false}), None).await;
    assert_eq!(status, StatusCode::CONFLICT);
    let (status, _, _) = host
        .request("POST", "/api/auth/logout", json!({}), Some(&cookie))
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, _) = host
        .request("GET", "/api/campaigns", json!({}), Some(&cookie))
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn unauthenticated_and_cross_origin_requests_are_denied() {
    let host = Host::new().await;
    let (status, _, _) = host.request("GET", "/api/campaigns", json!({}), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let response = host
        .app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/setup/owner")
                .header("host", "localhost:8787")
                .header("origin", "http://evil.example")
                .header("content-type", "application/json")
                .body(Body::from("{}"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn two_players_receive_filtered_demo_and_cannot_access_hidden_assets_or_other_campaigns() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let (alice, _) = host.player(&owner, &id, "alice").await;
    let (bob, bob_id) = host.player(&owner, &id, "bob").await;
    let (_, dm_scenes, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}/scenes"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(
        dm_scenes["scenes"][0]["tokens"].as_array().unwrap().len(),
        3
    );
    let (_, dm_journals, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}/journals"),
            json!({}),
            Some(&owner),
        )
        .await;
    let hidden_journal = dm_journals["journals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|j| j["visibility"] == "dm")
        .unwrap()["id"]
        .as_str()
        .unwrap();
    for cookie in [&alice, &bob] {
        let (status, scenes, _) = host
            .request(
                "GET",
                &format!("/api/campaigns/{id}/scenes"),
                json!({}),
                Some(cookie),
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(scenes["scenes"][0]["tokens"].as_array().unwrap().len(), 2);
        assert!(!scenes.to_string().contains("sentinel"));
        let (_, journals, _) = host
            .request(
                "GET",
                &format!("/api/campaigns/{id}/journals"),
                json!({}),
                Some(cookie),
            )
            .await;
        assert_eq!(journals["journals"].as_array().unwrap().len(), 1);
        assert!(!journals.to_string().contains("clapper"));
        for path in [
            format!("/api/campaigns/{id}/assets/vault-sentinel"),
            format!("/api/campaigns/{id}/journals/{hidden_journal}"),
        ] {
            let (status, _, _) = host.request("GET", &path, json!({}), Some(cookie)).await;
            assert_eq!(status, StatusCode::NOT_FOUND);
        }
        let (status, _, _) = host
            .request(
                "POST",
                "/api/campaigns",
                json!({"name":"Forged","createDemo":false}),
                Some(cookie),
            )
            .await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        let (status, _, _) = host
            .request(
                "PATCH",
                &format!("/api/campaigns/{id}"),
                json!({"name":"Forged","description":"","archived":false}),
                Some(cookie),
            )
            .await;
        assert_eq!(status, StatusCode::FORBIDDEN);
    }
    let (_, other, _) = host
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Secret campaign"}),
            Some(&owner),
        )
        .await;
    let other_id = other["campaign"]["id"].as_str().unwrap();
    let (status, _, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{other_id}"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _, _) = host
        .request(
            "POST",
            &format!("/api/campaigns/{id}/members/{bob_id}/revoke"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}/scenes"),
            json!({}),
            Some(&bob),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn expired_revoked_and_reused_invites_fail_without_creating_users() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    for mode in ["expired", "revoked", "used"] {
        let invite = host.invite(&owner, &id).await;
        let statement = match mode {
            "expired" => "UPDATE invites SET expires_at=1 WHERE id=?",
            "revoked" => "UPDATE invites SET revoked_at=1 WHERE id=?",
            _ => "UPDATE invites SET used_at=1 WHERE id=?",
        };
        sqlx::query(statement)
            .bind(invite["id"].as_str().unwrap())
            .execute(&host.state.store.pool)
            .await
            .unwrap();
        let (status,_,_)=host.request("POST","/api/invites/redeem",json!({"code":invite["code"],"username":"intruder","displayName":"Intruder","password":"a long player password"}),None).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    }
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&host.state.store.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

include!("cases/dice.rs");

include!("cases/journals.rs");

include!("cases/chat.rs");

include!("cases/combat.rs");

include!("cases/drawings.rs");

include!("cases/scene_notes.rs");

include!("cases/token_vitals.rs");
