fn roll_input(id: &str, expression: &str, visibility: &str) -> Value {
    json!({"type":"dice.roll","payload":{"clientRollId":id,"expression":expression,"visibility":visibility}})
}
#[tokio::test]
async fn dice_scopes_dedupe_projection_and_persistence_are_authoritative() {
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
    let mut rev = 0;
    let mut saved = Vec::new();
    for (scope, dm_visible, a_visible, b_visible) in [
        ("public", true, true, true),
        ("gm", true, true, false),
        ("self", false, true, false),
        ("blind", true, false, false),
    ] {
        let id = uuid::Uuid::new_v4().to_string();
        let request = uuid::Uuid::new_v4().to_string();
        let command_value = roll_input(&id, "2d6+3", scope);
        let base = rev;
        let ack = command(&mut a, &request, rev, command_value.clone()).await;
        assert_eq!(ack["kind"], "ack", "{ack}");
        rev = ack["revision"].as_i64().unwrap();
        assert!(ack.get("roll").is_none());
        assert!(ack.get("total").is_none());
        assert_eq!(
            command(&mut a, &request, base, command_value.clone()).await["duplicate"],
            true
        );
        let id: String = sqlx::query_scalar(
            "SELECT id FROM dice_rolls WHERE campaign_id=? AND client_roll_id=?",
        )
        .bind(&camp)
        .bind(&id)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
        for (socket, cookie, visible) in [(&mut dm, &owner, dm_visible), (&mut b, &bob, b_visible)]
        {
            let projection = through(socket, rev).await;
            let rolls = projection["rolls"].as_array().unwrap();
            assert_eq!(
                rolls.iter().any(|r| r["id"] == id),
                visible,
                "scope {scope}: {projection}"
            );
            let (status, detail, _) = h
                .request(
                    "GET",
                    &format!("/api/campaigns/{camp}/rolls/{id}"),
                    json!({}),
                    Some(cookie),
                )
                .await;
            assert_eq!(
                status,
                if visible {
                    StatusCode::OK
                } else {
                    StatusCode::NOT_FOUND
                }
            );
            if visible {
                assert!((5.0..=15.0).contains(&detail["roll"]["total"].as_f64().unwrap()));
                assert_eq!(
                    detail["roll"]["dice"][0]["faces"].as_array().unwrap().len(),
                    2
                );
            }
        }
        let (_, history, _) = h
            .request(
                "GET",
                &format!("/api/campaigns/{camp}/rolls"),
                json!({}),
                Some(&alice),
            )
            .await;
        assert_eq!(
            history["rolls"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["id"] == id),
            a_visible
        );
        if scope == "blind" {
            let hidden = h
                .request(
                    "GET",
                    &format!("/api/campaigns/{camp}/rolls/{id}"),
                    json!({}),
                    Some(&alice),
                )
                .await;
            let unknown = h
                .request(
                    "GET",
                    &format!("/api/campaigns/{camp}/rolls/{}", uuid::Uuid::new_v4()),
                    json!({}),
                    Some(&alice),
                )
                .await;
            assert_eq!((hidden.0, hidden.1), (unknown.0, unknown.1));
        }
        assert_eq!(
            command(&mut a, &request, base, roll_input(&id, "d20", scope)).await["error"]["code"],
            "REQUEST_ID_REUSED"
        );
        saved.push(id);
    }
    let rows: Vec<(String, String)> =
        sqlx::query_as("SELECT id,result_json FROM dice_rolls ORDER BY revision")
            .fetch_all(&h.state.store.pool)
            .await
            .unwrap();
    assert_eq!(rows.len(), 4);
    for (id, result) in &rows {
        let data: Value = serde_json::from_str(result).unwrap();
        assert_eq!(data["id"], *id);
        assert!(data.get("dice").is_some());
    }
    let mut fresh = server.connect(&camp, &alice).await;
    let snapshot = frame(&mut fresh).await;
    assert_eq!(snapshot["rolls"].as_array().unwrap().len(), 3);
    assert!(!snapshot.to_string().contains(&saved[3]));
    dm.close(None).await.unwrap();
    a.close(None).await.unwrap();
    b.close(None).await.unwrap();
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
    let reopened: Vec<(String, String)> =
        sqlx::query_as("SELECT id,result_json FROM dice_rolls ORDER BY revision")
            .fetch_all(&store.pool)
            .await
            .unwrap();
    assert_eq!(rows, reopened);
    store.pool.close().await;
}

