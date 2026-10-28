#[tokio::test]
async fn drawing_edits_and_erasures_are_versioned_private_and_undoable() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &campaign, "edit_alice").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    let mut rev = initial["revision"].as_i64().unwrap();
    let mut player = server.connect(&campaign, &alice).await;
    frame(&mut player).await;
    accepted(&mut dm,&mut rev,json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"text","visibility":"shared","color":"#72b7e2","fontSize":32,"text":"Original gate","startX":20,"startY":20,"endX":320,"endY":120}})).await;
    let snap = through(&mut player, rev).await;
    let drawing = &snap["scenes"][0]["drawings"][0];
    let id = drawing["id"].as_str().unwrap().to_owned();
    assert_eq!(drawing["fontSize"], 32);
    assert_eq!(drawing["version"], 1);
    assert!(snap["scenes"][0].get("canUndoDrawing").is_none());
    let edit = |version| json!({"type":"drawing.updateText","payload":{"sceneId":scene,"drawingId":id,"expectedVersion":version,"text":"Edited gate","visibility":"shared","color":"#abcdef","fontSize":48,"startX":40,"startY":40,"endX":420,"endY":180}});
    assert_eq!(
        command(&mut player, &uuid::Uuid::new_v4().to_string(), rev, edit(1)).await["error"]["code"],
        "FORBIDDEN"
    );
    accepted(&mut dm, &mut rev, edit(1)).await;
    assert_eq!(
        command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, edit(1)).await["error"]["code"],
        "STALE_DRAWING"
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    let restored = through(&mut player, rev).await;
    assert_eq!(
        restored["scenes"][0]["drawings"][0]["text"],
        "Original gate"
    );
    assert_eq!(restored["scenes"][0]["drawings"][0]["fontSize"], 32);
    assert_eq!(restored["scenes"][0]["drawings"][0]["version"], 3);
    let delete = json!({"type":"drawing.delete","payload":{"sceneId":scene,"drawingId":id,"expectedVersion":3}});
    assert_eq!(
        command(
            &mut player,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            delete.clone()
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    let request = uuid::Uuid::new_v4().to_string();
    let base = rev;
    let ack = command(&mut dm, &request, base, delete.clone()).await;
    assert_eq!(ack["kind"], "ack");
    rev = ack["revision"].as_i64().unwrap();
    assert_eq!(
        through(&mut player, rev).await["scenes"][0]["drawings"],
        json!([])
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    assert_eq!(
        through(&mut player, rev).await["scenes"][0]["drawings"][0]["version"],
        4
    );
    assert_eq!(
        command(&mut dm, &request, base, delete).await["duplicate"],
        true
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    let mut fresh = server.connect(&campaign, &owner).await;
    let final_state = frame(&mut fresh).await;
    assert_eq!(final_state["scenes"][0]["drawings"], json!([]));
    assert_eq!(final_state["scenes"][0]["canUndoDrawing"], false);
}

#[tokio::test]
async fn text_drawings_preserve_literal_content_and_filter_the_entire_box() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &campaign, "text_alice").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    let mut rev = initial["revision"].as_i64().unwrap();
    let mut player = server.connect(&campaign, &alice).await;
    frame(&mut player).await;
    let create = |visibility: &str, text: &str| json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"text","visibility":visibility,"color":"#72b7e2","startX":180.1234,"startY":100.5678,"endX":20.1234,"endY":20.5678,"text":text}});
    let public_text = "<b>North gate</b> 🐉\nKeep left";
    assert_eq!(
        command(
            &mut player,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            create("shared", public_text)
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    let original = create("shared", public_text);
    let request = uuid::Uuid::new_v4().to_string();
    let old_rev = rev;
    let ack = command(&mut dm, &request, rev, original.clone()).await;
    assert_eq!(ack["kind"], "ack", "{ack}");
    rev = ack["revision"].as_i64().unwrap();
    assert_eq!(
        command(&mut dm, &request, old_rev, original).await["duplicate"],
        true
    );
    let shared = through(&mut player, rev).await;
    let label = &shared["scenes"][0]["drawings"][0];
    assert_eq!(label["text"], public_text);
    assert_eq!(label["startX"], 20.12);
    assert_eq!(label["startY"], 20.57);
    assert_eq!(label["endX"], 180.12);
    assert_eq!(label["endY"], 100.57);
    accepted(&mut dm, &mut rev, create("dm", "SECRET LABEL 🐉")).await;
    let private = through(&mut player, rev).await;
    assert!(!private.to_string().contains("SECRET LABEL"));
    assert_eq!(
        private["scenes"][0]["drawings"].as_array().unwrap().len(),
        1
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"fog.configure","payload":{"sceneId":scene,"enabled":true}}),
    )
    .await;
    accepted(&mut dm, &mut rev, json!({"type":"fog.paint","payload":{"sceneId":scene,"column":0,"row":0,"width":1,"height":1,"mode":"reveal"}})).await;
    let concealed = through(&mut player, rev).await;
    assert!(!concealed.to_string().contains(public_text));
    assert_eq!(concealed["scenes"][0]["drawings"], json!([]));
    let (_, rest, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{campaign}/scenes"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(rest["scenes"][0]["drawings"], json!([]));
    accepted(&mut dm, &mut rev, json!({"type":"fog.paint","payload":{"sceneId":scene,"column":0,"row":0,"width":4,"height":2,"mode":"reveal"}})).await;
    assert_eq!(
        through(&mut player, rev).await["scenes"][0]["drawings"][0]["text"],
        public_text
    );
    let mut reconnected = server.connect(&campaign, &owner).await;
    assert_eq!(
        frame(&mut reconnected).await["scenes"][0]["drawings"][1]["text"],
        "SECRET LABEL 🐉"
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    assert_eq!(
        through(&mut player, rev).await["scenes"][0]["drawings"],
        json!([])
    );
}

#[tokio::test]
async fn text_drawings_reject_invalid_text_and_boxes_without_consuming_nonce() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    let mut rev = initial["revision"].as_i64().unwrap();
    let base = json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"text","visibility":"dm","color":"#9ad59b","startX":20,"startY":20,"endX":220,"endY":120,"text":"🐉".repeat(120)}});
    let mut variants = vec![];
    for text in [
        json!(null),
        json!(""),
        json!(" \n "),
        json!("🐉".repeat(121)),
        json!("bad\ttext"),
        json!("bad\u{0085}text"),
        json!("a\nb\nc\nd\ne"),
    ] {
        let mut bad = base.clone();
        bad["payload"]["text"] = text;
        variants.push(bad);
    }
    for (field, value) in [
        ("startX", -1.0),
        ("endX", 59.99),
        ("endY", 51.99),
        ("endX", 1044.01),
        ("endY", 532.01),
        ("endX", 99999.0),
    ] {
        let mut bad = base.clone();
        bad["payload"][field] = json!(value);
        variants.push(bad);
    }
    let mut bad = base.clone();
    bad["payload"]["shape"] = json!("rectangle");
    variants.push(bad);
    let mut bad = base.clone();
    bad["payload"]["points"] = json!([{"x":20,"y":20},{"x":220,"y":120}]);
    variants.push(bad);
    for bad in variants {
        assert_eq!(
            command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, bad.clone()).await["error"]["code"],
            "VALIDATION_FAILED",
            "{bad}"
        );
    }
    accepted(&mut dm, &mut rev, base).await;
    let boundary = json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"text","visibility":"dm","color":"#9ad59b","startX":24.07,"startY":20,"endX":64.07,"endY":52,"text":"Minimum box"}});
    accepted(&mut dm, &mut rev, boundary).await;
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM drawings WHERE scene_id=?")
        .bind(&scene)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
}

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

