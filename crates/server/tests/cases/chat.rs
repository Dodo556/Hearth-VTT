fn chat_input(nonce: &str, body: &str, scope: &str, recipients: &[&str]) -> Value {
    json!({"type":"chat.send","payload":{"clientMessageId":nonce,"body":body,"visibility":scope,"recipientIds":recipients}})
}
#[tokio::test]
async fn chat_whispers_selected_rolls_and_nonce_privacy_are_authoritative() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let (bob, bid) = h.player(&owner, &camp, "bob").await;
    let server = LiveServer::start(&h).await;
    let mut dm = server.connect(&camp, &owner).await;
    frame(&mut dm).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut b = server.connect(&camp, &bob).await;
    frame(&mut b).await;
    let (_, roster, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/participants"),
            json!({}),
            Some(&alice),
        )
        .await;
    assert_eq!(roster["participants"].as_array().unwrap().len(), 3);
    for member in roster["participants"].as_array().unwrap() {
        assert!(member.get("username").is_none());
        assert!(member.get("passwordHash").is_none());
    }
    let mut rev = 0;
    let nonce = uuid::Uuid::new_v4().to_string();
    let request = uuid::Uuid::new_v4().to_string();
    let input = chat_input(&nonce, "PRIVATE ALICE BOB MESSAGE", "whisper", &[&bid]);
    let ack = command(&mut a, &request, rev, input.clone()).await;
    assert_eq!(ack["kind"], "ack", "{ack}");
    rev = 1;
    assert_eq!(
        command(&mut a, &request, 0, input.clone()).await["duplicate"],
        true
    );
    let private = through(&mut b, rev).await;
    let page = &private["messages"][0];
    assert_eq!(page["body"], "PRIVATE ALICE BOB MESSAGE");
    assert_eq!(page["senderId"], aid);
    assert_eq!(page["recipientIds"], json!([bid]));
    let message_id = page["id"].as_str().unwrap().to_owned();
    assert_ne!(message_id, nonce);
    assert!(
        !through(&mut dm, rev)
            .await
            .to_string()
            .contains("PRIVATE ALICE BOB MESSAGE")
    );
    let hidden = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/chat/{message_id}"),
            json!({}),
            Some(&owner),
        )
        .await;
    let unknown = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/chat/{}", uuid::Uuid::new_v4()),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!((hidden.0, hidden.1), (unknown.0, unknown.1));
    // Caller nonces are not globally checked against somebody else's private nonce/result.
    accepted(
        &mut dm,
        &mut rev,
        chat_input(&message_id, "Public DM greeting", "public", &[]),
    )
    .await;
    accepted(
        &mut b,
        &mut rev,
        chat_input(&nonce, "Public Bob greeting", "public", &[]),
    )
    .await;
    let repeat = command(&mut a, &uuid::Uuid::new_v4().to_string(), rev, input).await;
    assert_eq!(repeat["error"]["code"], "MESSAGE_ID_UNAVAILABLE");
    let roll = json!({"type":"dice.roll","payload":{"clientRollId":uuid::Uuid::new_v4().to_string(),"expression":"3d1+7","visibility":"selected","recipientIds":[bid]}});
    accepted(&mut a, &mut rev, roll).await;
    let selected = through(&mut b, rev).await;
    assert_eq!(selected["rolls"][0]["total"], 10.0);
    assert_eq!(selected["rolls"][0]["recipientIds"], json!([bid]));
    let rid = selected["rolls"][0]["id"].as_str().unwrap();
    let projection = through(&mut dm, rev).await;
    assert!(!projection.to_string().contains("3d1+7"));
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/rolls/{rid}"),
            json!({}),
            Some(&owner)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let events: Vec<String> =
        sqlx::query_scalar("SELECT payload FROM campaign_events WHERE campaign_id=?")
            .bind(&camp)
            .fetch_all(&h.state.store.pool)
            .await
            .unwrap();
    assert!(
        events
            .iter()
            .all(|e| !e.contains("MESSAGE") && !e.contains("3d1+7") && !e.contains(&message_id))
    );
    for socket in [&mut dm, &mut a, &mut b] {
        socket.close(None).await.unwrap();
    }
}
#[tokio::test]
async fn chat_rejects_forgery_invalid_recipients_archive_and_revocation() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let (bob, bid) = h.player(&owner, &camp, "bob").await;
    let (_, foreign, _) = h
        .request(
            "POST",
            "/api/campaigns",
            json!({"name":"Foreign","description":""}),
            Some(&owner),
        )
        .await;
    let foreign = foreign["campaign"]["id"].as_str().unwrap();
    let (_, fid) = h.player(&owner, foreign, "foreign_user").await;
    let server = LiveServer::start(&h).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    for body in [" ".to_owned(), "x".repeat(1001), "bad\u{0000}".to_owned()] {
        let v = command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            0,
            chat_input(&uuid::Uuid::new_v4().to_string(), &body, "public", &[]),
        )
        .await;
        assert_eq!(v["error"]["code"], "VALIDATION_FAILED", "{v}");
    }
    for (scope, ids) in [
        ("whisper", vec![]),
        ("public", vec![bid.as_str()]),
        ("whisper", vec![aid.as_str()]),
        ("whisper", vec![bid.as_str(), bid.as_str()]),
        ("whisper", vec![fid.as_str()]),
        ("whisper", vec!["00000000-0000-4000-8000-000000000000"]),
    ] {
        let v = command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            0,
            chat_input(&uuid::Uuid::new_v4().to_string(), "Safe", scope, &ids),
        )
        .await;
        assert_eq!(v["error"]["code"], "VALIDATION_FAILED", "{v}");
    }
    let mut forged = chat_input(&uuid::Uuid::new_v4().to_string(), "Bad", "public", &[]);
    forged["payload"]["senderId"] = json!(bid);
    assert_eq!(
        command(&mut a, &uuid::Uuid::new_v4().to_string(), 0, forged).await["kind"],
        "error"
    );
    let invalid_roll = json!({"type":"dice.roll","payload":{"clientRollId":uuid::Uuid::new_v4().to_string(),"expression":"d6","visibility":"public","recipientIds":[bid]}});
    assert_eq!(
        command(&mut a, &uuid::Uuid::new_v4().to_string(), 0, invalid_roll).await["kind"],
        "error"
    );
    let mut rev = 0;
    accepted(
        &mut a,
        &mut rev,
        chat_input(
            &uuid::Uuid::new_v4().to_string(),
            "<script>plain()</script>\nnext",
            "public",
            &[],
        ),
    )
    .await;
    sqlx::query("UPDATE campaigns SET archived=1 WHERE id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    assert_eq!(
        command(
            &mut a,
            &uuid::Uuid::new_v4().to_string(),
            rev,
            chat_input(&uuid::Uuid::new_v4().to_string(), "Blocked", "public", &[])
        )
        .await["error"]["code"],
        "FORBIDDEN"
    );
    h.request(
        "POST",
        &format!("/api/campaigns/{camp}/members/{bid}/revoke"),
        json!({}),
        Some(&owner),
    )
    .await;
    sqlx::query("UPDATE campaigns SET archived=0 WHERE id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    let revoked = command(
        &mut a,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        chat_input(
            &uuid::Uuid::new_v4().to_string(),
            "No delivery",
            "whisper",
            &[&bid],
        ),
    )
    .await;
    assert_eq!(revoked["error"]["code"], "VALIDATION_FAILED");
    for path in [
        format!("/api/campaigns/{camp}/chat"),
        format!("/api/campaigns/{camp}/participants"),
    ] {
        assert_eq!(
            h.request("GET", &path, json!({}), Some(&bob)).await.0,
            StatusCode::NOT_FOUND
        );
    }
    a.close(None).await.unwrap();
}
#[tokio::test]
async fn chat_rate_survives_history_pruning_and_saved_history_survives_reopen() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let server = LiveServer::start(&h).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut rev = 0;
    for _ in 0..10 {
        accepted(
            &mut a,
            &mut rev,
            chat_input(
                &uuid::Uuid::new_v4().to_string(),
                "Saved public text",
                "public",
                &[],
            ),
        )
        .await;
    }
    // Simulate somebody else's full bounded history pushing this sender's records out.
    sqlx::query("DELETE FROM chat_messages WHERE campaign_id=?")
        .bind(&camp)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    let mut another = server.connect(&camp, &alice).await;
    frame(&mut another).await;
    let limited = command(
        &mut another,
        &uuid::Uuid::new_v4().to_string(),
        rev,
        chat_input(&uuid::Uuid::new_v4().to_string(), "Too fast", "public", &[]),
    )
    .await;
    assert_eq!(limited["error"]["code"], "CHAT_RATE_LIMITED");
    sqlx::query("UPDATE chat_rate SET accepted_at_ms=1 WHERE user_id=?")
        .bind(&aid)
        .execute(&h.state.store.pool)
        .await
        .unwrap();
    accepted(
        &mut a,
        &mut rev,
        chat_input(
            &uuid::Uuid::new_v4().to_string(),
            "🧙".repeat(1000).as_str(),
            "public",
            &[],
        ),
    )
    .await;
    let (_, pages, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/chat"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(pages["messages"].as_array().unwrap().len(), 1);
    a.close(None).await.unwrap();
    another.close(None).await.unwrap();
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
    let saved: String = sqlx::query_scalar("SELECT body FROM chat_messages WHERE campaign_id=?")
        .bind(&camp)
        .fetch_one(&store.pool)
        .await
        .unwrap();
    assert_eq!(saved, "🧙".repeat(1000));
    store.pool.close().await;
}