#[tokio::test]
async fn dice_forgery_rate_archive_and_foreign_reads_are_bounded() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let server = LiveServer::start(&h).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut rev = 0;
    let forged = uuid::Uuid::new_v4().to_string();
    let mut body = roll_input(&forged, "d6", "public");
    body["payload"]["total"] = json!(100);
    assert_eq!(
        command(&mut a, &uuid::Uuid::new_v4().to_string(), rev, body).await["error"]["code"],
        "VALIDATION_FAILED"
    );
    for text in ["0d6", "101d6", "1/0", "1000000*1000000", "process.exit()"] {
        assert_eq!(
            command(
                &mut a,
                &uuid::Uuid::new_v4().to_string(),
                rev,
                roll_input(&uuid::Uuid::new_v4().to_string(), text, "public")
            )
            .await["error"]["code"],
            "VALIDATION_FAILED"
        );
    }
    let request = uuid::Uuid::new_v4().to_string();
    let first = uuid::Uuid::new_v4().to_string();
    let original = roll_input(&first, "d1+2", "public");
    let ack = command(&mut a, &request, rev, original.clone()).await;
    assert_eq!(ack["kind"], "ack");
    rev += 1;
    for _ in 0..9 {
        accepted(
            &mut a,
            &mut rev,
            roll_input(&uuid::Uuid::new_v4().to_string(), "d6", "public"),
        )
        .await;
    }
    let first: String =
        sqlx::query_scalar("SELECT id FROM dice_rolls WHERE campaign_id=? AND client_roll_id=?")
            .bind(&camp)
            .bind(&first)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap();
    // History eviction must not replenish the separate per-user roll budget.
    sqlx::query("DELETE FROM dice_rolls WHERE campaign_id=? AND id<>?")
        .bind(&camp)
        .bind(&first)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    // A fresh connection cannot bypass the persisted per-user/campaign limit.
    let mut fresh = server.connect(&camp, &alice).await;
    frame(&mut fresh).await;
    assert_eq!(
        command(
            &mut fresh,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            roll_input(&uuid::Uuid::new_v4().to_string(), "d6", "public")
        )
        .await["error"]["code"],
        "ROLL_RATE_LIMITED"
    );
    assert_eq!(
        command(&mut fresh, &request, 0, original.clone()).await["duplicate"],
        true
    );
    assert_eq!(
        command(&mut fresh, &uuid::Uuid::new_v4().to_string(), rev, original).await["error"]["code"],
        "ROLL_ID_UNAVAILABLE"
    );
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM dice_rolls")
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    let (_, other, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Other"}),
            Some(&owner),
        )
        .await;
    let other = other["campaign"]["id"].as_str().unwrap();
    let foreign = h
        .request(
            "GET",
            &format!("/api/campaigns/{other}/rolls/{first}"),
            json!({}),
            Some(&owner),
        )
        .await;
    let unknown = h
        .request(
            "GET",
            &format!("/api/campaigns/{other}/rolls/{}", uuid::Uuid::new_v4()),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!((foreign.0, foreign.1), (unknown.0, unknown.1));
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
        command(
            &mut fresh,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            roll_input(&uuid::Uuid::new_v4().to_string(), "d6", "public")
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
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
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls/{first}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let denied = frame(&mut fresh).await;
    assert_eq!(denied["kind"], "closing");
    assert_eq!(denied["code"], "ACCESS_REVOKED");
}

#[tokio::test]
async fn dice_retention_filters_before_history_limit_and_keeps_older_details() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let owner_id: String = sqlx::query_scalar("SELECT id FROM users WHERE is_owner=1")
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    let mut tx = h.state.store.pool.begin().await.unwrap();
    let mut oldest = String::new();
    for revision in 1..=1000 {
        let id = uuid::Uuid::new_v4().to_string();
        if revision == 1 {
            oldest = id.clone();
        }
        let scope = if revision <= 25 { "public" } else { "self" };
        let result = json!({"id":id,"rollerId":owner_id,"rollerName":"DM","expression":"d1","normalizedExpression":"1d1","visibility":scope,"createdAt":1,"revision":revision,"total":1,"dice":[{"count":1,"sides":1,"faces":[1],"subtotal":1}]});
        sqlx::query("INSERT INTO dice_rolls(id,campaign_id,roller_user_id,visibility,revision,created_at,ast_json,result_json,client_roll_id) VALUES(?,?,?,?,?,?,?,?,?)")
            .bind(&id)
            .bind(&camp)
            .bind(&owner_id)
            .bind(scope)
            .bind(revision)
            .bind(1i64)
            .bind("{}")
            .bind(result.to_string())
            .bind(&id)
            .execute(&mut *tx)
            .await
            .unwrap();
    }
    sqlx::query("UPDATE campaigns SET revision=1000 WHERE id=?")
        .bind(&camp)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    let (_, body, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(body["rolls"].as_array().unwrap().len(), 20);
    assert_eq!(body["rolls"][0]["revision"], 25);
    assert_eq!(body["rolls"][19]["revision"], 6);
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls/{oldest}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::OK
    );
    let server = LiveServer::start(&h).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut rev = 1000;
    accepted(
        &mut a,
        &mut rev,
        roll_input(&uuid::Uuid::new_v4().to_string(), "d1", "self"),
    )
    .await;
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM dice_rolls")
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap(),
        1000
    );
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls/{oldest}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let (_, body, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(body["rolls"][0]["rollerId"], aid);
}

