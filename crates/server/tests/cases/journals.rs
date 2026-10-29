fn journal_create(id: &str, title: &str, body: &str) -> Value {
    json!({"type":"journal.create","payload":{"journalId":id,"title":title,"body":body}})
}
fn journal_update(id: &str, version: i64, visibility: &str, body: &str) -> Value {
    json!({"type":"journal.update","payload":{"journalId":id,"expectedVersion":version,"title":"Clue","body":body,"visibility":visibility}})
}
#[tokio::test]
async fn journals_private_sharing_conflicts_receipts_and_deletion_are_authoritative() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &camp, "alice").await;
    let (bob, _) = h.player(&owner, &camp, "bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let id = uuid::Uuid::new_v4().to_string();
    let request = uuid::Uuid::new_v4().to_string();
    let create = journal_create(&id, "Secret clue", "HIDDEN JOURNAL DRAFT");
    assert_eq!(
        command(&mut dm, &request, 0, create.clone()).await["kind"],
        "ack"
    );
    assert_eq!(
        command(&mut dm, &request, 0, create).await["duplicate"],
        true
    );
    for socket in [&mut a, &mut b] {
        let snapshot = through(socket, 1).await;
        assert!(!snapshot.to_string().contains("HIDDEN JOURNAL DRAFT"));
        assert!(!snapshot.to_string().contains(&id));
    }
    let hidden = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/journals/{id}"),
            json!({}),
            Some(&alice),
        )
        .await;
    let unknown = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/journals/{}", uuid::Uuid::new_v4()),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!((hidden.0, hidden.1), (unknown.0, unknown.1));
    let mut rev = 1;
    accepted(
        &mut dm,
        &mut rev,
        journal_update(&id, 1, "shared", "<script>literal()</script>\nShared clue"),
    )
    .await;
    for socket in [&mut a, &mut b] {
        let snapshot = through(socket, rev).await;
        let page = snapshot["journals"]
            .as_array()
            .unwrap()
            .iter()
            .find(|p| p["id"] == id)
            .unwrap();
        assert_eq!(page["version"], 2);
        assert_eq!(page["body"], "<script>literal()</script>\nShared clue");
        assert!(!snapshot.to_string().contains("HIDDEN JOURNAL DRAFT"));
    }
    let stale = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        journal_update(&id, 1, "dm", "overwrite"),
    )
    .await;
    assert_eq!(stale["error"]["code"], "STALE_JOURNAL");
    let denied = command(
        &mut a,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        journal_update(&id, 2, "dm", "attacker"),
    )
    .await;
    assert_eq!(denied["error"]["code"], "FORBIDDEN");
    accepted(
        &mut dm,
        &mut rev,
        journal_update(&id, 2, "dm", "NEW PRIVATE TEXT"),
    )
    .await;
    for socket in [&mut a, &mut b] {
        let snapshot = through(socket, rev).await;
        assert!(!snapshot.to_string().contains(&id));
        assert!(!snapshot.to_string().contains("NEW PRIVATE TEXT"));
    }
    let events: Vec<String> =
        sqlx::query_scalar("SELECT payload FROM campaign_events WHERE campaign_id=?")
            .bind(&camp)
            .fetch_all(&h.state.store.pool)
            .await
            .unwrap();
    assert!(events.iter().all(|e| !e.contains("PRIVATE TEXT")
        && !e.contains("JOURNAL DRAFT")
        && !e.contains("literal()")));
    let delete = json!({"type":"journal.delete","payload":{"journalId":id,"expectedVersion":3}});
    accepted(&mut dm, &mut rev, delete).await;
    let (_, pages, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/journals"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert!(!pages.to_string().contains(&id));
    for socket in [&mut dm, &mut a, &mut b] {
        socket.close(None).await.unwrap();
    }
}
#[tokio::test]
async fn journals_validate_limits_foreign_ids_archive_and_persist() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (_, foreign, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Elsewhere","description":""}),
            Some(&owner),
        )
        .await;
    let foreign = foreign["campaign"]["id"].as_str().unwrap();
    let foreign_id: String =
        sqlx::query_scalar("SELECT id FROM journals WHERE campaign_id=? LIMIT 1")
            .bind(foreign)
            .fetch_optional(&h.state.store.pool)
            .await
            .unwrap()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES(?,?,'Foreign','Private','dm',1) ON CONFLICT(id) DO NOTHING")
        .bind(&foreign_id).bind(foreign).execute(&h.state.store.pool).await.unwrap();
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut rev = 0;
    for (title, body) in [
        (" ".to_owned(), "ok".to_owned()),
        ("x".repeat(81), "ok".into()),
        ("ok".into(), "x".repeat(1001)),
        ("ok".into(), "bad\u{0000}".into()),
    ] {
        let reply = command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            journal_create(&uuid::Uuid::new_v4().to_string(), &title, &body),
        )
        .await;
        assert_eq!(reply["error"]["code"], "VALIDATION_FAILED", "{reply}");
    }
    let unknown = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        journal_update(&uuid::Uuid::new_v4().to_string(), 1, "dm", "x"),
    )
    .await;
    let foreign = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        journal_update(&foreign_id, 1, "dm", "x"),
    )
    .await;
    assert_eq!(unknown["error"], foreign["error"]);
    // This fixture exercises more than20 commands; reconnect rather than weakening the host's frame limit.
    dm.close(None).await.unwrap();
    dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journals WHERE campaign_id=?")
        .bind(&camp)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    let mut kept = String::new();
    for _ in count..16 {
        kept = uuid::Uuid::new_v4().to_string();
        accepted(
            &mut dm,
            &mut rev,
            journal_create(&kept, &"界".repeat(80), &"🧙".repeat(1000)),
        )
        .await;
    }
    let extra = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        journal_create(&uuid::Uuid::new_v4().to_string(), "Extra", ""),
    )
    .await;
    assert_eq!(extra["error"]["code"], "VALIDATION_FAILED");
    sqlx::query("UPDATE campaigns SET archived=1 WHERE id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    let archived = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        journal_update(&kept, 1, "shared", "wrong"),
    )
    .await;
    assert_eq!(archived["error"]["code"], "FORBIDDEN");
    dm.close(None).await.unwrap();
    h.state.shutdown();
    drop(server);
    let root = h._dir.path().to_owned();
    let Host { app, state, _dir } = h;
    drop(app);
    state.store.pool.close().await;
    drop(state);
    let mut opened = None;
    for _ in 0..40 {
        match hearth_storage::Store::open(&root).await {
            Ok(s) => {
                opened = Some(s);
                break;
            }
            Err(_) => tokio::time::sleep(std::time::Duration::from_millis(25)).await,
        }
    }
    let store = opened.expect("Host lock released");
    let (body, version): (String, i64) =
        sqlx::query_as("SELECT body,version FROM journals WHERE id=?")
            .bind(kept)
            .fetch_one(&store.pool)
            .await
            .unwrap();
    assert_eq!(body, "🧙".repeat(1000));
    assert_eq!(version, 1);
    store.pool.close().await;
}