#[tokio::test]
async fn freehand_normalizes_saves_filters_every_point_and_undoes_closed_paths() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &campaign, "freehand_alice").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    let mut rev = initial["revision"].as_i64().unwrap();
    let create = json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"freehand","visibility":"shared","color":"#72b7e2","startX":10,"startY":10,"endX":10,"endY":10,"points":[{"x":10.1234,"y":10.5678},{"x":150,"y":20},{"x":20,"y":20},{"x":10.1234,"y":10.5678}]}});
    let mut player = server.connect(&campaign, &alice).await;
    frame(&mut player).await;
    assert_eq!(
        command(
            &mut player,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            create.clone()
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    let request = uuid::Uuid::new_v4().to_string();
    let reply = command(&mut dm, &request, rev, create.clone()).await;
    assert_eq!(reply["kind"], "ack", "{reply}");
    let old_rev = rev;
    rev = reply["revision"].as_i64().unwrap();
    let replay = command(&mut dm, &request, old_rev, create).await;
    assert_eq!(replay["revision"], rev);
    let public = through(&mut player, rev).await;
    let drawing = &public["scenes"][0]["drawings"][0];
    assert_eq!(drawing["points"][0], json!({"x":10.12,"y":10.57}));
    assert_eq!(drawing["startX"], 10.12);
    assert_eq!(drawing["endX"], 10.12);
    assert_eq!(drawing["points"].as_array().unwrap().len(), 4);
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"fog.configure","payload":{"sceneId":scene,"enabled":true}}),
    )
    .await;
    accepted(&mut dm, &mut rev, json!({"type":"fog.paint","payload":{"sceneId":scene,"column":0,"row":0,"width":1,"height":1,"mode":"reveal"}})).await;
    assert_eq!(
        through(&mut player, rev).await["scenes"][0]["drawings"],
        json!([]),
        "The middle of the curved path extends into unrevealed cells"
    );
    let (_, rest, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{campaign}/scenes"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(rest["scenes"][0]["drawings"], json!([]));
    accepted(&mut dm, &mut rev, json!({"type":"fog.paint","payload":{"sceneId":scene,"column":0,"row":0,"width":3,"height":1,"mode":"reveal"}})).await;
    assert_eq!(
        through(&mut player, rev).await["scenes"][0]["drawings"][0]["points"],
        drawing["points"]
    );
    let mut reconnect = server.connect(&campaign, &owner).await;
    assert_eq!(
        frame(&mut reconnect).await["scenes"][0]["drawings"][0]["points"],
        drawing["points"]
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    assert_eq!(
        through(&mut player, rev).await["scenes"][0]["drawings"],
        json!([])
    );
}

#[tokio::test]
async fn freehand_rejects_malformed_geometry_without_saving_or_consuming_nonce() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    let mut rev = initial["revision"].as_i64().unwrap();
    let nonce = uuid::Uuid::new_v4().to_string();
    let base = json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":nonce,"shape":"freehand","visibility":"dm","color":"#9ad59b","startX":10,"startY":10,"endX":20,"endY":20,"points":[{"x":10,"y":10},{"x":20,"y":20}]}});
    let malformed = vec![
        json!([]),
        json!([{"x":1,"y":1}]),
        json!([{"x":1,"y":1},{"x":1.001,"y":1.001}]),
        json!([{"x":-1,"y":1},{"x":20,"y":20}]),
        json!([{"x":1,"y":1},{"x":99999,"y":20}]),
        json!([{"x":1,"y":1},{"x":null,"y":20}]),
        json!([{"x":1,"y":1,"extra":true},{"x":20,"y":20}]),
        json!(vec![json!({"x":10,"y":10}); 129]),
    ];
    for points in malformed {
        let mut bad = base.clone();
        bad["payload"]["points"] = points;
        assert_eq!(
            command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, bad).await["error"]["code"],
            "VALIDATION_FAILED"
        );
    }
    accepted(&mut dm, &mut rev, base).await;
    let maximum = json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"freehand","visibility":"dm","color":"#9ad59b","startX":10,"startY":10,"endX":20,"endY":20,"points":(0..128).map(|i|json!({"x":10+i%2,"y":20+i%2})).collect::<Vec<_>>()}});
    accepted(&mut dm, &mut rev, maximum).await;
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM drawings WHERE scene_id=?")
        .bind(&scene)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
}

