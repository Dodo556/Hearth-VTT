async fn upload_image(
    host: &Host,
    cookie: &str,
    campaign: &str,
    bytes: Vec<u8>,
    mime: &str,
) -> (StatusCode, Value) {
    let request = Request::builder()
        .method("POST")
        .uri(format!("/api/campaigns/{campaign}/assets"))
        .header("host", "localhost:8787")
        .header("origin", "http://localhost:8787")
        .header("x-hearth-request", "1")
        .header("content-type", mime)
        .header("cookie", cookie)
        .body(Body::from(bytes))
        .unwrap();
    let response = host.app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
fn map_fixture() -> Vec<u8> {
    include_bytes!("../../../../content/examples/amber-keep/map.png").to_vec()
}
#[tokio::test]
async fn image_upload_is_bounded_canonical_and_private_until_a_visible_reference() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let (alice, _) = host.player(&owner, &id, "alice").await;
    assert_eq!(
        upload_image(&host, &alice, &id, map_fixture(), "image/png")
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        upload_image(
            &host,
            &owner,
            &id,
            b"<svg onload='alert(1)'/>".to_vec(),
            "image/svg+xml"
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    assert_eq!(
        upload_image(&host, &owner, &id, map_fixture(), "image/jpeg")
            .await
            .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    assert_eq!(
        upload_image(&host, &owner, &id, b"not a PNG".to_vec(), "image/png")
            .await
            .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    assert_eq!(
        upload_image(
            &host,
            &owner,
            &id,
            vec![0; 8 * 1024 * 1024 + 1],
            "image/png"
        )
        .await
        .0,
        StatusCode::PAYLOAD_TOO_LARGE
    );
    let mut large = std::io::Cursor::new(Vec::new());
    image::DynamicImage::new_rgba8(4097, 1)
        .write_to(&mut large, image::ImageFormat::Png)
        .unwrap();
    assert_eq!(
        upload_image(&host, &owner, &id, large.into_inner(), "image/png")
            .await
            .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    let mut polyglot = map_fixture();
    polyglot.extend_from_slice(b"<script>private-trailing-marker</script>");
    let (status, asset) = upload_image(&host, &owner, &id, polyglot, "image/png").await;
    assert_eq!(status, StatusCode::OK);
    let asset_id = asset["asset"]["id"].as_str().unwrap();
    assert_eq!(asset["asset"]["width"], 1440);
    assert_eq!(asset["asset"]["height"], 960);
    let (status, duplicate) = upload_image(&host, &owner, &id, map_fixture(), "image/png").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(duplicate["asset"]["id"], asset_id);
    let (_, listed, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}/assets"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(listed["assets"].as_array().unwrap().len(), 1);
    assert_eq!(
        host.request(
            "GET",
            &format!("/api/campaigns/{id}/assets/{asset_id}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let request = Request::builder()
        .uri(format!("/api/campaigns/{id}/assets/{asset_id}"))
        .header("host", "localhost:8787")
        .header("cookie", &owner)
        .body(Body::empty())
        .unwrap();
    let response = host.app.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["content-type"], "image/png");
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    assert!(!String::from_utf8_lossy(&bytes).contains("private-trailing-marker"));
}

#[tokio::test]
async fn private_drafts_token_crud_and_active_scene_switch_are_authoritative() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let (alice, alice_id) = host.player(&owner, &id, "alice").await;
    let server = LiveServer::start(&host).await;
    let mut dm = server.connect(&id, &owner).await;
    let initial = frame(&mut dm).await;
    let original = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    assert_eq!(initial["scenes"][0]["active"], true);
    let mut player = server.connect(&id, &alice).await;
    let _ = frame(&mut player).await;
    let (status, uploaded) = upload_image(&host, &owner, &id, map_fixture(), "image/png").await;
    assert_eq!(status, StatusCode::OK);
    let asset = uploaded["asset"]["id"].as_str().unwrap();
    let (_, other, _) = host
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Other world","description":"","createDemo":false}),
            Some(&owner),
        )
        .await;
    let other_id = other["campaign"]["id"].as_str().unwrap();
    let mut other_socket = server.connect(other_id, &owner).await;
    let _ = frame(&mut other_socket).await;
    let denied=command(&mut other_socket,&uuid::Uuid::new_v4().to_string(),0,json!({"type":"scene.create","payload":{"sceneId":uuid::Uuid::new_v4().to_string(),"name":"Cross-world copy","assetId":asset,"gridSize":60}})).await;
    assert_eq!(denied["error"]["code"], "NOT_FOUND_OR_HIDDEN");
    other_socket.close(None).await.unwrap();
    let scene_id = uuid::Uuid::new_v4().to_string();
    let create_id = uuid::Uuid::new_v4().to_string();
    let create = json!({"type":"scene.create","payload":{"sceneId":scene_id,"name":"Secret cavern","assetId":asset,"gridSize":60}});
    assert_eq!(
        command(&mut dm, &create_id, 0, create.clone()).await["revision"],
        1
    );
    assert_eq!(
        command(&mut dm, &create_id, 0, create).await["duplicate"],
        true
    );
    let (_, projection, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}/scenes"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert!(!projection.to_string().contains(&scene_id));
    assert!(!projection.to_string().contains("Secret cavern"));
    // Campaign summaries must count only scenes this identity can read.
    for (cookie, expected) in [(&owner, 2), (&alice, 1)] {
        let (_, detail, _) = host
            .request(
                "GET",
                &format!("/api/campaigns/{id}"),
                json!({}),
                Some(cookie),
            )
            .await;
        assert_eq!(detail["campaign"]["sceneCount"], expected);
        let (_, library, _) = host
            .request("GET", "/api/campaigns", json!({}), Some(cookie))
            .await;
        let campaign = library["campaigns"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["id"] == id)
            .unwrap();
        assert_eq!(campaign["sceneCount"], expected);
    }

    let forbidden = command(
        &mut player,
        &uuid::Uuid::new_v4().to_string(),
        1,
        json!({"type":"scene.activate","payload":{"sceneId":scene_id}}),
    )
    .await;
    assert_eq!(forbidden["error"]["code"], "FORBIDDEN");
    let token_id = uuid::Uuid::new_v4().to_string();
    assert_eq!(command(&mut dm,&uuid::Uuid::new_v4().to_string(),1,json!({"type":"token.create","payload":{"tokenId":token_id,"sceneId":scene_id,"name":"Cave guardian","assetId":"token-warden","size":52,"x":90,"y":90,"visibility":"shared"}})).await["revision"],2);
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            2,
            json!({"type":"token.assign","payload":{"tokenId":token_id,"userId":alice_id}})
        )
        .await["revision"],
        3
    );
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            3,
            json!({"type":"scene.activate","payload":{"sceneId":scene_id}})
        )
        .await["revision"],
        4
    );
    let (_, projection, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}/scenes"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(projection["scenes"].as_array().unwrap().len(), 1);
    assert_eq!(projection["scenes"][0]["id"], scene_id);
    assert_eq!(projection["scenes"][0]["tokens"][0]["canMove"], true);
    assert_eq!(
        host.request(
            "GET",
            &format!("/api/campaigns/{id}/assets/{asset}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        command(
            &mut player,
            &uuid::Uuid::new_v4().to_string(),
            4,
            json!({"type":"token.move","payload":{"tokenId":token_id,"x":150,"y":90}})
        )
        .await["revision"],
        5
    );
    assert_eq!(command(&mut dm,&uuid::Uuid::new_v4().to_string(),5,json!({"type":"token.update","payload":{"tokenId":token_id,"name":"Stone guardian","assetId":"token-scout","size":60}})).await["revision"],6);
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            6,
            json!({"type":"scene.conceal","payload":{"sceneId":scene_id}})
        )
        .await["revision"],
        7
    );
    let (_, projection, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}/scenes"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert!(projection["scenes"].as_array().unwrap().is_empty());
    let (_, detail, _) = host
        .request(
            "GET",
            &format!("/api/campaigns/{id}"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(detail["campaign"]["sceneCount"], 0);

    assert_eq!(
        host.request(
            "GET",
            &format!("/api/campaigns/{id}/assets/{asset}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        command(
            &mut player,
            &uuid::Uuid::new_v4().to_string(),
            7,
            json!({"type":"token.move","payload":{"tokenId":token_id,"x":210,"y":90}})
        )
        .await["error"]["code"],
        "NOT_FOUND_OR_HIDDEN"
    );
    let delete_id = uuid::Uuid::new_v4().to_string();
    let delete = json!({"type":"token.delete","payload":{"tokenId":token_id}});
    assert_eq!(
        command(&mut dm, &delete_id, 7, delete.clone()).await["revision"],
        8
    );
    assert_eq!(
        command(&mut dm, &delete_id, 7, delete).await["duplicate"],
        true
    );
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            8,
            json!({"type":"scene.activate","payload":{"sceneId":original}})
        )
        .await["revision"],
        9
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM tokens WHERE id=?")
            .bind(token_id)
            .fetch_one(&host.state.store.pool)
            .await
            .unwrap(),
        0
    );
    dm.close(None).await.unwrap();
    player.close(None).await.unwrap();
    host.state.shutdown();
    drop(server);
    let root = host._dir.path().to_owned();
    let Host { app, state, _dir } = host;
    drop(app);
    state.store.pool.close().await;
    drop(state);
    let mut reopened = None;
    for _ in 0..40 {
        match hearth_storage::Store::open(&root).await {
            Ok(store) => {
                reopened = Some(store);
                break;
            }
            Err(_) => tokio::time::sleep(std::time::Duration::from_millis(25)).await,
        }
    }
    let store = reopened.expect("Closed host must release its lock");
    let (active,): (String,) = sqlx::query_as("SELECT active_scene_id FROM campaigns WHERE id=?")
        .bind(&id)
        .fetch_one(&store.pool)
        .await
        .unwrap();
    assert_eq!(active, original);
    let sha: String = sqlx::query_scalar("SELECT sha256 FROM assets WHERE id=?")
        .bind(asset)
        .fetch_one(&store.pool)
        .await
        .unwrap();
    assert!(root.join("assets").join(format!("{sha}.png")).is_file());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM scenes WHERE campaign_id=?")
            .bind(&id)
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        2
    );
    store.pool.close().await;
    drop(_dir);
}

