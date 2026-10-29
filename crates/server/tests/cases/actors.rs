fn actor_input(id: &str, art: &str) -> Value {
    json!({"type":"actor.create","payload":{"actorId":id,"name":"Mira Čarodejka","kind":"character","assetId":art,"biography":"A scholar","dmNotes":"SECRET SHEET NOTES","hp":12,"maxHp":20,"attributes":{"Strength":"14"}}})
}
async fn accepted(s: &mut ClientSocket, rev: &mut i64, c: Value) -> Value {
    let r = command(s, &uuid::Uuid::new_v4().to_string(), *rev, c).await;
    assert_eq!(r["kind"], "ack", "{r}");
    *rev = r["revision"].as_i64().unwrap();
    r
}
async fn through(s: &mut ClientSocket, rev: i64) -> Value {
    loop {
        let v = frame(s).await;
        if v["revision"].as_i64().is_some_and(|r| r >= rev) {
            return v;
        }
    }
}
#[tokio::test]
async fn actor_permissions_private_portraits_and_linked_control_are_authoritative() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let (bob, bid) = h.player(&owner, &camp, "bob").await;
    let (status, empty, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/actors"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(empty["actors"], json!([]));
    let (_, art) = upload_image(&h, &owner, &camp, map_fixture(), "image/png").await;
    let art = art["asset"]["id"].as_str().unwrap();
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let initial = frame(&mut dm).await;
    let token = initial["scenes"][0]["tokens"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["assetId"] == "token-warden")
        .unwrap()["id"]
        .as_str()
        .unwrap();
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let actor = uuid::Uuid::new_v4().to_string();
    let mut rev = 0;
    let req = uuid::Uuid::new_v4().to_string();
    let create = actor_input(&actor, art);
    assert_eq!(
        command(&mut dm, &req, 0, create.clone()).await["revision"],
        1
    );
    rev += 1;
    assert_eq!(command(&mut dm, &req, 0, create).await["duplicate"], true);
    let hidden = through(&mut a, rev).await;
    assert_eq!(hidden["actors"], json!([]));
    assert!(!hidden.to_string().contains("SECRET SHEET"));
    let hidden = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/actors/{actor}"),
            json!({}),
            Some(&alice),
        )
        .await;
    let unknown = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/actors/{}", uuid::Uuid::new_v4()),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!((hidden.0, hidden.1), (unknown.0, unknown.1));
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.assign","payload":{"tokenId":token,"userId":bid}}),
    )
    .await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":token,"actorId":actor}}),
    )
    .await;
    let public = through(&mut b, rev).await;
    assert!(!public.to_string().contains(&actor));
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.move","payload":{"tokenId":token,"x":330,"y":330}}),
    )
    .await;
    let delta = through(&mut b, rev).await;
    assert_eq!(delta["payload"]["token"]["actorId"], Value::Null);
    assert_eq!(delta["payload"]["token"]["canMove"], false);
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            json!({"type":"token.assign","payload":{"tokenId":token,"userId":bid}})
        )
        .await["error"]["code"],
        "VALIDATION_FAILED"
    );
    accepted(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":aid,"permission":"observer"}})).await;
    let observed = through(&mut a, rev).await;
    assert_eq!(observed["actors"][0]["canEdit"], false);
    assert!(observed["actors"][0].get("dmNotes").is_none());
    assert!(observed["actors"][0].get("permissions").is_none());
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/assets/{art}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::OK
    );
    let update = json!({"type":"actor.update","payload":{"actorId":actor,"expectedVersion":1,"name":"Mira","biography":"<script>plain text</script>","hp":8,"maxHp":20,"attributes":{"Strength":"15"}}});
    assert_eq!(
        command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            update.clone()
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    accepted(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":aid,"permission":"owner"}})).await;
    through(&mut a, rev).await;
    for (key, value) in [
        ("dmNotes", json!("overwrite")),
        ("assetId", json!("vault-sentinel")),
    ] {
        let mut forged = update.clone();
        forged["payload"][key] = value;
        assert_eq!(
            command(&mut a, &uuid::Uuid::new_v4().to_string(), rev, forged).await["error"]["code"],
            "FORBIDDEN"
        );
    }
    accepted(&mut a, &mut rev, update.clone()).await;
    assert_eq!(
        command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            update.clone()
        )
        .await["error"]["code"],
        "STALE_ACTOR"
    );
    accepted(
        &mut a,
        &mut rev,
        json!({"type":"token.move","payload":{"tokenId":token,"x":390,"y":330}}),
    )
    .await;
    assert_eq!(
        command(&mut b, &uuid::Uuid::new_v4().to_string(), rev, update).await["error"]["code"],
        "NOT_FOUND_OR_HIDDEN"
    );
    let (_, other, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Other","createDemo":true}),
            Some(&owner),
        )
        .await;
    let other = other["campaign"]["id"].as_str().unwrap();
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{other}/actors/{actor}"),
            json!({}),
            Some(&owner)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let mut o = server.connect(other, &owner).await;
    let snap = frame(&mut o).await;
    let ot = snap["scenes"][0]["tokens"][0]["id"].as_str().unwrap();
    assert_eq!(
        command(
            &mut o,
            &uuid::Uuid::new_v4().to_string(),
            0,
            json!({"type":"token.link","payload":{"tokenId":ot,"actorId":actor}})
        )
        .await["error"]["code"],
        "NOT_FOUND_OR_HIDDEN"
    );
    accepted(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":aid,"permission":"none"}})).await;
    assert_eq!(through(&mut a, rev).await["actors"], json!([]));
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/assets/{art}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            json!({"type":"token.move","payload":{"tokenId":token,"x":450,"y":330}})
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"actor.visibility","payload":{"actorId":actor,"visibility":"shared"}}),
    )
    .await;
    let shared = through(&mut b, rev).await;
    assert_eq!(shared["actors"][0]["hp"], 8);
    assert!(!shared.to_string().contains("SECRET SHEET"));
    accepted(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":aid,"permission":"owner"}})).await;
    assert_eq!(
        h.request(
            "POST",
            &format!("/api/campaigns/{camp}/members/{aid}/revoke"),
            json!({}),
            Some(&owner)
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM actor_ownership WHERE user_id=?")
            .bind(aid)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap(),
        0
    );
    let req = uuid::Uuid::new_v4().to_string();
    let del = json!({"type":"actor.delete","payload":{"actorId":actor}});
    assert_eq!(
        command(&mut dm, &req, rev, del.clone()).await["kind"],
        "ack"
    );
    assert_eq!(command(&mut dm, &req, rev, del).await["duplicate"], true);
    assert_eq!(through(&mut b, rev + 1).await["actors"], json!([]));
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM pragma_foreign_key_check")
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap(),
        0
    );
}
#[tokio::test]
async fn scene_rename_precondition_and_delete_preserve_newer_names_and_clear_players() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &camp, "alice").await;
    let s = LiveServer::start(&h).await;
    let mut dm = s.connect(&camp, &owner).await;
    let snap = frame(&mut dm).await;
    let id = snap["scenes"][0]["id"].as_str().unwrap();
    let name = snap["scenes"][0]["name"].as_str().unwrap();
    let mut a = s.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut rev = 0;
    accepted(&mut dm,&mut rev,json!({"type":"scene.rename","payload":{"sceneId":id,"expectedName":name,"name":"New name"}})).await;
    assert_eq!(through(&mut a, rev).await["scenes"][0]["name"], "New name");
    assert_eq!(command(&mut dm,&uuid::Uuid::new_v4().to_string(),rev,json!({"type":"scene.rename","payload":{"sceneId":id,"expectedName":name,"name":"Old form"}})).await["error"]["code"],"STALE_SCENE");
    assert_eq!(
        command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            json!({"type":"scene.delete","payload":{"sceneId":id}})
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    let req = uuid::Uuid::new_v4().to_string();
    let del = json!({"type":"scene.delete","payload":{"sceneId":id}});
    assert_eq!(
        command(&mut dm, &req, rev, del.clone()).await["kind"],
        "ack"
    );
    assert_eq!(command(&mut dm, &req, rev, del).await["duplicate"], true);
    assert_eq!(through(&mut a, rev + 1).await["scenes"], json!([]));
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/assets/amber-map"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn maximum_unicode_actors_and_grants_survive_restart() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (_, player) = h.player(&owner, &camp, "alice").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut rev = 0;
    let mut last = String::new();
    for _ in 0..16 {
        last = uuid::Uuid::new_v4().to_string();
        let mut create = actor_input(&last, "token-warden");
        create["payload"]["name"] = json!("😀".repeat(80));
        create["payload"]["biography"] = json!("😀".repeat(1000));
        create["payload"]["dmNotes"] = json!("😀".repeat(1000));
        let props: serde_json::Map<String, Value> = (0..8)
            .map(|i| (format!("{i}{}", "😀".repeat(39)), json!("😀".repeat(120))))
            .collect();
        create["payload"]["attributes"] = json!(props);
        accepted(&mut dm, &mut rev, create).await;
    }
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            actor_input(&uuid::Uuid::new_v4().to_string(), "token-warden")
        )
        .await["error"]["code"],
        "VALIDATION_FAILED"
    );
    // Combine maximum Unicode sheets with all eight maximum-size scene masks.
    sqlx::query("UPDATE scenes SET width=4096,height=4096,grid_size=20,fog_enabled=1,fog_bits=? WHERE campaign_id=?").bind(vec![0u8;5254]).bind(&camp).execute(&h.state.store.pool).await.unwrap();
    for _ in 0..7 {
        sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at,fog_enabled,fog_bits) VALUES(?,?,'Mask budget',4096,4096,20,'amber-map',1,1,?)").bind(uuid::Uuid::new_v4().to_string()).bind(&camp).bind(vec![0u8;5254]).execute(&h.state.store.pool).await.unwrap();
    }
    // Include the maximum drawing count in each of the eight scenes.
    let scene_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM scenes WHERE campaign_id=?")
        .bind(&camp)
        .fetch_all(&h.state.store.pool)
        .await
        .unwrap();
    let mut drawing_tx = h.state.store.pool.begin().await.unwrap();
    for scene_id in &scene_ids {
        for scope in ["dm", "shared"] {
            sqlx::query("INSERT INTO scene_notes VALUES(?,?,?,1)")
                .bind(scene_id)
                .bind(scope)
                .bind("\u{10ffff}".repeat(1000))
                .execute(&mut *drawing_tx)
                .await
                .unwrap();
        }
        for _ in 0..64 {
            sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points) VALUES(?,?,'freehand','dm','#e65b5b',4095.99,4095.99,4094.99,4094.99,?)")
                .bind(uuid::Uuid::new_v4().to_string()).bind(scene_id)
                .bind(serde_json::to_string(&(0..128).map(|i|json!({"x":4095.99-(i%2) as f64,"y":4095.99-(i%2) as f64})).collect::<Vec<_>>()).unwrap()).execute(&mut *drawing_tx).await.unwrap();
        }
    }
    drawing_tx.commit().await.unwrap();
    sqlx::query("UPDATE tokens SET hp=999999,max_hp=1000000,hp_visibility='shared',vitals_version=17,statuses='[\"marked\",\"bleeding\",\"poisoned\",\"prone\",\"stunned\",\"concentrating\"]' WHERE scene_id IN(SELECT id FROM scenes WHERE campaign_id=?)").bind(&camp).execute(&h.state.store.pool).await.unwrap();
    // Also fill all100 token names,32 grants/actor and20 maximum-size dice results.
    let scene: String = sqlx::query_scalar("SELECT id FROM scenes WHERE campaign_id=? LIMIT 1")
        .bind(&camp)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    sqlx::query(
        "UPDATE tokens SET name=? WHERE scene_id IN(SELECT id FROM scenes WHERE campaign_id=?)",
    )
    .bind("😀".repeat(80))
    .bind(&camp)
    .execute(&h.state.store.pool)
    .await
    .unwrap();
    for _ in 0..97 {
        sqlx::query("INSERT INTO tokens(id,scene_id,name,x,y,size,color,asset_id,visibility) VALUES(?,?,?,30,30,52,'#ffddaa','token-warden','shared')").bind(uuid::Uuid::new_v4().to_string()).bind(&scene).bind("😀".repeat(80)).execute(&h.state.store.pool).await.unwrap();
    }
    let actor_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM actors WHERE campaign_id=?")
        .bind(&camp)
        .fetch_all(&h.state.store.pool)
        .await
        .unwrap();
    let mut members = vec![player.clone()];
    for n in 0..31 {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,'fixture',1)").bind(&id).bind(format!("budget_{n}")).bind("😀".repeat(80)).execute(&h.state.store.pool).await.unwrap();
        sqlx::query(
            "INSERT INTO memberships(campaign_id,user_id,role,created_at) VALUES(?,?,'player',1)",
        )
        .bind(&camp)
        .bind(&id)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
        members.push(id);
    }
    for actor in &actor_ids {
        for member in &members {
            sqlx::query("INSERT INTO actor_ownership(actor_id,campaign_id,user_id,permission) VALUES(?,?,?,'observer')").bind(actor).bind(&camp).bind(member).execute(&h.state.store.pool).await.unwrap();
        }
    }
    let owner_id: String = sqlx::query_scalar("SELECT id FROM users WHERE is_owner=1")
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    dice_budget(&h, &camp, &owner_id, rev, &members[..8]).await;
    rev += 20;
    chat_budget(&h, &camp, &owner_id, &members[..8], rev).await;
    rev += 20;
    sqlx::query("DELETE FROM journals WHERE campaign_id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    let (_, artwork) = upload_image(&h, &owner, &camp, map_fixture(), "image/png").await;
    let image = artwork["asset"]["id"].as_str().unwrap();
    for _ in 0..16 {
        sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at,asset_id) VALUES(?,?,?,?,'shared',1,?)")
            .bind(uuid::Uuid::new_v4().to_string()).bind(&camp).bind("😀".repeat(80)).bind("😀".repeat(1000)).bind(image).execute(&h.state.store.pool).await.unwrap();
    }
    for _ in 0..16 {
        sqlx::query("INSERT INTO journal_folders(id,campaign_id,name) VALUES(?,?,?)").bind(uuid::Uuid::new_v4().to_string()).bind(&camp).bind("😀".repeat(60)).execute(&h.state.store.pool).await.unwrap();
    }
    // Include a full encounter in the same Unicode/fog/grants/chat/dice budget.
    let encounter = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO combat_encounters(id,campaign_id,scene_id,name,status,round) VALUES(?,?,?,?,'active',1000000000)").bind(&encounter).bind(&camp).bind(&scene).bind("😀".repeat(80)).execute(&h.state.store.pool).await.unwrap();
    let combat_tokens: Vec<String> =
        sqlx::query_scalar("SELECT id FROM tokens WHERE scene_id=? ORDER BY id LIMIT 32")
            .bind(&scene)
            .fetch_all(&h.state.store.pool)
            .await
            .unwrap();
    for (index, token) in combat_tokens.iter().enumerate() {
        sqlx::query("UPDATE tokens SET actor_id=? WHERE id=?")
            .bind(&actor_ids[index % actor_ids.len()])
            .bind(token)
            .execute(&h.state.store.pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO combatants(id,encounter_id,token_id,initiative,sort_order) VALUES(?,?,?,?,?)").bind(uuid::Uuid::new_v4().to_string()).bind(&encounter).bind(token).bind(1000).bind(index as i64).execute(&h.state.store.pool).await.unwrap();
    }
    sqlx::query("UPDATE combat_encounters SET active_combatant_id=(SELECT id FROM combatants WHERE encounter_id=? ORDER BY sort_order LIMIT 1) WHERE id=?").bind(&encounter).bind(&encounter).execute(&h.state.store.pool).await.unwrap();
    let mut fresh = server.connect(&camp, &owner).await;
    let snap = frame(&mut fresh).await;
    assert_eq!(snap["rolls"].as_array().unwrap().len(), 20);
    assert_eq!(snap["scenes"].as_array().unwrap().len(), 8);
    assert!(
        snap["scenes"]
            .as_array()
            .unwrap()
            .iter()
            .all(|scene| scene["drawings"].as_array().unwrap().len() == 64)
    );
    assert_eq!(snap["actors"].as_array().unwrap().len(), 16);
    assert_eq!(
        snap["encounter"]["combatants"].as_array().unwrap().len(),
        32
    );
    assert_eq!(snap["encounter"]["combatants"][0]["hp"], 12);
    assert_eq!(snap["journals"].as_array().unwrap().len(), 16);
    assert!(snap.to_string().len() > 128 * 1024);
    assert_eq!(snap["messages"].as_array().unwrap().len(), 20);
    assert!(snap.to_string().len() < 4 * 1024 * 1024);
    assert_eq!(
        snap["scenes"][0]["drawings"][0]["points"]
            .as_array()
            .unwrap()
            .len(),
        128
    );
    eprintln!(
        "Maximum combined freehand snapshot: {} bytes",
        snap.to_string().len()
    );
    let text = format!("{}\"\\", "🐉".repeat(118));
    sqlx::query("UPDATE drawings SET shape='text',points='[]',text=?,start_x=20,start_y=20,end_x=1020,end_y=500").bind(&text).execute(&h.state.store.pool).await.unwrap();
    let mut text_client = server.connect(&camp, &owner).await;
    let text_snapshot = frame(&mut text_client).await;
    assert!(text_snapshot.to_string().len() < 4 * 1024 * 1024);
    assert!(text_snapshot["scenes"].as_array().unwrap().iter().all(|s| {
        s["drawings"].as_array().unwrap().len() == 64
            && s["drawings"]
                .as_array()
                .unwrap()
                .iter()
                .all(|d| d["text"] == text)
    }));
    eprintln!(
        "Maximum combined text snapshot: {} bytes",
        text_snapshot.to_string().len()
    );
    text_client.close(None).await.unwrap();
    accepted(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":last,"userId":player,"permission":"owner"}})).await;
    dm.close(None).await.unwrap();
    fresh.close(None).await.unwrap();
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
    let store = opened.expect("Closed host lock");
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM actors")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        16
    );
    assert_eq!(
        sqlx::query_scalar::<_, String>(
            "SELECT permission FROM actor_ownership WHERE actor_id=? AND user_id=?"
        )
        .bind(last)
        .bind(player)
        .fetch_one(&store.pool)
        .await
        .unwrap(),
        "owner"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM combatants")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        32
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT round FROM combat_encounters")
            .fetch_one(&store.pool)
            .await
            .unwrap(),
        1_000_000_000
    );
    store.pool.close().await;
    drop(_dir);
}
