async fn combat_read(h: &Host, campaign: &str, cookie: &str) -> Value {
    let (status, value, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{campaign}/combat"),
            json!({}),
            Some(cookie),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{value}");
    value["encounter"].clone()
}

#[tokio::test]
async fn combat_create_returns_host_identity_trimmed_name_initial_state_and_dedupes() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let snap = frame(&mut dm).await;
    let scene = snap["scenes"][0]["id"].as_str().unwrap();
    let nonce = uuid::Uuid::new_v4().to_string();
    let create = json!({"type":"combat.create","payload":{"clientEncounterId":nonce,"sceneId":scene,"name":"  Bridge skirmish  "}});
    let req = uuid::Uuid::new_v4().to_string();
    let result = command(&mut dm, &req, 0, create.clone()).await;
    assert_eq!(result["kind"], "ack", "{result}");
    assert_eq!(command(&mut dm, &req, 0, create).await["duplicate"], true);
    let e = combat_read(&h, &camp, &owner).await;
    assert_ne!(e["id"], nonce);
    assert_eq!(e["name"], "Bridge skirmish");
    assert_eq!(e["version"], 1);
    assert_eq!(e["status"], "preparing");
    assert_eq!(e["round"], 0);
    assert!(e["activeCombatantId"].is_null());
    assert_eq!(e["combatants"], json!([]));
    let payload: String = sqlx::query_scalar(
        "SELECT payload FROM campaign_events WHERE campaign_id=? AND revision=1",
    )
    .bind(&camp)
    .fetch_one(&h.state.store.pool)
    .await
    .unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&payload).unwrap(),
        json!({"projection":"snapshot"})
    );
}