#[tokio::test]
async fn erasing_an_old_stroke_restores_exact_points_order_and_bounded_history() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    let mut rev = initial["revision"].as_i64().unwrap();
    let make = || json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"freehand","visibility":"dm","color":"#72b7e2","startX":10,"startY":10,"endX":10,"endY":10,"points":[{"x":10.12,"y":10.57},{"x":40,"y":50},{"x":10.12,"y":10.57}]}});
    accepted(&mut dm, &mut rev, make()).await;
    accepted(&mut dm, &mut rev, make()).await;
    let mut fresh = server.connect(&campaign, &owner).await;
    let before = frame(&mut fresh).await;
    let id = before["scenes"][0]["drawings"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    accepted(&mut dm,&mut rev,json!({"type":"drawing.delete","payload":{"sceneId":scene,"drawingId":id,"expectedVersion":1}})).await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    let mut fresh = server.connect(&campaign, &owner).await;
    let after = frame(&mut fresh).await;
    assert_eq!(after["scenes"][0]["drawings"][0]["id"], id);
    assert_eq!(
        after["scenes"][0]["drawings"][0]["points"],
        before["scenes"][0]["drawings"][0]["points"]
    );
    assert_eq!(
        after["scenes"][0]["drawings"][1],
        before["scenes"][0]["drawings"][1]
    );
    for _ in 0..130 {
        sqlx::query("INSERT INTO drawing_history(scene_id,drawing_id,action) VALUES(?,?,'create')")
            .bind(&scene)
            .bind(&id)
            .execute(&h.state.store.pool)
            .await
            .unwrap();
    }
    accepted(&mut dm, &mut rev, make()).await;
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM drawing_history WHERE scene_id=?")
        .bind(&scene)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(count, 128);
}