#[tokio::test]
async fn journal_images_require_campaign_assets_and_current_shared_page_authority() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &camp, "image_alice").await;
    let (bob, _) = h.player(&owner, &camp, "image_bob").await;
    let (status, uploaded) = upload_image(&h, &owner, &camp, map_fixture(), "image/png").await;
    assert_eq!(status, StatusCode::OK);
    let art = uploaded["asset"]["id"].as_str().unwrap();
    let url = format!("/api/campaigns/{camp}/assets/{art}");
    assert_eq!(
        h.request("GET", &url, json!({}), Some(&alice)).await.0,
        StatusCode::NOT_FOUND
    );
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let id = uuid::Uuid::new_v4().to_string();
    let create = json!({"type":"journal.create","payload":{"journalId":id,"title":"Secret image","body":"Literal clue","assetId":art}});
    let mut rev = 0;
    accepted(&mut dm, &mut rev, create).await;
    for socket in [&mut a, &mut b] {
        let projection = through(socket, rev).await.to_string();
        assert!(!projection.contains(art));
        assert!(!projection.contains(&id));
    }
    let update = |version, visibility, image: Option<&str>| json!({"type":"journal.update","payload":{"journalId":id,"expectedVersion":version,"title":"Secret image","body":"Literal clue","visibility":visibility,"assetId":image}});
    let denied = command(
        &mut a,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        update(1, "shared", Some(art)),
    )
    .await;
    assert_eq!(denied["error"]["code"], "FORBIDDEN");
    accepted(&mut dm, &mut rev, update(1, "shared", Some(art))).await;
    for socket in [&mut a, &mut b] {
        let projection = through(socket, rev).await;
        assert!(
            projection["journals"]
                .as_array()
                .unwrap()
                .iter()
                .any(|j| j["id"] == id && j["assetId"] == art)
        );
    }
    for cookie in [&alice, &bob] {
        let request = Request::builder()
            .uri(&url)
            .header("host", "localhost:8787")
            .header("cookie", cookie)
            .body(Body::empty())
            .unwrap();
        let response = h.app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert!(
            response.headers()["cache-control"]
                .to_str()
                .unwrap()
                .contains("no-store")
        );
    }
    let stale = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        update(1, "dm", None),
    )
    .await;
    assert_eq!(stale["error"]["code"], "STALE_JOURNAL");
    accepted(&mut dm, &mut rev, update(2, "dm", Some(art))).await;
    for socket in [&mut a, &mut b] {
        assert!(!through(socket, rev).await.to_string().contains(art));
    }
    assert_eq!(
        h.request("GET", &url, json!({}), Some(&bob)).await.0,
        StatusCode::NOT_FOUND
    );
    let (_, other, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Foreign","description":""}),
            Some(&owner),
        )
        .await;
    let foreign = other["campaign"]["id"].as_str().unwrap();
    let (_, foreign_art) = upload_image(&h, &owner, foreign, map_fixture(), "image/png").await;
    for invalid in [
        foreign_art["asset"]["id"].as_str().unwrap().to_owned(),
        uuid::Uuid::new_v4().to_string(),
        "amber-map".to_owned(),
    ] {
        let rejected = command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            update(3, "dm", Some(&invalid)),
        )
        .await;
        assert_eq!(rejected["error"]["code"], "NOT_FOUND_OR_HIDDEN");
    }
    let saved: Option<String> = sqlx::query_scalar("SELECT asset_id FROM journals WHERE id=?")
        .bind(&id)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(saved.as_deref(), Some(art));
    accepted(&mut dm, &mut rev, update(3, "dm", None)).await;
    let (_, pages, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/journals"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert!(!pages.to_string().contains(art));
    for socket in [&mut dm, &mut a, &mut b] {
        socket.close(None).await.unwrap();
    }
}

