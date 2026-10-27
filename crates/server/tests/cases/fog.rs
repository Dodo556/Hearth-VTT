#[tokio::test]
async fn fog_filters_whole_tokens_art_and_movement_and_persists() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let (bob, _) = h.player(&owner, &camp, "bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap();
    assert_eq!(initial["scenes"][0]["fog"]["enabled"], false);
    let mut rev = initial["revision"].as_i64().unwrap();
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let configure = json!({"type":"fog.configure","payload":{"sceneId":scene,"enabled":true}});
    let receipt = uuid::Uuid::new_v4().to_string();
    let ack = command(&mut dm, &receipt, rev, configure.clone()).await;
    assert_eq!(ack["kind"], "ack", "{ack}");
    let old_rev = rev;
    rev = ack["revision"].as_i64().unwrap();
    assert_eq!(
        command(&mut dm, &receipt, old_rev, configure.clone()).await["duplicate"],
        true
    );
    for s in [&mut a, &mut b] {
        let hidden = through(s, rev).await;
        assert_eq!(hidden["kind"], "snapshot");
        assert_eq!(hidden["scenes"][0]["tokens"], json!([]));
    }
    let token = uuid::Uuid::new_v4().to_string();
    accepted(&mut dm, &mut rev, json!({"type":"token.create","payload":{"tokenId":token,"sceneId":scene,"name":"SECRET FOG PREPARATION","assetId":"vault-sentinel","size":64,"x":64,"y":64,"visibility":"shared"}})).await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.assign","payload":{"tokenId":token,"userId":aid}}),
    )
    .await;
    for cookie in [&alice, &bob] {
        let (_, visible, _) = h
            .request(
                "GET",
                &format!("/api/campaigns/{camp}/scenes"),
                json!({}),
                Some(cookie),
            )
            .await;
        assert!(!visible.to_string().contains("SECRET FOG"));
        assert!(!visible.to_string().contains(&token));
        assert_eq!(
            h.request(
                "GET",
                &format!("/api/campaigns/{camp}/assets/vault-sentinel"),
                json!({}),
                Some(cookie)
            )
            .await
            .0,
            StatusCode::NOT_FOUND
        );
    }
    let move_command =
        |id: &str, x: f64| json!({"type":"token.move","payload":{"tokenId":id,"x":x,"y":64}});
    let hidden = command(
        &mut a,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        move_command(&token, 64.0),
    )
    .await;
    let unknown = command(
        &mut a,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        move_command(&uuid::Uuid::new_v4().to_string(), 64.0),
    )
    .await;
    assert_eq!(hidden["error"], unknown["error"]);
    assert_eq!(hidden["error"]["code"], "NOT_FOUND_OR_HIDDEN");
    assert_eq!(
        command(&mut a, &uuid::Uuid::new_v4().to_string(), rev, configure).await["error"]["code"],
        "FORBIDDEN"
    );
    // The footprint intersects four cells; one revealed cell is insufficient.
    let paint = |w: i64, h: i64, mode: &str| json!({"type":"fog.paint","payload":{"sceneId":scene,"column":0,"row":0,"width":w,"height":h,"mode":mode}});
    accepted(&mut dm, &mut rev, paint(1, 1, "reveal")).await;
    let partial = through(&mut a, rev).await;
    assert_eq!(partial["scenes"][0]["tokens"], json!([]));
    for (w, hh) in [(0, 1), (i64::MAX, 1), (1, -1)] {
        assert_eq!(
            command(
                &mut dm,
                &uuid::Uuid::new_v4().to_string(),
                rev,
                paint(w, hh, "reveal")
            )
            .await["error"]["code"],
            "VALIDATION_FAILED"
        );
    }
    accepted(&mut dm, &mut rev, paint(2, 2, "reveal")).await;
    let revealed = through(&mut a, rev).await;
    assert!(
        revealed["scenes"][0]["tokens"]
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t["id"] == token)
    );
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/assets/vault-sentinel"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            move_command(&token, 192.0)
        )
        .await["error"]["code"],
        "VALIDATION_FAILED"
    );
    accepted(&mut a, &mut rev, move_command(&token, 88.0)).await;
    accepted(&mut dm, &mut rev, paint(2, 2, "hide")).await;
    assert_eq!(through(&mut b, rev).await["scenes"][0]["tokens"], json!([]));
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/assets/vault-sentinel"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Background delivery is explicitly not protected by this manual mask.
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/assets/amber-map"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::OK
    );
    accepted(&mut dm, &mut rev, paint(2, 2, "reveal")).await;
    let before: (bool, Vec<u8>) =
        sqlx::query_as("SELECT fog_enabled,fog_bits FROM scenes WHERE id=?")
            .bind(scene)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap();
    dm.close(None).await.unwrap();
    a.close(None).await.unwrap();
    b.close(None).await.unwrap();
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
    let reopened = opened.expect("Closed host lock");
    let after: (bool, Vec<u8>) =
        sqlx::query_as("SELECT fog_enabled,fog_bits FROM scenes WHERE id=?")
            .bind(scene)
            .fetch_one(&reopened.pool)
            .await
            .unwrap();
    assert_eq!(before, after);
    assert!(after.0);
    assert!(after.1.iter().any(|b| *b != 0));
    reopened.pool.close().await;
}

