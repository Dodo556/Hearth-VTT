fn scene_note_save(scene: &str, scope: &str, version: i64, body: &str) -> Value {
    json!({"type":"scene.notes.update","payload":{"sceneId":scene,"visibility":scope,"expectedVersion":version,"body":body}})
}

#[tokio::test]
async fn scene_notes_are_private_versioned_and_scoped_to_authorized_scenes() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &camp, "notes_alice").await;
    let (bob, _) = h.player(&owner, &camp, "notes_bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    assert_eq!(
        initial["scenes"][0]["notes"]["dm"],
        json!({"body":"","version":0})
    );
    let mut rev = initial["revision"].as_i64().unwrap();
    let mut a = server.connect(&camp, &alice).await;
    let mut b = server.connect(&camp, &bob).await;
    assert!(frame(&mut a).await["scenes"][0].get("notes").is_none());
    frame(&mut b).await;
    let private = scene_note_save(&scene, "dm", 0, "GM NOTE SECRET 84");
    assert_eq!(
        command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            private.clone()
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    let request = uuid::Uuid::new_v4().to_string();
    let base = rev;
    let ack = command(&mut dm, &request, base, private.clone()).await;
    assert_eq!(ack["kind"], "ack");
    rev = ack["revision"].as_i64().unwrap();
    assert_eq!(
        command(&mut dm, &request, base, private).await["duplicate"],
        true
    );
    for socket in [&mut a, &mut b] {
        let snapshot = through(socket, rev).await;
        assert!(snapshot["scenes"][0].get("notes").is_none());
        assert!(!snapshot.to_string().contains("GM NOTE SECRET"));
    }
    let literal = "<b>North gate</b>\n🐉\tWait";
    accepted(
        &mut dm,
        &mut rev,
        scene_note_save(&scene, "shared", 0, literal),
    )
    .await;
    for socket in [&mut a, &mut b] {
        let snapshot = through(socket, rev).await;
        assert_eq!(
            snapshot["scenes"][0]["notes"],
            json!({"shared":{"body":literal,"version":1}})
        );
    }
    accepted(
        &mut dm,
        &mut rev,
        scene_note_save(&scene, "dm", 1, "GM NOTE SECRET 85"),
    )
    .await;
    let snap = through(&mut a, rev).await;
    assert_eq!(snap["scenes"][0]["notes"]["shared"]["version"], 1);
    assert!(!snap.to_string().contains("SECRET"));
    let (_, rest, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/scenes/{scene}"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(
        rest["scene"]["notes"],
        json!({"shared":{"body":literal,"version":1}})
    );
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            scene_note_save(&scene, "dm", 0, "old draft")
        )
        .await["error"]["code"],
        "STALE_SCENE_NOTE"
    );
    accepted(&mut dm, &mut rev, scene_note_save(&scene, "shared", 1, "")).await;
    assert!(
        through(&mut a, rev).await["scenes"][0]
            .get("notes")
            .is_none()
    );
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            scene_note_save(&scene, "shared", 1, "old briefing")
        )
        .await["error"]["code"],
        "STALE_SCENE_NOTE"
    );
    let hidden = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,visibility,created_at) SELECT ?,campaign_id,'Secret next room',width,height,grid_size,background_asset_id,'dm',created_at FROM scenes WHERE id=?").bind(&hidden).bind(&scene).execute(&h.state.store.pool).await.unwrap();
    accepted(
        &mut dm,
        &mut rev,
        scene_note_save(&hidden, "shared", 0, "FUTURE SCENE SECRET"),
    )
    .await;
    let snap = through(&mut a, rev).await;
    assert!(!snap.to_string().contains("FUTURE SCENE"));
    assert!(!snap.to_string().contains(&hidden));
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"scene.activate","payload":{"sceneId":hidden}}),
    )
    .await;
    assert_eq!(
        through(&mut a, rev).await["scenes"][0]["notes"]["shared"]["body"],
        "FUTURE SCENE SECRET"
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"scene.conceal","payload":{"sceneId":hidden}}),
    )
    .await;
    assert_eq!(through(&mut a, rev).await["scenes"], json!([]));
    let (status, _, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/scenes/{hidden}"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let stored: (String, i64) =
        sqlx::query_as("SELECT body,version FROM scene_notes WHERE scene_id=? AND visibility='dm'")
            .bind(&scene)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap();
    assert_eq!(stored, ("GM NOTE SECRET 85".into(), 2));
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"scene.delete","payload":{"sceneId":hidden}}),
    )
    .await;
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM scene_notes WHERE scene_id=?")
            .bind(hidden)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn scene_notes_reject_invalid_bodies_foreign_targets_and_archived_edits() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap();
    let mut rev = initial["revision"].as_i64().unwrap();
    for text in ["x".repeat(1001), "bad\u{0001}".into(), "bad\u{0085}".into()] {
        assert_eq!(
            command(
                &mut dm,
                &uuid::Uuid::new_v4().to_string(),
                rev,
                scene_note_save(scene, "dm", 0, &text)
            )
            .await["error"]["code"],
            "VALIDATION_FAILED"
        );
    }
    accepted(
        &mut dm,
        &mut rev,
        scene_note_save(scene, "dm", 0, &"🐉".repeat(1000)),
    )
    .await;
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            scene_note_save(scene, "dm", -1, "")
        )
        .await["error"]["code"],
        "VALIDATION_FAILED"
    );
    let other = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO campaigns(id,name,created_by,created_at,updated_at) SELECT ?,'Other',created_by,created_at,updated_at FROM campaigns WHERE id=?").bind(&other).bind(&camp).execute(&h.state.store.pool).await.unwrap();
    let target = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at) SELECT ?,?,'Foreign',width,height,grid_size,background_asset_id,created_at FROM scenes WHERE id=?").bind(&target).bind(other).bind(scene).execute(&h.state.store.pool).await.unwrap();
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            scene_note_save(&target, "dm", 0, "foreign")
        )
        .await["error"]["code"],
        "NOT_FOUND_OR_HIDDEN"
    );
    sqlx::query("UPDATE campaigns SET archived=1 WHERE id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            scene_note_save(scene, "dm", 1, "")
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
}