#[tokio::test]
async fn replacing_shared_handouts_requires_private_save_and_independent_grants_remain() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, alice_id) = h.player(&owner, &camp, "handout_reader").await;
    let (_, first) = upload_image(&h, &owner, &camp, map_fixture(), "image/png").await;
    let (_, second) = upload_image(
        &h,
        &owner,
        &camp,
        include_bytes!("../../../../content/examples/amber-keep/warden.png").to_vec(),
        "image/png",
    )
    .await;
    let art = first["asset"]["id"].as_str().unwrap();
    let replacement = second["asset"]["id"].as_str().unwrap();
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut rev = 0;
    let id = uuid::Uuid::new_v4().to_string();
    let other = uuid::Uuid::new_v4().to_string();
    let update = |page: &str, version, visibility, image| json!({"type":"journal.update","payload":{"journalId":page,"expectedVersion":version,"title":"Handout","body":"","visibility":visibility,"assetId":image}});
    for page in [&id, &other] {
        accepted(&mut dm,&mut rev,json!({"type":"journal.create","payload":{"journalId":page,"title":"Handout","body":"","assetId":art}})).await;
        accepted(&mut dm, &mut rev, update(page, 1, "shared", art)).await;
    }
    let denied = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        update(&id, 2, "shared", replacement),
    )
    .await;
    assert_eq!(denied["error"]["code"], "VALIDATION_FAILED");
    accepted(&mut dm, &mut rev, update(&id, 2, "dm", replacement)).await;
    let url = format!("/api/campaigns/{camp}/assets/{art}");
    let replacement_url = format!("/api/campaigns/{camp}/assets/{replacement}");
    assert_eq!(
        h.request("GET", &url, json!({}), Some(&alice)).await.0,
        StatusCode::OK
    );
    assert_eq!(
        h.request("GET", &replacement_url, json!({}), Some(&alice))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"journal.delete","payload":{"journalId":other,"expectedVersion":2}}),
    )
    .await;
    assert_eq!(
        h.request("GET", &url, json!({}), Some(&alice)).await.0,
        StatusCode::NOT_FOUND
    );
    accepted(&mut dm, &mut rev, update(&id, 3, "shared", replacement)).await;
    assert_eq!(
        h.request("GET", &replacement_url, json!({}), Some(&alice))
            .await
            .0,
        StatusCode::OK
    );
    let request_id = uuid::Uuid::new_v4().to_string();
    let hide = update(&id, 4, "dm", replacement);
    assert_eq!(
        command(&mut dm, &request_id, rev, hide.clone()).await["kind"],
        "ack"
    );
    assert_eq!(
        command(&mut dm, &request_id, rev, hide).await["duplicate"],
        true
    );
    rev += 1;
    accepted(&mut dm, &mut rev, update(&id, 5, "shared", replacement)).await;
    h.request(
        "POST",
        &format!("/api/campaigns/{camp}/members/{alice_id}/revoke"),
        json!({}),
        Some(&owner),
    )
    .await;
    assert_ne!(
        h.request("GET", &replacement_url, json!({}), Some(&alice))
            .await
            .0,
        StatusCode::OK
    );
    dm.close(None).await.unwrap();
}