#[tokio::test]
async fn erasure_undo_survives_drawing_creation_in_another_scene() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let campaign = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let initial = frame(&mut dm).await;
    let scene = initial["scenes"][0]["id"].as_str().unwrap().to_owned();
    let asset = initial["scenes"][0]["backgroundAssetId"]
        .as_str()
        .unwrap()
        .to_owned();
    let mut rev = initial["revision"].as_i64().unwrap();
    let make = |scene: &str| json!({"type":"drawing.create","payload":{"sceneId":scene,"clientDrawingId":uuid::Uuid::new_v4().to_string(),"shape":"line","visibility":"dm","color":"#72b7e2","startX":10,"startY":10,"endX":90,"endY":90}});
    accepted(&mut dm, &mut rev, make(&scene)).await;
    let mut fresh = server.connect(&campaign, &owner).await;
    let before = frame(&mut fresh).await;
    let id = before["scenes"][0]["drawings"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    accepted(&mut dm,&mut rev,json!({"type":"drawing.delete","payload":{"sceneId":scene,"drawingId":id,"expectedVersion":1}})).await;
    let other = uuid::Uuid::new_v4().to_string();
    accepted(&mut dm,&mut rev,json!({"type":"scene.create","payload":{"sceneId":other,"name":"Other scene","assetId":asset,"gridSize":60}})).await;
    accepted(&mut dm, &mut rev, make(&other)).await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"drawing.undo","payload":{"sceneId":scene}}),
    )
    .await;
    let mut fresh = server.connect(&campaign, &owner).await;
    let after = frame(&mut fresh).await;
    let scenes = after["scenes"].as_array().unwrap();
    assert_eq!(
        scenes.iter().find(|s| s["id"] == scene).unwrap()["drawings"][0]["id"],
        id
    );
    assert_eq!(
        scenes.iter().find(|s| s["id"] == other).unwrap()["drawings"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}