async fn combat_command(s: &mut ClientSocket, rev: i64, c: Value) -> Value {
    tokio::time::sleep(std::time::Duration::from_millis(60)).await;
    command(s, &uuid::Uuid::new_v4().to_string(), rev, c).await
}
async fn combat_ok(s: &mut ClientSocket, rev: &mut i64, c: Value) {
    let reply = combat_command(s, *rev, c).await;
    assert_eq!(reply["kind"], "ack", "{reply}");
    *rev = reply["revision"].as_i64().unwrap();
}
async fn combat_create(
    h: &Host,
    s: &mut ClientSocket,
    camp: &str,
    owner: &str,
    scene: &str,
    rev: &mut i64,
) -> String {
    combat_ok(s, rev, json!({"type":"combat.create","payload":{"clientEncounterId":uuid::Uuid::new_v4(),"sceneId":scene,"name":"Encounter"}})).await;
    combat_read(h, camp, owner).await["id"]
        .as_str()
        .unwrap()
        .into()
}
async fn combat_add(
    h: &Host,
    s: &mut ClientSocket,
    camp: &str,
    owner: &str,
    encounter: &str,
    token: &str,
    rev: &mut i64,
) -> String {
    let e = combat_read(h, camp, owner).await;
    let nonce = uuid::Uuid::new_v4().to_string();
    combat_ok(s, rev, json!({"type":"combat.add","payload":{"encounterId":encounter,"expectedVersion":e["version"],"clientCombatantId":nonce,"tokenId":token}})).await;
    let e = combat_read(h, camp, owner).await;
    let c = e["combatants"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["tokenId"] == token)
        .unwrap();
    assert_ne!(c["id"], nonce);
    c["id"].as_str().unwrap().into()
}
async fn combat_lifecycle_action(
    h: &Host,
    s: &mut ClientSocket,
    camp: &str,
    owner: &str,
    action: &str,
    rev: &mut i64,
) {
    let e = combat_read(h, camp, owner).await;
    combat_ok(s, rev, json!({"type":format!("combat.{action}"),"payload":{"encounterId":e["id"],"expectedVersion":e["version"]}})).await;
}
#[tokio::test]
async fn combat_ties_anchor_turns_remove_with_wrap_and_keep_ended_until_clear() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let snap = frame(&mut dm).await;
    let scene = snap["scenes"][0]["id"].as_str().unwrap();
    let tokens = snap["scenes"][0]["tokens"].as_array().unwrap();
    let mut rev = 0;
    let encounter = combat_create(&h, &mut dm, &camp, &owner, scene, &mut rev).await;
    let mut ids = Vec::new();
    for token in tokens {
        ids.push(
            combat_add(
                &h,
                &mut dm,
                &camp,
                &owner,
                &encounter,
                token["id"].as_str().unwrap(),
                &mut rev,
            )
            .await,
        );
    }
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(
        e["combatants"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["id"].as_str().unwrap().to_owned())
            .collect::<Vec<_>>(),
        ids
    );
    for id in &ids[..2] {
        combat_ok(&mut dm,&mut rev,json!({"type":"combat.initiative","payload":{"combatantId":id,"expectedVersion":1,"initiative":12}})).await;
    }
    assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.initiative","payload":{"combatantId":ids[0],"expectedVersion":1,"initiative":13}})).await["error"]["code"],"STALE_COMBAT");
    assert_eq!(
        combat_command(
            &mut dm,
            rev,
            json!({"type":"combat.start","payload":{"encounterId":encounter,"expectedVersion":1}})
        )
        .await["error"]["code"],
        "STALE_COMBAT"
    );
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "start", &mut rev).await;
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["activeCombatantId"], ids[0]);
    assert_eq!(e["round"], 1);
    combat_ok(&mut dm,&mut rev,json!({"type":"combat.initiative","payload":{"combatantId":ids[0],"expectedVersion":2,"initiative":-1}})).await;
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["activeCombatantId"], ids[0]);
    assert_eq!(e["combatants"][0]["id"], ids[1]);
    combat_ok(&mut dm,&mut rev,json!({"type":"combat.remove","payload":{"combatantId":ids[0],"expectedVersion":e["version"]}})).await;
    assert_eq!(
        combat_read(&h, &camp, &owner).await["activeCombatantId"],
        ids[2]
    );
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "next", &mut rev).await;
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["activeCombatantId"], ids[1]);
    assert_eq!(e["round"], 2);
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "next", &mut rev).await;
    let e = combat_read(&h, &camp, &owner).await;
    combat_ok(&mut dm,&mut rev,json!({"type":"combat.remove","payload":{"combatantId":ids[2],"expectedVersion":e["version"]}})).await;
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["activeCombatantId"], ids[1]);
    assert_eq!(e["round"], 3);
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "end", &mut rev).await;
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["status"], "ended");
    assert_eq!(e["combatants"].as_array().unwrap().len(), 1);
    assert!(e["activeCombatantId"].is_null());
    combat_ok(&mut dm,&mut rev,json!({"type":"combat.remove","payload":{"combatantId":ids[1],"expectedVersion":e["version"]}})).await;
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["status"], "preparing");
    assert_eq!(e["round"], 0);
    assert_eq!(e["combatants"], json!([]));
    assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.create","payload":{"clientEncounterId":uuid::Uuid::new_v4(),"sceneId":scene,"name":"Other"}})).await["error"]["code"],"CONFLICT");
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "clear", &mut rev).await;
    assert!(combat_read(&h, &camp, &owner).await.is_null());
}