#[tokio::test]
async fn text_only_journal_updates_preserve_images_until_explicit_removal() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (_, uploaded) = upload_image(&h, &owner, &camp, map_fixture(), "image/png").await;
    let art = uploaded["asset"]["id"].as_str().unwrap();
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let id = uuid::Uuid::new_v4().to_string();
    let mut rev = 0;
    accepted(&mut dm,&mut rev,json!({"type":"journal.create","payload":{"journalId":id,"title":"Clue","body":"","assetId":art}})).await;
    let request = uuid::Uuid::new_v4().to_string();
    let original = journal_update(&id, 1, "dm", "Text-only edit");
    assert_eq!(
        command(&mut dm, &request, rev, original.clone()).await["kind"],
        "ack"
    );
    let mut different = original;
    different["payload"]["assetId"] = Value::Null;
    let reply = command(&mut dm, &request, rev, different).await;
    assert_eq!(reply["error"]["code"], "REQUEST_ID_REUSED");
    rev += 1;
    let image: Option<String> = sqlx::query_scalar("SELECT asset_id FROM journals WHERE id=?")
        .bind(&id)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(image.as_deref(), Some(art));
    accepted(&mut dm,&mut rev,json!({"type":"journal.update","payload":{"journalId":id,"expectedVersion":2,"title":"Clue","body":"Text-only edit","visibility":"dm","assetId":null}})).await;
    let image: Option<String> = sqlx::query_scalar("SELECT asset_id FROM journals WHERE id=?")
        .bind(&id)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert!(image.is_none());
    dm.close(None).await.unwrap();
}