async fn dice_budget(h: &Host, camp: &str, roller: &str, base: i64, recipients: &[String]) {
    let expression = ["8d1000000"; 12].join("+");
    let ast = hearth_domain::dice::parse(&expression).unwrap();
    let result = hearth_domain::dice::evaluate(&ast, &mut |s| Ok(s)).unwrap();
    let mut tx = h.state.store.pool.begin().await.unwrap();
    for n in 1..=20 {
        let roll = hearth_domain::Roll {
            id: uuid::Uuid::new_v4().to_string(),
            roller_id: roller.into(),
            roller_name: "😀".repeat(80),
            expression: expression.clone(),
            normalized_expression: ast.normalized(),
            visibility: hearth_domain::commands::RollVisibility::Selected,
            recipient_ids: recipients.to_vec(),
            created_at: 1,
            revision: base + n,
            total: result.total,
            dice: result.dice.clone(),
        };
        sqlx::query("INSERT INTO dice_rolls(id,campaign_id,roller_user_id,visibility,revision,created_at,ast_json,result_json,client_roll_id) VALUES(?,?,?,?,?,?,?,?,?)")
            .bind(&roll.id)
            .bind(camp)
            .bind(roller)
            .bind("selected")
            .bind(base + n)
            .bind(1i64)
            .bind(serde_json::to_string(&ast).unwrap())
            .bind(serde_json::to_string(&roll).unwrap())
            .bind(&roll.id)
            .execute(&mut *tx)
            .await
            .unwrap();
        for recipient in recipients {
            sqlx::query("INSERT INTO dice_recipients VALUES(?,?)")
                .bind(&roll.id)
                .bind(recipient)
                .execute(&mut *tx)
                .await
                .unwrap();
        }
    }
    sqlx::query("UPDATE campaigns SET revision=? WHERE id=?")
        .bind(base + 20)
        .bind(camp)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
}

#[tokio::test]
async fn dice_creation_ids_cannot_probe_other_users_private_or_foreign_records() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, _) = h.player(&owner, &camp, "alice").await;
    let (bob, _) = h.player(&owner, &camp, "bob").await;
    let server = LiveServer::start(&h).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let nonce = uuid::Uuid::new_v4().to_string();
    let mut rev = 0;
    accepted(&mut a, &mut rev, roll_input(&nonce, "d1+8", "self")).await;
    let private: String = sqlx::query_scalar("SELECT id FROM dice_rolls WHERE campaign_id=?")
        .bind(&camp)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    let snapshot = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls/{private}"),
            json!({}),
            Some(&alice),
        )
        .await
        .1;
    let response = command(
        &mut b,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        roll_input(&private, "d1", "public"),
    )
    .await;
    assert_eq!(
        response["kind"], "ack",
        "A known private UUID cannot change a caller's creation outcome: {response}"
    );
    rev = response["revision"].as_i64().unwrap();
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls/{private}"),
            json!({}),
            Some(&alice)
        )
        .await
        .1,
        snapshot
    );
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls/{private}"),
            json!({}),
            Some(&bob)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        command(
            &mut b,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            roll_input(&private, "d20", "public")
        )
        .await["error"]["code"],
        "ROLL_ID_UNAVAILABLE"
    );
    let (_, other, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Foreign"}),
            Some(&owner),
        )
        .await;
    let other = other["campaign"]["id"].as_str().unwrap();
    let mut dm = server.connect(other, &owner).await;
    frame(&mut dm).await;
    let mut other_rev = 0;
    accepted(
        &mut dm,
        &mut other_rev,
        roll_input(&uuid::Uuid::new_v4().to_string(), "d1+16", "self"),
    )
    .await;
    let foreign: String = sqlx::query_scalar("SELECT id FROM dice_rolls WHERE campaign_id=?")
        .bind(other)
        .fetch_one(&h.state.store.pool)
        .await
        .unwrap();
    accepted(&mut b, &mut rev, roll_input(&foreign, "d1", "public")).await;
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM dice_rolls")
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap(),
        4
    );
}
