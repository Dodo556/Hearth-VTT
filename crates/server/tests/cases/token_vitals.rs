fn vitals_save(
    t: &Value,
    hp: Option<i64>,
    max: Option<i64>,
    visibility: &str,
    statuses: Value,
) -> Value {
    json!({"type":"token.vitals.update","payload":{"tokenId":t["id"],"expectedVersion":t["vitals"]["version"],"expectedActorId":t["actorId"],"expectedActorVersion":t["vitals"].get("actorVersion").unwrap_or(&Value::Null),"hp":hp,"maxHp":max,"hpVisibility":visibility,"statuses":statuses}})
}
async fn vitals_token(h: &Host, cookie: &str, camp: &str, id: &str) -> Value {
    let (status, body, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/scenes"),
            json!({}),
            Some(cookie),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    body["scenes"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|s| s["tokens"].as_array().unwrap())
        .find(|t| t["id"] == id)
        .unwrap()
        .clone()
}
#[tokio::test]
async fn token_vitals_enforce_map_privacy_current_events_and_linked_sources() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "vitals_alice").await;
    let (bob, _) = h.player(&owner, &camp, "vitals_bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let initial = frame(&mut dm).await;
    let mut rev = initial["revision"].as_i64().unwrap();
    let token = initial["scenes"][0]["tokens"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["name"].as_str().unwrap().starts_with("Rowan"))
        .unwrap()
        .clone();
    let id = token["id"].as_str().unwrap();
    let scene = initial["scenes"][0]["id"].as_str().unwrap();
    assert_eq!(token["vitals"]["version"], 1);
    assert!(token.get("health").is_none());
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.assign","payload":{"tokenId":id,"userId":aid}}),
    )
    .await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let token = vitals_token(&h, &alice, &camp, id).await;
    let update = vitals_save(
        &token,
        Some(10),
        Some(20),
        "controllers",
        json!(["marked", "poisoned"]),
    );
    assert_eq!(
        command(
            &mut b,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            update.clone()
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    accepted(&mut a, &mut rev, update.clone()).await;
    let visible = through(&mut b, rev).await;
    let public = &visible["scenes"][0]["tokens"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["id"] == id)
        .unwrap();
    assert!(public.get("vitals").is_none());
    assert!(public.get("health").is_none());
    assert_eq!(public["statuses"], json!(["marked", "poisoned"]));
    let owned = vitals_token(&h, &alice, &camp, id).await;
    assert_eq!(owned["health"], json!({"hp":10,"maxHp":20}));
    assert_eq!(
        command(&mut a, &uuid::Uuid::new_v4().to_string(), rev, update).await["error"]["code"],
        "STALE_TOKEN_VITALS"
    );
    assert_eq!(
        command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            vitals_save(&owned, Some(10), Some(20), "shared", json!([]))
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.move","payload":{"tokenId":id,"x":540,"y":660}}),
    )
    .await;
    let movement = through(&mut b, rev).await;
    assert_eq!(movement["kind"], "event");
    assert!(
        movement["payload"]["token"].get("vitals").is_none(),
        "{movement}"
    );
    assert!(
        movement["payload"]["token"].get("health").is_none(),
        "{movement}"
    );
    let request = uuid::Uuid::new_v4().to_string();
    let base = rev;
    let share = vitals_save(&owned, Some(10), Some(20), "shared", json!(["marked"]));
    let ack = command(&mut dm, &request, base, share.clone()).await;
    assert_eq!(ack["kind"], "ack");
    rev = ack["revision"].as_i64().unwrap();
    assert_eq!(
        vitals_token(&h, &bob, &camp, id).await["health"],
        json!({"hp":10,"maxHp":20})
    );
    let actor = uuid::Uuid::new_v4().to_string();
    accepted(&mut dm,&mut rev,json!({"type":"actor.create","payload":{"actorId":actor,"name":"Private linked hero","kind":"character","assetId":token["assetId"],"biography":"","dmNotes":"VITALS ACTOR SECRET","hp":30,"maxHp":40,"attributes":{}}})).await;
    accepted(&mut dm,&mut rev,json!({"type":"actor.permission","payload":{"actorId":actor,"userId":aid,"permission":"owner"}})).await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":id,"actorId":actor}}),
    )
    .await;
    let bound = vitals_token(&h, &alice, &camp, id).await;
    assert_eq!(bound["health"]["hp"], 30);
    assert!(
        vitals_token(&h, &bob, &camp, id)
            .await
            .get("health")
            .is_none()
    );
    let old_linked = vitals_save(&bound, Some(12), Some(40), "shared", json!(["marked"]));
    accepted(&mut a, &mut rev, old_linked.clone()).await;
    let (_, actors, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/actors"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(actors["actors"][0]["hp"], 12);
    assert_eq!(actors["actors"][0]["version"], 2);
    let encounter_nonce = uuid::Uuid::new_v4().to_string();
    accepted(&mut dm,&mut rev,json!({"type":"combat.create","payload":{"clientEncounterId":encounter_nonce,"sceneId":scene,"name":"Vitals encounter"}})).await;
    let (_, combat, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/combat"),
            json!({}),
            Some(&owner),
        )
        .await;
    accepted(&mut dm,&mut rev,json!({"type":"combat.add","payload":{"encounterId":combat["encounter"]["id"],"expectedVersion":combat["encounter"]["version"],"clientCombatantId":uuid::Uuid::new_v4().to_string(),"tokenId":id}})).await;
    let (_, combat, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/combat"),
            json!({}),
            Some(&owner),
        )
        .await;
    let c = &combat["encounter"]["combatants"][0];
    assert_eq!(c["hp"], 12);
    accepted(&mut dm,&mut rev,json!({"type":"combat.hp","payload":{"combatantId":c["id"],"expectedActorId":actor,"expectedActorVersion":2,"hp":9}})).await;
    assert_eq!(vitals_token(&h, &alice, &camp, id).await["health"]["hp"], 9);
    assert_eq!(
        command(&mut a, &uuid::Uuid::new_v4().to_string(), rev, old_linked).await["error"]["code"],
        "STALE_TOKEN_VITALS"
    );
    let current = vitals_token(&h, &alice, &camp, id).await;
    accepted(
        &mut a,
        &mut rev,
        vitals_save(&current, Some(9), Some(40), "shared", json!(["prone"])),
    )
    .await;
    assert_eq!(
        vitals_token(&h, &alice, &camp, id).await["vitals"]["actorVersion"],
        3,
        "Marker-only saves must not invalidate sheet drafts"
    );
    let stale_independent = vitals_save(&owned, Some(5), Some(20), "shared", json!([]));
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":id,"actorId":null}}),
    )
    .await;
    let unlinked = vitals_token(&h, &owner, &camp, id).await;
    assert_eq!(unlinked["health"]["hp"], 10);
    assert!(
        unlinked["vitals"]["version"].as_i64().unwrap()
            > bound["vitals"]["version"].as_i64().unwrap()
    );
    assert_eq!(
        command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            stale_independent
        )
        .await["error"]["code"],
        "STALE_TOKEN_VITALS"
    );
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.link","payload":{"tokenId":id,"actorId":actor}}),
    )
    .await;
    let before = vitals_token(&h, &owner, &camp, id).await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"actor.delete","payload":{"actorId":actor}}),
    )
    .await;
    let after = vitals_token(&h, &owner, &camp, id).await;
    assert!(after["actorId"].is_null());
    assert!(
        after["vitals"]["version"].as_i64().unwrap()
            > before["vitals"]["version"].as_i64().unwrap()
    );
    assert_eq!(
        command(&mut dm, &request, base, share).await["duplicate"],
        true
    );
}