#[tokio::test]
async fn selected_journal_readers_control_pages_images_and_live_projections() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, alice_id) = h.player(&owner, &camp, "select_alice").await;
    let (bob, bob_id) = h.player(&owner, &camp, "select_bob").await;
    let (_, uploaded) = upload_image(&h, &owner, &camp, map_fixture(), "image/png").await;
    let art = uploaded["asset"]["id"].as_str().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let mut rev = 0;
    accepted(&mut dm,&mut rev,json!({"type":"journal.create","payload":{"journalId":id,"title":"Only Alice","body":"PRIVATE SELECTED CLUE","assetId":art}})).await;
    let update = |version, scope, readers: Vec<String>| json!({"type":"journal.update","payload":{"journalId":id,"expectedVersion":version,"title":"Only Alice","body":"PRIVATE SELECTED CLUE","assetId":art,"visibility":scope,"recipientIds":readers}});
    accepted(
        &mut dm,
        &mut rev,
        update(1, "selected", vec![alice_id.clone()]),
    )
    .await;
    let ap = through(&mut a, rev).await;
    let bp = through(&mut b, rev).await;
    let page = ap["journals"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"] == id)
        .unwrap();
    assert_eq!(page["assetId"], art);
    assert_eq!(page["visibility"], "shared");
    assert!(page.get("recipientIds").is_none());
    assert!(!bp.to_string().contains(&id));
    assert!(!bp.to_string().contains(art));
    assert!(!bp.to_string().contains("PRIVATE SELECTED CLUE"));
    let page_url = format!("/api/campaigns/{camp}/journals/{id}");
    let image_url = format!("/api/campaigns/{camp}/assets/{art}");
    for url in [&page_url, &image_url] {
        assert_eq!(
            h.request("GET", url, json!({}), Some(&alice)).await.0,
            StatusCode::OK
        );
        assert_eq!(
            h.request("GET", url, json!({}), Some(&bob)).await.0,
            StatusCode::NOT_FOUND
        );
    }
    let (_, projected, _) = h.request("GET", &page_url, json!({}), Some(&owner)).await;
    assert_eq!(projected["journal"]["visibility"], "selected");
    assert_eq!(projected["journal"]["recipientIds"], json!([alice_id]));
    let forged = command(
        &mut b,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        update(2, "selected", vec![bob_id.clone()]),
    )
    .await;
    assert_eq!(forged["error"]["code"], "FORBIDDEN");
    for (scope, ids) in [
        ("selected", vec![]),
        ("selected", vec![alice_id.clone(), alice_id.clone()]),
        ("selected", vec![uuid::Uuid::new_v4().to_string()]),
        ("shared", vec![alice_id.clone()]),
        ("dm", vec![bob_id.clone()]),
        ("selected", vec![alice_id.clone(); 9]),
    ] {
        let denied = command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            update(2, scope, ids),
        )
        .await;
        assert_eq!(denied["error"]["code"], "VALIDATION_FAILED");
    }
    accepted(&mut dm, &mut rev, update(2, "shared", vec![])).await;
    assert!(through(&mut b, rev).await.to_string().contains(&id));
    accepted(
        &mut dm,
        &mut rev,
        update(3, "selected", vec![alice_id.clone()]),
    )
    .await;
    assert!(!through(&mut b, rev).await.to_string().contains(&id));
    assert_eq!(
        h.request("GET", &image_url, json!({}), Some(&bob)).await.0,
        StatusCode::NOT_FOUND
    );
    let stale = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        update(3, "shared", vec![]),
    )
    .await;
    assert_eq!(stale["error"]["code"], "STALE_JOURNAL");
    accepted(&mut dm, &mut rev, update(4, "dm", vec![])).await;
    assert_eq!(
        h.request("GET", &page_url, json!({}), Some(&alice)).await.0,
        StatusCode::NOT_FOUND
    );
    accepted(
        &mut dm,
        &mut rev,
        update(5, "selected", vec![alice_id.clone()]),
    )
    .await;
    h.request(
        "POST",
        &format!("/api/campaigns/{camp}/members/{alice_id}/revoke"),
        json!({}),
        Some(&owner),
    )
    .await;
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_recipients WHERE journal_id=?")
            .bind(&id)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap();
    assert_eq!(count, 0);
    let rejected = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        update(6, "selected", vec![alice_id]),
    )
    .await;
    assert_eq!(rejected["error"]["code"], "VALIDATION_FAILED");
    for socket in [&mut dm, &mut b] {
        socket.close(None).await.unwrap();
    }
}