#[tokio::test]
async fn chat_history_filters_before_limit_and_prunes_old_records_and_recipients() {
    let h = Host::new().await;
    let owner = h.owner().await;
    let camp = h.campaign_id(&owner).await;
    let (alice, aid) = h.player(&owner, &camp, "alice").await;
    let (_, bid) = h.player(&owner, &camp, "bob").await;
    let first = uuid::Uuid::new_v4().to_string();
    let mut tx = h.state.store.pool.begin().await.unwrap();
    for n in 1..=1001 {
        let id = if n == 1 {
            first.clone()
        } else {
            uuid::Uuid::new_v4().to_string()
        };
        sqlx::query("INSERT INTO chat_messages(id,campaign_id,sender_user_id,client_message_id,sender_name,body,visibility,created_at,revision) VALUES(?,?,?,?,'Alice',?,?,1,?)")
            .bind(&id).bind(&camp).bind(&aid).bind(&id).bind(if n==1 {"Old visible"} else {"HIDDEN LATER MESSAGE"}).bind(if n==1 {"public"} else {"whisper"}).bind(n).execute(&mut *tx).await.unwrap();
        if n > 1 {
            sqlx::query("INSERT INTO chat_recipients VALUES(?,?)")
                .bind(&id)
                .bind(&bid)
                .execute(&mut *tx)
                .await
                .unwrap();
        }
    }
    sqlx::query("UPDATE campaigns SET revision=1001 WHERE id=?")
        .bind(&camp)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    let (_, visible, _) = h
        .request(
            "GET",
            &format!("/api/campaigns/{camp}/chat"),
            json!({}),
            Some(&owner),
        )
        .await;
    assert_eq!(visible["messages"].as_array().unwrap().len(), 1);
    assert_eq!(visible["messages"][0]["body"], "Old visible");
    let server = LiveServer::start(&h).await;
    let mut a = server.connect(&camp, &alice).await;
    frame(&mut a).await;
    let mut rev = 1001;
    accepted(
        &mut a,
        &mut rev,
        chat_input(&uuid::Uuid::new_v4().to_string(), "Latest", "public", &[]),
    )
    .await;
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM chat_messages WHERE campaign_id=?")
            .bind(&camp)
            .fetch_one(&h.state.store.pool)
            .await
            .unwrap(),
        1000
    );
    assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM chat_recipients r LEFT JOIN chat_messages m ON m.id=r.message_id WHERE m.id IS NULL").fetch_one(&h.state.store.pool).await.unwrap(),0);
    assert_eq!(
        h.request(
            "GET",
            &format!("/api/campaigns/{camp}/chat/{first}"),
            json!({}),
            Some(&alice)
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    a.close(None).await.unwrap();
}

async fn chat_budget(h: &Host, campaign: &str, sender: &str, recipients: &[String], base: i64) {
    let mut tx = h.state.store.pool.begin().await.unwrap();
    for n in 1..=20 {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO chat_messages(id,campaign_id,sender_user_id,client_message_id,sender_name,body,visibility,created_at,revision) VALUES(?,?,?,?,?,?,'whisper',1,?)")
            .bind(&id).bind(campaign).bind(sender).bind(&id).bind("😀".repeat(80)).bind("😀".repeat(1000)).bind(base+n).execute(&mut *tx).await.unwrap();
        for recipient in recipients {
            sqlx::query("INSERT INTO chat_recipients VALUES(?,?)")
                .bind(&id)
                .bind(recipient)
                .execute(&mut *tx)
                .await
                .unwrap();
        }
    }
    sqlx::query("UPDATE campaigns SET revision=? WHERE id=?")
        .bind(base + 20)
        .bind(campaign)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
}
