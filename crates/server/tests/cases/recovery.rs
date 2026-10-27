async fn recovery_raw(
    h: &Host,
    method: &str,
    path: &str,
    body: Vec<u8>,
    cookie: Option<&str>,
    length: Option<u64>,
) -> axum::response::Response {
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header(header::HOST, "localhost:8787")
        .header(header::ORIGIN, "http://localhost:8787")
        .header("x-hearth-request", "1")
        .header(header::CONTENT_TYPE, "application/octet-stream");
    if let Some(cookie) = cookie {
        request = request.header(header::COOKIE, cookie);
    }
    if let Some(length) = length {
        request = request.header(header::CONTENT_LENGTH, length);
    }
    h.app
        .clone()
        .oneshot(request.body(Body::from(body)).unwrap())
        .await
        .unwrap()
}

#[tokio::test]
async fn host_backups_are_owner_only_even_for_another_campaign_dm() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "recovery_alice").await;
    let (bob, _) = h.player(&owner, &camp, "recovery_bob").await;
    sqlx::query("UPDATE memberships SET role='dm' WHERE user_id=?")
        .bind(aid)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    let random = uuid::Uuid::new_v4();
    for cookie in [None, Some(alice.as_str()), Some(bob.as_str())] {
        let expected = if cookie.is_none() {
            StatusCode::UNAUTHORIZED
        } else {
            StatusCode::FORBIDDEN
        };
        for (method, path) in [
            ("GET", "/api/host/recovery".to_owned()),
            ("POST", "/api/host/backups".to_owned()),
            ("GET", format!("/api/host/backups/{random}")),
            ("POST", "/api/host/restores/verify".to_owned()),
            ("POST", "/api/host/restores".to_owned()),
        ] {
            let response = recovery_raw(&h, method, &path, b"{}".to_vec(), cookie, None).await;
            assert_eq!(response.status(), expected, "{method} {path}");
            let bytes = response.into_body().collect().await.unwrap().to_bytes();
            assert!(!String::from_utf8_lossy(&bytes).contains("Amber Keep"));
        }
    }
    let (status, state, _) = h
        .request("GET", "/api/host/recovery", json!({}), Some(&owner))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(state["prepared"].is_null());
    let (status, backup, _) = h
        .request("POST", "/api/host/backups", json!({}), Some(&owner))
        .await;
    assert_eq!(status, StatusCode::OK, "{backup}");
    let path = format!(
        "/api/host/backups/{}",
        backup["backup"]["id"].as_str().unwrap()
    );
    let response = recovery_raw(&h, "GET", &path, vec![], Some(&owner), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(
        response.headers()[header::CONTENT_DISPOSITION]
            .to_str()
            .unwrap()
            .contains("attachment")
    );
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(&bytes[..8], b"HEARTHB1");
    h.request("POST", "/api/auth/logout", json!({}), Some(&owner))
        .await;
    assert_eq!(
        recovery_raw(&h, "GET", &path, vec![], Some(&owner), None)
            .await
            .status(),
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn browser_backup_verify_restore_preserves_data_but_never_reuses_old_sessions_or_invites() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &camp, "restored_alice").await;
    let (_, metadata, _) = h
        .request("POST", "/api/host/backups", json!({}), Some(&owner))
        .await;
    let id = metadata["backup"]["id"]
        .as_str()
        .expect("A real backup receipt");
    let response = recovery_raw(
        &h,
        "GET",
        &format!("/api/host/backups/{id}"),
        vec![],
        Some(&owner),
        None,
    )
    .await;
    let bytes = response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes()
        .to_vec();
    assert!(bytes.len() > 16384);
    let response = recovery_raw(
        &h,
        "POST",
        "/api/host/restores/verify",
        bytes.clone(),
        Some(&owner),
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let verified: Value =
        serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    let verification = verified["verification"]["id"].clone();
    let (status, receipt, _) = h
        .request(
            "POST",
            "/api/host/restores",
            json!({"verificationId":verification}),
            Some(&owner),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{receipt}");
    assert_eq!(
        h.request(
            "POST",
            "/api/host/restores",
            json!({"verificationId":verification}),
            Some(&owner)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let root = h
        .state
        .config
        .data_dir
        .join("restores")
        .join(receipt["restore"]["directoryName"].as_str().unwrap());
    assert!(root.join("hearth.db").exists());
    let state = AppState::new(Config {
        data_dir: root,
        web_dir: h.state.config.web_dir.clone(),
        ..(*h.state.config).clone()
    })
    .await
    .unwrap();
    let app = hearth_server::router(state.clone());
    let old = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/campaigns/{camp}"))
                .header(header::HOST, "localhost:8787")
                .header(header::COOKIE, &alice)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(old.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM device_sessions")
            .fetch_one(&state.store.pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM invites WHERE used_at IS NULL AND revoked_at IS NULL"
        )
        .fetch_one(&state.store.pool)
        .await
        .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM memberships WHERE campaign_id=?")
            .bind(&camp)
            .fetch_one(&state.store.pool)
            .await
            .unwrap(),
        2
    );
    assert_eq!(
        h.request("GET", "/api/campaigns", json!({}), Some(&owner))
            .await
            .0,
        StatusCode::OK
    );
    state.store.pool.close().await;
}

#[tokio::test]
async fn invalid_backup_upload_and_replaced_verification_cannot_restore_anything() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let response = recovery_raw(
        &h,
        "POST",
        "/api/host/restores/verify",
        b"truncated backup".to_vec(),
        Some(&owner),
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let response = recovery_raw(
        &h,
        "POST",
        "/api/host/restores/verify",
        vec![],
        Some(&owner),
        Some(536870913),
    )
    .await;
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    let (_, metadata, _) = h
        .request("POST", "/api/host/backups", json!({}), Some(&owner))
        .await;
    let path = format!(
        "/api/host/backups/{}",
        metadata["backup"]["id"].as_str().unwrap()
    );
    let bytes = recovery_raw(&h, "GET", &path, vec![], Some(&owner), None)
        .await
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let mut ids = Vec::new();
    for _ in 0..2 {
        let response = recovery_raw(
            &h,
            "POST",
            "/api/host/restores/verify",
            bytes.to_vec(),
            Some(&owner),
            None,
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let result: Value =
            serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        ids.push(result["verification"]["id"].clone());
    }
    assert_eq!(
        h.request(
            "POST",
            "/api/host/restores",
            json!({"verificationId":ids[0]}),
            Some(&owner)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        h.request(
            "POST",
            "/api/host/restores",
            json!({"verificationId":ids[1]}),
            Some(&owner)
        )
        .await
        .0,
        StatusCode::OK
    );
}
#[tokio::test]
async fn interrupted_backup_upload_releases_the_recovery_gate_and_temporary_files() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let reading = std::sync::Arc::new(tokio::sync::Notify::new());
    let signal = reading.clone();
    let stream = futures_util::StreamExt::chain(
        futures_util::stream::once(async move {
            signal.notify_one();
            Ok::<_, std::io::Error>(axum::body::Bytes::from_static(b"HEARTHB1"))
        }),
        futures_util::stream::pending(),
    );
    let req = Request::builder()
        .method("POST")
        .uri("/api/host/restores/verify")
        .header(header::HOST, "localhost:8787")
        .header(header::ORIGIN, "http://localhost:8787")
        .header("x-hearth-request", "1")
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::COOKIE, &owner)
        .body(Body::from_stream(stream))
        .unwrap();
    let work = tokio::spawn(h.app.clone().oneshot(req));
    tokio::time::timeout(std::time::Duration::from_secs(3), reading.notified())
        .await
        .unwrap();
    assert_eq!(
        h.request("POST", "/api/host/backups", json!({}), Some(&owner))
            .await
            .0,
        StatusCode::TOO_MANY_REQUESTS
    );
    work.abort();
    assert!(work.await.unwrap_err().is_cancelled());
    assert_eq!(
        h.request("POST", "/api/host/backups", json!({}), Some(&owner))
            .await
            .0,
        StatusCode::OK
    );
    assert!(
        !std::fs::read_dir(h.state.config.data_dir.join("backups"))
            .unwrap()
            .any(|entry| entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with(".hearth-upload-"))
    );
}