#[tokio::test]
async fn token_vitals_reject_bad_stats_and_recheck_fog_archive_and_permissions() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "vitals_guard").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    let first = frame(&mut dm).await;
    let mut rev = first["revision"].as_i64().unwrap();
    let token = first["scenes"][0]["tokens"][0].clone();
    let id = token["id"].as_str().unwrap();
    let scene = first["scenes"][0]["id"].as_str().unwrap();
    let good = vitals_save(&token, Some(10), Some(20), "controllers", json!([]));
    for (field, value) in [
        ("hp", json!(-1)),
        ("maxHp", json!(0)),
        ("hp", json!(21)),
        ("hp", Value::Null),
        ("statuses", json!(["marked", "marked"])),
        ("statuses", json!(["unknown"])),
        ("expectedVersion", json!(0)),
    ] {
        let mut bad = good.clone();
        bad["payload"][field] = value;
        assert_eq!(
            command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, bad).await["error"]["code"],
            "VALIDATION_FAILED"
        );
    }
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.visibility","payload":{"tokenId":id,"visibility":"shared"}}),
    )
    .await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"token.assign","payload":{"tokenId":id,"userId":aid}}),
    )
    .await;
    let mut player = server.connect(&camp, &alice).await;
    frame(&mut player).await;
    accepted(
        &mut dm,
        &mut rev,
        json!({"type":"fog.configure","payload":{"sceneId":scene,"enabled":true}}),
    )
    .await;
    assert_eq!(
        command(
            &mut player,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            good.clone()
        )
        .await["error"]["code"],
        "NOT_FOUND_OR_HIDDEN"
    );
    let mut foreign = good.clone();
    foreign["payload"]["tokenId"] = json!(uuid::Uuid::new_v4().to_string());
    assert_eq!(
        command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, foreign).await["error"]["code"],
        "NOT_FOUND_OR_HIDDEN"
    );
    sqlx::query("UPDATE campaigns SET archived=1 WHERE id=?")
        .bind(camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(
        command(&mut dm, &uuid::Uuid::new_v4().to_string(), rev, good).await["error"]["code"],
        "FORBIDDEN"
    );
}
