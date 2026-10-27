#[tokio::test]
async fn concurrent_initial_setup_yields_one_owner() {
    let host = Host::new().await;
    let body = json!({"username":"owner","displayName":"Žofia Černá","password":"a long strong password","createDemo":false});
    let (a, b) = tokio::join!(
        host.request("POST", "/api/setup/owner", body.clone(), None),
        host.request("POST", "/api/setup/owner", body, None)
    );
    let mut statuses = [a.0.as_u16(), b.0.as_u16()];
    statuses.sort();
    assert_eq!(statuses, [200, 409]);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_owner=1")
        .fetch_one(&host.state.store.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn concurrent_redemption_consumes_invitation_once() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let invite = host.invite(&owner, &id).await;
    let a = json!({"code":invite["code"],"username":"alice","displayName":"Alice","password":"a long player password"});
    let b = json!({"code":invite["code"],"username":"bob","displayName":"Bob","password":"a long player password"});
    let (a, b) = tokio::join!(
        host.request("POST", "/api/invites/redeem", a, None),
        host.request("POST", "/api/invites/redeem", b, None)
    );
    let mut statuses = [a.0.as_u16(), b.0.as_u16()];
    statuses.sort();
    assert_eq!(statuses, [200, 422]);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&host.state.store.pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
}

#[tokio::test]
async fn persistence_and_expired_session_survive_router_restart() {
    let mut host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let config = (*host.state.config).clone();
    host.state.store.pool.close().await;
    drop(host.app);
    drop(host.state);
    let state = AppState::new(config).await.unwrap();
    host.app = hearth_server::router(state.clone());
    host.state = state;
    let (status, body, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["campaign"]["name"], "The Amber Keep");
    sqlx::query("UPDATE device_sessions SET expires_at=1")
        .execute(&host.state.store.pool)
        .await
        .unwrap();
    let (status, _, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (status, _, cookie) = host
        .request(
            "POST",
            "/api/auth/login",
            json!({"username":"GAMEMASTER","password":"a long strong password"}),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(cookie.is_some());
    let (status, _, _) = host
        .request(
            "POST",
            "/api/auth/login",
            json!({"username":"gamemaster","password":"wrong password"}),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn invalid_credentials_role_claim_and_auth_rate_limit_are_bounded() {
    let host = Host::new().await;
    let (status, _, _) = host
        .request(
            "POST",
            "/api/setup/owner",
            json!({"username":"x","displayName":"Name","password":"short"}),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let (status,_,_)=host.request("POST","/api/setup/owner",json!({"username":"owner","displayName":"Name","password":"a long strong password","role":"dm"}),None).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    for _ in 0..8 {
        let (status, _, _) = host
            .request(
                "POST",
                "/api/auth/login",
                json!({"username":"x","password":"x".repeat(129)}),
                None,
            )
            .await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    }
    let (status, _, _) = host
        .request(
            "POST",
            "/api/auth/login",
            json!({"username":"x","password":"x".repeat(129)}),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
}

#[tokio::test]
async fn rebinding_missing_csrf_header_and_oversized_payload_are_denied() {
    let host = Host::new().await;
    for (origin, host_header, marker, expected) in [
        (
            "http://localhost:8787",
            "evil.example",
            Some("1"),
            StatusCode::FORBIDDEN,
        ),
        (
            "http://localhost:8787",
            "localhost:8787",
            None,
            StatusCode::FORBIDDEN,
        ),
        (
            "http://localhost:8787",
            "localhost:8787",
            Some("1"),
            StatusCode::PAYLOAD_TOO_LARGE,
        ),
    ] {
        let mut request = Request::builder()
            .method("POST")
            .uri("/api/setup/owner")
            .header("host", host_header)
            .header("origin", origin)
            .header("content-type", "application/json");
        if let Some(marker) = marker {
            request = request.header("x-hearth-request", marker);
        }
        let response = host
            .app
            .clone()
            .oneshot(request.body(Body::from("x".repeat(17000))).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), expected);
    }
}