#[tokio::test]
async fn combat_projection_hides_entries_and_actor_data_while_current_owners_edit_hp_atomically() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let (bob, bid) = h.player(&owner, &camp, "bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let snap = frame(&mut dm).await;
    let scene = snap["scenes"][0]["id"].as_str().unwrap();
    let tokens = snap["scenes"][0]["tokens"].as_array().unwrap();
    let visible = tokens.iter().find(|t| t["visibility"] == "shared").unwrap()["id"]
        .as_str()
        .unwrap();
    let hidden = tokens.iter().find(|t| t["visibility"] == "dm").unwrap()["id"]
        .as_str()
        .unwrap();
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let mut rev = 0;
    let encounter = combat_create(&h, &mut dm, &camp, &owner, scene, &mut rev).await;
    let secret = combat_add(&h, &mut dm, &camp, &owner, &encounter, hidden, &mut rev).await;
    let public = combat_add(&h, &mut dm, &camp, &owner, &encounter, visible, &mut rev).await;
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "start", &mut rev).await;
    let raw = through(&mut a, rev).await;
    assert!(raw["encounter"]["activeCombatantId"].is_null());
    assert_eq!(raw["encounter"]["combatants"].as_array().unwrap().len(), 1);
    for secret in [hidden, &secret, "vault-sentinel"] {
        assert!(!raw.to_string().contains(secret), "{raw}")
    }
    for id in [&secret, &uuid::Uuid::new_v4().to_string()] {
        assert_eq!(combat_command(&mut a,rev,json!({"type":"combat.initiative","payload":{"combatantId":id,"expectedVersion":1,"initiative":20}})).await["error"]["code"],"NOT_FOUND_OR_HIDDEN");
    }
    let actor = uuid::Uuid::new_v4().to_string();
    combat_ok(&mut dm, &mut rev, actor_input(&actor, "token-warden")).await;
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":visible,"actorId":actor}}),
    )
    .await;
    let c = combat_read(&h, &camp, &alice).await["combatants"][0].clone();
    assert!(c["actorId"].is_null());
    assert!(c.get("hp").is_none());
    assert!(c.get("maxHp").is_none());
    assert!(c.get("actorVersion").is_none());
    assert_eq!(c["canEditHp"], false);
    combat_ok(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":aid,"permission":"owner"}})).await;
    combat_ok(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":bid,"permission":"observer"}})).await;
    let aview = combat_read(&h, &camp, &alice).await;
    assert_eq!(aview["combatants"][0]["canEditInitiative"], true);
    assert_eq!(aview["combatants"][0]["canEditHp"], true);
    let bview = combat_read(&h, &camp, &bob).await;
    assert_eq!(bview["combatants"][0]["hp"], 12);
    assert_eq!(bview["combatants"][0]["canEditHp"], false);
    assert_eq!(combat_command(&mut b,rev,json!({"type":"combat.hp","payload":{"combatantId":public,"expectedActorId":actor,"expectedActorVersion":1,"hp":8}})).await["error"]["code"],"FORBIDDEN");
    assert_eq!(combat_command(&mut b,rev,json!({"type":"combat.initiative","payload":{"combatantId":public,"expectedVersion":1,"initiative":10}})).await["error"]["code"],"FORBIDDEN");
    combat_ok(&mut a,&mut rev,json!({"type":"combat.initiative","payload":{"combatantId":public,"expectedVersion":1,"initiative":10}})).await;
    combat_ok(&mut a,&mut rev,json!({"type":"combat.hp","payload":{"combatantId":public,"expectedActorId":actor,"expectedActorVersion":1,"hp":8}})).await;
    assert_eq!(combat_command(&mut a,rev,json!({"type":"combat.hp","payload":{"combatantId":public,"expectedActorId":actor,"expectedActorVersion":1,"hp":9}})).await["error"]["code"],"STALE_ACTOR");
    assert_eq!(combat_command(&mut a,rev,json!({"type":"combat.hp","payload":{"combatantId":public,"expectedActorId":actor,"expectedActorVersion":2,"hp":21}})).await["error"]["code"],"VALIDATION_FAILED");
    let row: (i64, i64, String, String, String) =
        sqlx::query_as("SELECT hp,version,name,biography,dm_notes FROM actors WHERE id=?")
            .bind(&actor)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap();
    assert_eq!(
        row,
        (
            8,
            2,
            "Mira Čarodejka".into(),
            "A scholar".into(),
            "SECRET SHEET NOTES".into()
        )
    );
    assert_eq!(combat_read(&h, &camp, &bob).await["combatants"][0]["hp"], 8);
    combat_ok(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":aid,"permission":"none"}})).await;
    assert_eq!(combat_command(&mut a,rev,json!({"type":"combat.hp","payload":{"combatantId":public,"expectedActorId":actor,"expectedActorVersion":2,"hp":7}})).await["error"]["code"],"NOT_FOUND_OR_HIDDEN");
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"fog.configure","payload":{"sceneId":scene,"enabled":true}}),
    )
    .await;
    let raw = through(&mut b, rev).await;
    assert_eq!(raw["encounter"]["combatants"], json!([]));
    assert!(!raw.to_string().contains(&public));
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"token.move","payload":{"tokenId":visible,"x":300,"y":300}}),
    )
    .await;
    combat_ok(&mut dm,&mut rev,json!({"type":"fog.paint","payload":{"sceneId":scene,"column":5,"row":5,"width":1,"height":1,"mode":"reveal"}})).await;
    assert_eq!(
        combat_read(&h, &camp, &bob).await["combatants"],
        json!([]),
        "A partly revealed footprint stays hidden"
    );

    assert_eq!(combat_command(&mut b,rev,json!({"type":"combat.hp","payload":{"combatantId":public,"expectedActorId":actor,"expectedActorVersion":2,"hp":7}})).await["error"]["code"],"NOT_FOUND_OR_HIDDEN");
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":visible,"actorId":null}}),
    )
    .await;
    let unlinked = combat_read(&h, &camp, &owner).await;
    let c = unlinked["combatants"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["id"] == public)
        .unwrap();
    assert!(c["actorId"].is_null());
    assert!(c.get("hp").is_none());
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":visible,"actorId":actor}}),
    )
    .await;
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"scene.conceal","payload":{"sceneId":scene}}),
    )
    .await;
    assert!(combat_read(&h, &camp, &bob).await.is_null());
    assert!(through(&mut b, rev).await["encounter"].is_null());
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "clear", &mut rev).await;
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT hp FROM actors WHERE id=?")
            .bind(actor)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap(),
        8
    );
}