#[tokio::test]
async fn selected_image_replacement_stays_private_and_rejects_foreign_or_gm_readers() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, reader) = h.player(&owner, &camp, "selected_reader").await;
    let owner_id: String = sqlx::query_scalar("SELECT id FROM users WHERE is_owner=1")
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    let (_, foreign, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Elsewhere","description":""}),
            Some(&owner),
        )
        .await;
    let (_, outsider) = h
        .player(
            &owner,
            foreign["campaign"]["id"].as_str().unwrap(),
            "outsider_reader",
        )
        .await;
    let (_, uploaded) = upload_image(&h, &owner, &camp, map_fixture(), "image/png").await;
    let first = uploaded["asset"]["id"].as_str().unwrap();
    let (_, uploaded) = upload_image(
        &h,
        &owner,
        &camp,
        include_bytes!("../../../../content/examples/amber-keep/warden.png").to_vec(),
        "image/png",
    )
    .await;
    let second = uploaded["asset"]["id"].as_str().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut rev = 0;
    accepted(&mut dm,&mut rev,json!({"type":"journal.create","payload":{"journalId":id,"title":"Secret","body":"","assetId":first}})).await;
    let update = |version, scope, image, ids| json!({"type":"journal.update","payload":{"journalId":id,"expectedVersion":version,"title":"Secret","body":"","assetId":image,"visibility":scope,"recipientIds":ids}});
    for bad in [owner_id, outsider] {
        let denied = command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            update(1, "selected", first, vec![bad]),
        )
        .await;
        assert_eq!(denied["error"]["code"], "VALIDATION_FAILED");
    }
    accepted(
        &mut dm,
        &mut rev,
        update(1, "selected", first, vec![reader.clone()]),
    )
    .await;
    let denied = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        update(2, "selected", second, vec![reader]),
    )
    .await;
    assert_eq!(denied["error"]["code"], "VALIDATION_FAILED");
    accepted(&mut dm, &mut rev, update(2, "dm", second, vec![])).await;
    for image in [first, second] {
        assert_eq!(
            h.request(
                "GET",
                &format!("/api/campaigns/{camp}/assets/{image}"),
                json!({}),
                Some(&alice)
            )
            .await
            .0,
            StatusCode::NOT_FOUND
        );
    }
    dm.close(None).await.unwrap();
}

#[tokio::test]
async fn journal_format_is_explicit_persisted_and_preserved_by_sharing_updates() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, reader) = h.player(&owner, &camp, "format_alice").await;
    let (bob, _) = h.player(&owner, &camp, "format_bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut rev = 0;
    let id = uuid::Uuid::new_v4().to_string();
    let body = "# Clue\n**Bold** and *emphasis*\n<script>literal()</script>\n![external](https://example.invalid/pixel)";
    accepted(&mut dm,&mut rev,json!({"type":"journal.create","payload":{"journalId":id,"title":"Formatted clue","body":body,"bodyFormat":"markdown"}})).await;
    let page_url = format!("/api/campaigns/{camp}/journals/{id}");
    assert_eq!(
        h.request("GET", &page_url, json!({}), Some(&alice)).await.0,
        StatusCode::NOT_FOUND
    );
    accepted(&mut dm,&mut rev,json!({"type":"journal.update","payload":{"journalId":id,"expectedVersion":1,"title":"Formatted clue","body":body,"visibility":"selected","recipientIds":[reader]}})).await;
    let (_, page, _) = h.request("GET", &page_url, json!({}), Some(&alice)).await;
    assert_eq!(page["journal"]["bodyFormat"], "markdown");
    assert_eq!(page["journal"]["body"], body);
    assert_eq!(
        h.request("GET", &page_url, json!({}), Some(&bob)).await.0,
        StatusCode::NOT_FOUND
    );
    for bad in [json!("html"), Value::Null, json!(37)] {
        let invalid=command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,json!({"type":"journal.update","payload":{"journalId":id,"expectedVersion":2,"title":"Formatted clue","body":body,"visibility":"dm","bodyFormat":bad}})).await;
        assert_eq!(invalid["kind"], "error");
    }
    accepted(&mut dm,&mut rev,json!({"type":"journal.update","payload":{"journalId":id,"expectedVersion":2,"title":"Formatted clue","body":body,"bodyFormat":"plain","visibility":"dm"}})).await;
    let saved: (String, String) =
        sqlx::query_as("SELECT body,body_format FROM journals WHERE id=?")
            .bind(&id)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap();
    assert_eq!(saved, (body.into(), "plain".into()));
    dm.close(None).await.unwrap();
}