#[tokio::test]
async fn concurrent_large_asset_responses_use_bounded_streaming_chunks() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let mut seed = 12345_u32;
    let mut pixels = vec![0_u8; 700 * 700 * 3];
    for byte in &mut pixels {
        seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
        *byte = (seed >> 24) as u8;
    }
    let image = image::RgbImage::from_raw(700, 700, pixels).unwrap();
    let mut buffer = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(image)
        .write_to(&mut buffer, image::ImageFormat::Png)
        .unwrap();
    let (status, data) = upload_image(&host, &owner, &id, buffer.into_inner(), "image/png").await;
    assert_eq!(status, StatusCode::OK);
    let asset = data["asset"]["id"].as_str().unwrap();
    assert!(data["asset"]["byteSize"].as_i64().unwrap() > 128 * 1024);
    let mut pending = Vec::new();
    for _ in 0..8 {
        let request = Request::builder()
            .uri(format!("/api/campaigns/{id}/assets/{asset}"))
            .header("host", "localhost:8787")
            .header("cookie", &owner)
            .body(Body::empty())
            .unwrap();
        let response = host.app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()["cache-control"], "no-store");
        pending.push(response.into_body());
    }
    for mut body in pending {
        let frame = body.frame().await.unwrap().unwrap();
        let bytes = frame.data_ref().unwrap();
        assert!(
            bytes.len() <= 64 * 1024,
            "A slow reader must not retain the whole image in one response chunk"
        );
    }
}

#[tokio::test]
async fn jpeg_webp_uploads_are_canonical_and_campaign_quota_is_enforced() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    for (format, mime) in [
        (image::ImageFormat::Jpeg, "image/jpeg"),
        (image::ImageFormat::WebP, "image/webp"),
    ] {
        let mut bytes = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(64, 64)
            .write_to(&mut bytes, format)
            .unwrap();
        let (status, data) = upload_image(&host, &owner, &id, bytes.into_inner(), mime).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(data["asset"]["width"], 64);
    }
    let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets WHERE campaign_id=?")
        .bind(&id)
        .fetch_one(&host.state.store.pool)
        .await
        .unwrap();
    sqlx::query("UPDATE assets SET byte_size=100*1024*1024 WHERE campaign_id=?")
        .bind(&id)
        .execute(&host.state.store.pool)
        .await
        .unwrap();
    let (status, _) = upload_image(&host, &owner, &id, map_fixture(), "image/png").await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets WHERE campaign_id=?")
        .bind(&id)
        .fetch_one(&host.state.store.pool)
        .await
        .unwrap();
    assert_eq!(before, after);
    assert_eq!(
        upload_image(
            &host,
            &owner,
            &id,
            map_fixture()[..128].to_vec(),
            "image/png"
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
}