#[tokio::test]
async fn combat_token_visibility_updates_current_snapshot_and_deletions_reconcile_without_resetting_round()
 {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &camp, "alice").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let snap = frame(&mut dm).await;
    let scene = snap["scenes"][0]["id"].as_str().unwrap();
    let tokens = snap["scenes"][0]["tokens"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|t| t["visibility"] == "shared")
        .collect::<Vec<_>>();
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut rev = 0;
    let encounter = combat_create(&h, &mut dm, &camp, &owner, scene, &mut rev).await;
    let first = combat_add(
        &h,
        &mut dm,
        &camp,
        &owner,
        &encounter,
        tokens[0]["id"].as_str().unwrap(),
        &mut rev,
    )
    .await;
    let second = combat_add(
        &h,
        &mut dm,
        &camp,
        &owner,
        &encounter,
        tokens[1]["id"].as_str().unwrap(),
        &mut rev,
    )
    .await;
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "start", &mut rev).await;
    through(&mut a, rev).await;
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"token.visibility","payload":{"tokenId":tokens[0]["id"],"visibility":"dm"}}),
    )
    .await;
    let raw = through(&mut a, rev).await;
    assert_eq!(
        raw["kind"], "snapshot",
        "Combat visibility must replace the current projection"
    );
    assert_eq!(raw["encounter"]["combatants"].as_array().unwrap().len(), 1);
    assert!(raw["encounter"]["activeCombatantId"].is_null());
    assert!(!raw.to_string().contains(&first));
    // Direct token deletion simulates an external host operation between commands.
    sqlx::query("DELETE FROM tokens WHERE id=?")
        .bind(tokens[0]["id"].as_str().unwrap())
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "next", &mut rev).await;
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["activeCombatantId"], second);
    assert_eq!(e["round"], 1);
    sqlx::query("UPDATE combat_encounters SET round=1000000000 WHERE campaign_id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    combat_lifecycle_action(&h, &mut dm, &camp, &owner, "next", &mut rev).await;
    assert_eq!(combat_read(&h, &camp, &owner).await["round"], 1_000_000_000);
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"token.delete","payload":{"tokenId":tokens[1]["id"]}}),
    )
    .await;
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["status"], "preparing");
    assert_eq!(e["round"], 0);
    assert!(e["activeCombatantId"].is_null());
    assert_eq!(e["combatants"], json!([]));
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"scene.delete","payload":{"sceneId":scene}}),
    )
    .await;
    assert!(combat_read(&h, &camp, &owner).await.is_null());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM pragma_foreign_key_check")
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn combat_validates_versions_ids_bounds_scope_and_archive_or_revoked_membership() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let snap = frame(&mut dm).await;
    let scene = snap["scenes"][0]["id"].as_str().unwrap();
    let token = snap["scenes"][0]["tokens"][0]["id"].as_str().unwrap();
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut rev = 0;
    for name in ["", "\tcontrol", &"😀".repeat(81)] {
        assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.create","payload":{"clientEncounterId":uuid::Uuid::new_v4(),"sceneId":scene,"name":name}})).await["error"]["code"],"VALIDATION_FAILED");
    }
    assert_eq!(combat_command(&mut a,rev,json!({"type":"combat.create","payload":{"clientEncounterId":uuid::Uuid::new_v4(),"sceneId":scene,"name":"Denied"}})).await["error"]["code"],"FORBIDDEN");
    let encounter = combat_create(&h, &mut dm, &camp, &owner, scene, &mut rev).await;
    assert_eq!(
        combat_command(
            &mut dm,
            rev,
            json!({"type":"combat.start","payload":{"encounterId":encounter,"expectedVersion":1}})
        )
        .await["error"]["code"],
        "VALIDATION_FAILED"
    );
    let entry = combat_add(&h, &mut dm, &camp, &owner, &encounter, token, &mut rev).await;
    for initiative in [json!(-1001), json!(1001), json!(1.5), json!("12")] {
        assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.initiative","payload":{"combatantId":entry,"expectedVersion":1,"initiative":initiative}})).await["error"]["code"],"VALIDATION_FAILED");
    }
    for version in [0_i64, -1, 9_007_199_254_740_992] {
        assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.initiative","payload":{"combatantId":entry,"expectedVersion":version,"initiative":null}})).await["error"]["code"],"VALIDATION_FAILED");
    }
    assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.initiative","payload":{"combatantId":entry,"expectedVersion":1,"initiative":null,"canEditInitiative":true}})).await["error"]["code"],"VALIDATION_FAILED");
    let (_, other, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Foreign","createDemo":true}),
            Some(&owner),
        )
        .await;
    let other = other["campaign"]["id"].as_str().unwrap();
    let mut foreign = server.connect(other, &owner).await;
    frame(&mut foreign).await;
    assert_eq!(combat_command(&mut foreign,0,json!({"type":"combat.initiative","payload":{"combatantId":entry,"expectedVersion":1,"initiative":12}})).await["error"]["code"],"NOT_FOUND_OR_HIDDEN");
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{other}/combat"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    sqlx::query("UPDATE campaigns SET archived=1 WHERE id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(
        combat_command(
            &mut dm,
            rev,
            json!({"type":"combat.clear","payload":{"encounterId":encounter,"expectedVersion":2}})
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    sqlx::query("UPDATE campaigns SET archived=0 WHERE id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    h.request(
        "POST",
        &format!("/api/campaigns/{camp}/members/{aid}/revoke"),
        json!({}),
        Some(&owner),
    )
    .await;
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/combat"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn combat_enforces_32_entries_unique_tokens_and_scoped_creation_nonces() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let snap = frame(&mut dm).await;
    let scene = snap["scenes"][0]["id"].as_str().unwrap();
    let mut rev = 0;
    let encounter = combat_create(&h, &mut dm, &camp, &owner, scene, &mut rev).await;
    let tokens: Vec<String> = (0..33).map(|_| uuid::Uuid::new_v4().to_string()).collect();
    for token in &tokens {
        sqlx::query("INSERT INTO tokens(id,scene_id,name,x,y,size,color,asset_id,visibility) VALUES(?,?,'Entry',30,30,52,'#ffddaa','token-warden','shared')").bind(token).bind(scene).execute(&h.state.store.pool).await.unwrap();
    }
    let nonce = uuid::Uuid::new_v4().to_string();
    combat_ok(&mut dm,&mut rev,json!({"type":"combat.add","payload":{"encounterId":encounter,"expectedVersion":1,"clientCombatantId":nonce,"tokenId":tokens[0]}})).await;
    assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.add","payload":{"encounterId":encounter,"expectedVersion":2,"clientCombatantId":nonce,"tokenId":tokens[1]}})).await["error"]["code"],"CONFLICT");
    assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.add","payload":{"encounterId":encounter,"expectedVersion":2,"clientCombatantId":uuid::Uuid::new_v4(),"tokenId":tokens[0]}})).await["error"]["code"],"VALIDATION_FAILED");
    for token in &tokens[1..32] {
        combat_add(&h, &mut dm, &camp, &owner, &encounter, token, &mut rev).await;
    }
    let e = combat_read(&h, &camp, &owner).await;
    assert_eq!(e["combatants"].as_array().unwrap().len(), 32);
    assert_eq!(combat_command(&mut dm,rev,json!({"type":"combat.add","payload":{"encounterId":encounter,"expectedVersion":e["version"],"clientCombatantId":uuid::Uuid::new_v4(),"tokenId":tokens[32]}})).await["error"]["code"],"VALIDATION_FAILED");
    // A nonce equal to a foreign entity UUID must not probe the entity namespace.
    let (_, other, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Other","createDemo":true}),
            Some(&owner),
        )
        .await;
    let other = other["campaign"]["id"].as_str().unwrap();
    let mut foreign = server.connect(other, &owner).await;
    let snap = frame(&mut foreign).await;
    assert_eq!(combat_command(&mut foreign,0,json!({"type":"combat.create","payload":{"clientEncounterId":encounter,"sceneId":snap["scenes"][0]["id"],"name":"Scoped"}})).await["kind"],"ack");
}

#[test]
fn combat_commands_require_complete_payloads_and_deny_forged_authority() {
    let id = "00000000-0000-4000-8000-000000000001";
    for payload in [
        json!({"combatantId":id,"expectedVersion":1}),
        json!({"combatantId":id,"expectedVersion":1,"initiative":12,"canEditInitiative":true}),
    ] {
        assert!(
            serde_json::from_value::<hearth_domain::commands::TokenCommand>(
                json!({"type":"combat.initiative","payload":payload})
            )
            .is_err()
        );
    }
    for initiative in [json!(null), json!(-1000), json!(1000)] {
        let cmd:hearth_domain::commands::TokenCommand=serde_json::from_value(json!({"type":"combat.initiative","payload":{"combatantId":id,"expectedVersion":1,"initiative":initiative}})).unwrap();
        assert_eq!(cmd.token_id(), id);
    }
}

#[tokio::test]
async fn combat_hp_draft_cannot_target_a_relinked_actor_with_the_same_version() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let snap = frame(&mut dm).await;
    let scene = snap["scenes"][0]["id"].as_str().unwrap();
    let token = snap["scenes"][0]["tokens"][0]["id"].as_str().unwrap();
    let a = uuid::Uuid::new_v4().to_string();
    let b = uuid::Uuid::new_v4().to_string();
    let mut rev = 0;
    for actor in [&a, &b] {
        combat_ok(&mut dm, &mut rev, actor_input(actor, "token-warden")).await;
    }
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":token,"actorId":a}}),
    )
    .await;
    let encounter = combat_create(&h, &mut dm, &camp, &owner, scene, &mut rev).await;
    let entry = combat_add(&h, &mut dm, &camp, &owner, &encounter, token, &mut rev).await;
    combat_ok(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":token,"actorId":b}}),
    )
    .await;
    let result = combat_command(&mut dm, rev, json!({"type":"combat.hp","payload":{"combatantId":entry,"expectedActorId":a,"expectedActorVersion":1,"hp":4}})).await;
    assert_eq!(
        result["error"]["code"], "STALE_ACTOR",
        "A draft must not update the newly linked actor: {result}"
    );
    let row: (i64, i64) = sqlx::query_as("SELECT hp,version FROM actors WHERE id=?")
        .bind(&b)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(row, (12, 1));
}