fn journal_copy(source: &str, version: i64, target: &str) -> Value {
    json!({"type":"journal.copy","payload":{"sourceJournalId":source,"expectedVersion":version,"journalId":target,"title":"Reused clue"}})
}
#[tokio::test]
async fn journal_reuse_copies_exact_content_privately_without_grants_or_source_changes() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, alice_id) = h.player(&owner, &camp, "reuse_alice").await;
    let (bob, _) = h.player(&owner, &camp, "reuse_bob").await;
    let (_, uploaded) = upload_image(&h, &owner, &camp, map_fixture(), "image/png").await;
    let art = uploaded["asset"]["id"].as_str().unwrap();
    let url = format!("/api/campaigns/{camp}/assets/{art}");
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let source = uuid::Uuid::new_v4().to_string();
    let target = uuid::Uuid::new_v4().to_string();
    let folder = uuid::Uuid::new_v4().to_string();
    let body = "# 🧙 Template\n**Exact**\n<script>literal</script>";
    let mut rev = 0;
    accepted(&mut dm, &mut rev, json!({"type":"journal.folder.create","payload":{"folderId":folder,"name":"Templates","parentId":null}})).await;
    accepted(&mut dm, &mut rev, json!({"type":"journal.create","payload":{"journalId":source,"title":"Template","body":body,"bodyFormat":"markdown","assetId":art,"folderId":folder}})).await;
    accepted(&mut dm, &mut rev, json!({"type":"journal.update","payload":{"journalId":source,"expectedVersion":1,"title":"Template","body":body,"visibility":"selected","recipientIds":[alice_id]}})).await;
    let request = uuid::Uuid::new_v4().to_string();
    let copy = journal_copy(&source, 2, &target);
    assert_eq!(command(&mut dm, &request, rev, copy.clone()).await["kind"], "ack");
    assert_eq!(command(&mut dm, &request, rev, copy.clone()).await["duplicate"], true);
    rev += 1;
    let projection = through(&mut a, rev).await;
    assert!(!projection.to_string().contains(&target));
    let (_, pages, _) = h.request("GET", &format!("/api/campaigns/{camp}/journals"), json!({}), Some(&owner)).await;
    let pages = pages["journals"].as_array().unwrap();
    let copied = pages.iter().find(|j| j["id"] == target).unwrap();
    assert_eq!(copied["body"], body);
    assert_eq!(copied["bodyFormat"], "markdown");
    assert_eq!(copied["assetId"], art);
    assert_eq!(copied["visibility"], "dm");
    assert_eq!(copied["version"], 1);
    assert!(copied.get("recipientIds").is_none());
    assert!(copied.get("folderId").is_none());
    let original = pages.iter().find(|j| j["id"] == source).unwrap();
    assert_eq!(original["version"], 2);
    assert_eq!(original["folderId"], folder);
    assert_eq!(original["recipientIds"], json!([alice_id]));
    for player in [&alice, &bob] {
        assert_eq!(h.request("GET", &format!("/api/campaigns/{camp}/journals/{target}"), json!({}), Some(player)).await.0, StatusCode::NOT_FOUND);
    }
    let denied = command(&mut a, &uuid::Uuid::new_v4().to_string(), rev, journal_copy(&source, 2, &uuid::Uuid::new_v4().to_string())).await;
    assert_eq!(denied["error"]["code"], "FORBIDDEN");
    // Copying does not revoke an existing image entitlement from another page.
    assert_eq!(h.request("GET", &url, json!({}), Some(&alice)).await.0, StatusCode::OK);
    assert_eq!(h.request("GET", &url, json!({}), Some(&bob)).await.0, StatusCode::NOT_FOUND);
    accepted(&mut dm, &mut rev, journal_update(&target, 1, "shared", "Independent copy")).await;
    accepted(&mut dm, &mut rev, journal_update(&source, 2, "dm", body)).await;
    assert_eq!(h.request("GET", &url, json!({}), Some(&bob)).await.0, StatusCode::OK);
    accepted(&mut dm, &mut rev, journal_update(&target, 2, "dm", "Independent copy")).await;
    assert_eq!(h.request("GET", &url, json!({}), Some(&alice)).await.0, StatusCode::NOT_FOUND);
    let (_, original, _) = h.request("GET", &format!("/api/campaigns/{camp}/journals/{source}"), json!({}), Some(&owner)).await;
    assert_eq!(original["journal"]["body"], body);
    dm.close(None).await.unwrap();
    a.close(None).await.unwrap();
}