#[tokio::test]
async fn fog_reset_bounds_foreign_scenes_and_independent_actor_sharing() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let (bob, _) = h.player(&owner, &camp, "bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let scene = uuid::Uuid::new_v4().to_string();
    let mut rev = 0;
    accepted(&mut dm,&mut rev,json!({"type":"scene.create","payload":{"sceneId":scene,"name":"Odd grid","assetId":"amber-map","gridSize":100}})).await;
    let paint = json!({"type":"fog.paint","payload":{"sceneId":scene,"column":0,"row":0,"width":1,"height":1,"mode":"reveal"}});
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            paint.clone()
        )
        .await["error"]["code"],
        "VALIDATION_FAILED"
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"fog.reset","payload":{"sceneId":scene,"mode":"reveal"}}),
    )
    .await;
    let (_, body, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/scenes"),
            json!({}),
            Some(&owner),
        )
        .await;
    let fog = &body["scenes"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["id"] == scene)
        .unwrap()["fog"];
    assert_eq!(fog["columns"], 15);
    assert_eq!(fog["rows"], 10);
    assert_eq!(fog["revealed"], format!("{}3f", "ff".repeat(18)));
    let saved = fog["revealed"].clone();
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"fog.configure","payload":{"sceneId":scene,"enabled":false}}),
    )
    .await;
    let bytes: Vec<u8> = sqlx::query_scalar("SELECT fog_bits FROM scenes WHERE id=?")
        .bind(&scene)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(hex::encode(bytes), saved.as_str().unwrap());
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"fog.reset","payload":{"sceneId":scene,"mode":"hide"}}),
    )
    .await;
    for (column, row, w, height) in [
        (14, 0, 2, 1),
        (0, 9, 1, 2),
        (i64::MAX, 0, i64::MAX, 1),
        (0, i64::MAX, 1, i64::MAX),
    ] {
        assert_eq!(command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,json!({"type":"fog.paint","payload":{"sceneId":scene,"column":column,"row":row,"width":w,"height":height,"mode":"reveal"}})).await["error"]["code"],"VALIDATION_FAILED");
    }
    let (_, other, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Other","createDemo":true}),
            Some(&owner),
        )
        .await;
    let other_id = other["campaign"]["id"].as_str().unwrap();
    let (_, scenes, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{other_id}/scenes"),
            json!({}),
            Some(&owner),
        )
        .await;
    let foreign = scenes["scenes"][0]["id"].as_str().unwrap();
    for target in [foreign, &uuid::Uuid::new_v4().to_string()] {
        assert_eq!(
            command(
                &mut dm,
                &uuid::Uuid::new_v4().to_string(),
                rev,
                json!({"type":"fog.configure","payload":{"sceneId":target,"enabled":true}})
            )
            .await["error"]["code"],
            "NOT_FOUND_OR_HIDDEN"
        );
    }
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"scene.activate","payload":{"sceneId":scene}}),
    )
    .await;
    let actor = uuid::Uuid::new_v4().to_string();
    accepted(&mut dm, &mut rev, actor_input(&actor, "vault-sentinel")).await;
    accepted(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":aid,"permission":"observer"}})).await;
    for (cookie, status) in [(&alice, StatusCode::OK), (&bob, StatusCode::NOT_FOUND)] {
        assert_eq!(
            h.request(
                "GET",
                &format!("/api/campaigns/{camp}/assets/vault-sentinel"),
                json!({}),
                Some(cookie)
            )
            .await
            .0,
            status
        );
    }
    let (_, actors, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/actors"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(actors["actors"][0]["id"], actor);
    assert!(actors["actors"][0].get("dmNotes").is_none());
    assert_eq!(
        h.request(
            "PATCH",
            &format!("/api/campaigns/{camp}"),
            json!({"name":"Archived","description":"","archived":true}),
            Some(&owner)
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, paint).await["error"]["code"],
        "FORBIDDEN"
    );
}
