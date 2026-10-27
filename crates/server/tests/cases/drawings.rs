#[tokio::test]
async fn drawings_are_saved_synced_filtered_and_undoable() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &campaign, "alice").await;
    let (bob, _) = h.player(&owner, &campaign, "bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_string();
    let mut revision = initial["revision"].as_i64().unwrap();
    let mut player = server.connect(&campaign, &alice).await;
    frame(&mut player).await;
    let mut other = server.connect(&campaign, &bob).await;
    frame(&mut other).await;
    let nonce = uuid::Uuid::new_v4().to_string();
    let shared = json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":nonce,"shape":"line","visibility":"shared","color":"#e8bc6a","startX":10.0,"startY":10.0,"endX":90.0,"endY":90.0}});
    assert_eq!(
        command(
            &mut player,
            &uuid::Uuid::new_v4().to_string(),
            revision,
            shared.clone()
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    accepted(&mut dm, &mut revision, shared).await;
    let public = through(&mut player, revision).await;
    assert_eq!(public["scenes"][0]["drawings"].as_array().unwrap().len(), 1);
    let secret = uuid::Uuid::new_v4().to_string();
    accepted(&mut dm, &mut revision, json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":secret,"shape":"rectangle","visibility":"dm","color":"#e65b5b","startX":100.0,"startY":100.0,"endX":180.0,"endY":180.0}})).await;
    let visible = through(&mut other, revision).await;
    assert_eq!(
        visible["scenes"][0]["drawings"].as_array().unwrap().len(),
        1
    );
    assert!(!visible.to_string().contains(&secret));
    let (_, player_scenes, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{campaign}/scenes"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(
        player_scenes["scenes"][0]["drawings"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    let (_, dm_scenes, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{campaign}/scenes"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(
        dm_scenes["scenes"][0]["drawings"].as_array().unwrap().len(),
        2
    );
    let invalid = json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"line","visibility":"shared","color":"#e8bc6a","startX":-5.0,"startY":10.0,"endX":90.0,"endY":90.0}});
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            revision,
            invalid
        )
        .await["error"]["code"],
        "VALIDATION_FAILED"
    );
    accepted(
        &mut dm,
        &mut revision,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    let (_, after, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{campaign}/scenes"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(after["scenes"][0]["drawings"].as_array().unwrap().len(), 1);
    accepted(
        &mut dm,
        &mut revision,
        json!({"type":"fog.configure","payload":{"sceneId":scene,"enabled":true}}),
    )
    .await;
    assert_eq!(
        through(&mut player, revision).await["scenes"][0]["drawings"],
        json!([])
    );
    accepted(&mut dm, &mut revision, json!({"type":"fog.paint","payload":{"sceneId":scene,"column":0,"row":0,"width":2,"height":2,"mode":"reveal"}})).await;
    assert_eq!(
        through(&mut player, revision).await["scenes"][0]["drawings"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    let reopened = server.connect(&campaign, &owner).await;
    let mut reopened = reopened;
    assert_eq!(
        frame(&mut reopened).await["scenes"][0]["drawings"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn drawings_enforce_scene_limit_and_creation_nonce() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    let mut rev = initial["revision"].as_i64().unwrap();
    let nonce = uuid::Uuid::new_v4().to_string();
    let shape = |id: &str| json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":id,"shape":"line","visibility":"shared","color":"#e8bc6a","startX":10,"startY":10,"endX":90,"endY":90}});
    accepted(&mut dm, &mut rev, shape(&nonce)).await;
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            shape(&nonce)
        )
        .await["error"]["code"],
        "CONFLICT"
    );
    let mut invalid = shape(&uuid::Uuid::new_v4().to_string());
    invalid["payload"]["endX"] = json!(10);
    invalid["payload"]["endY"] = json!(10);
    assert_eq!(
        command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, invalid).await["error"]["code"],
        "VALIDATION_FAILED"
    );
    let mut tx = h.state.store.pool.begin().await.unwrap();
    for _ in 0..63 {
        sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y) VALUES(?,?,'line','dm','#e65b5b',10,10,20,20)").bind(uuid::Uuid::new_v4().to_string()).bind(&scene).execute(&mut *tx).await.unwrap();
    }
    tx.commit().await.unwrap();
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            shape(&uuid::Uuid::new_v4().to_string())
        )
        .await["error"]["code"],
        "VALIDATION_FAILED"
    );
    let current: i64 = sqlx::query_scalar("SELECT revision FROM campaigns WHERE id=?")
        .bind(&campaign)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(current, rev);
}