#[tokio::test]
async fn journal_reuse_rejects_stale_foreign_occupied_full_and_archived_destinations() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (_, foreign, _) = h.request("POST", "/api/campaigns", json!({"name":"Foreign reuse","description":""}), Some(&owner)).await;
    let foreign = foreign["campaign"]["id"].as_str().unwrap();
    let source = uuid::Uuid::new_v4().to_string();
    let elsewhere = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES(?,?,'Foreign','Secret','dm',1)").bind(&elsewhere).bind(foreign).execute(&h.state.store.pool).await.unwrap();
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut rev = 0;
    accepted(&mut dm, &mut rev, journal_create(&source, "Plain source", "Literal **plain**")).await;
    for (source_id, version, target, code) in [
        (source.clone(), 2, uuid::Uuid::new_v4().to_string(), "STALE_JOURNAL"),
        (source.clone(), 0, uuid::Uuid::new_v4().to_string(), "VALIDATION_FAILED"),
        (source.clone(), 1, source.clone(), "VALIDATION_FAILED"),
        (source.clone(), 1, elsewhere.clone(), "VALIDATION_FAILED"),
        ("bad".into(), 1, uuid::Uuid::new_v4().to_string(), "VALIDATION_FAILED"),
    ] {
        let reply = command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, journal_copy(&source_id, version, &target)).await;
        assert_eq!(reply["error"]["code"], code, "{reply}");
    }
    let foreign_reply = command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, journal_copy(&elsewhere, 1, &uuid::Uuid::new_v4().to_string())).await;
    let unknown = command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, journal_copy(&uuid::Uuid::new_v4().to_string(), 1, &uuid::Uuid::new_v4().to_string())).await;
    assert_eq!(foreign_reply["error"], unknown["error"]);
    let plain_target = uuid::Uuid::new_v4().to_string();
    accepted(&mut dm, &mut rev, journal_copy(&source, 1, &plain_target)).await;
    let plain: (String, String) = sqlx::query_as("SELECT body,body_format FROM journals WHERE id=?").bind(&plain_target).fetch_one(&h.state.store.pool).await.unwrap();
    assert_eq!(plain, ("Literal **plain**".into(), "plain".into()));
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journals WHERE campaign_id=?").bind(&camp).fetch_one(&h.state.store.pool).await.unwrap();
    for _ in count..16 {
        sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES(?,?,'Quota','','dm',1)").bind(uuid::Uuid::new_v4().to_string()).bind(&camp).execute(&h.state.store.pool).await.unwrap();
    }
    let full = command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, journal_copy(&source, 1, &uuid::Uuid::new_v4().to_string())).await;
    assert_eq!(full["error"]["code"], "VALIDATION_FAILED");
    sqlx::query("UPDATE campaigns SET archived=1 WHERE id=?").bind(&camp).execute(&h.state.store.pool).await.unwrap();
    let archived = command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, journal_copy(&source, 1, &uuid::Uuid::new_v4().to_string())).await;
    assert_eq!(archived["error"]["code"], "FORBIDDEN");
    sqlx::query("UPDATE campaigns SET archived=0 WHERE id=?").bind(&camp).execute(&h.state.store.pool).await.unwrap();
    sqlx::query("DELETE FROM memberships WHERE campaign_id=?").bind(&camp).execute(&h.state.store.pool).await.unwrap();
    // Revoked connections are closed by the live loop before a command reply.
    let denied_target = uuid::Uuid::new_v4().to_string();
    let denied_request = uuid::Uuid::new_v4().to_string();
    let sent = dm.send(Message::Text(json!({"kind":"command","schemaVersion":1,"requestId":denied_request,"baseRevision":rev,"command":journal_copy(&source, 1, &denied_target)}).to_string().into())).await;
    if sent.is_ok() {
        loop {
            match tokio::time::timeout(std::time::Duration::from_secs(4), dm.next()).await.unwrap() {
                None | Some(Err(_)) | Some(Ok(Message::Close(_))) => break,
                Some(Ok(Message::Text(text))) => {
                    let frame: Value = serde_json::from_str(&text).unwrap();
                    assert!(!(frame["kind"] == "ack" && frame["requestId"] == denied_request));
                }
                _ => {}
            }
        }
    }
    let copied: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journals WHERE id=?").bind(&denied_target).fetch_one(&h.state.store.pool).await.unwrap();
    assert_eq!(copied, 0);
}
