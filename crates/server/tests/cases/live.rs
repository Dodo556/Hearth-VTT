use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{Message, client::IntoClientRequest},
};
type ClientSocket =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

struct LiveServer {
    address: std::net::SocketAddr,
    task: tokio::task::JoinHandle<()>,
}
impl Drop for LiveServer {
    fn drop(&mut self) {
        self.task.abort();
    }
}
impl LiveServer {
    async fn start(host: &Host) -> Self {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let app = host.app.clone();
        let task = tokio::spawn(async move {
            axum::serve(
                listener,
                app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
            )
            .await
            .unwrap();
        });
        Self { address, task }
    }
    fn request(
        &self,
        campaign: &str,
        cookie: Option<&str>,
        origin: &str,
        protocol: &str,
    ) -> tokio_tungstenite::tungstenite::http::Request<()> {
        let mut request = format!("ws://{}/api/campaigns/{campaign}/ws", self.address)
            .into_client_request()
            .unwrap();
        let headers = request.headers_mut();
        headers.insert("host", "localhost:8787".parse().unwrap());
        headers.insert("origin", origin.parse().unwrap());
        headers.insert("sec-websocket-protocol", protocol.parse().unwrap());
        if let Some(cookie) = cookie {
            headers.insert("cookie", cookie.parse().unwrap());
        }
        request
    }
    async fn connect(&self, campaign: &str, cookie: &str) -> ClientSocket {
        let (mut socket, response) = connect_async(self.request(
            campaign,
            Some(cookie),
            "http://localhost:8787",
            "hearth.v1",
        ))
        .await
        .expect("A supported, authenticated WS connection must upgrade");
        assert_eq!(response.headers()["sec-websocket-protocol"], "hearth.v1");
        socket
            .send(Message::Text(
                json!({"kind":"hello","schemaVersion":1,"lastRevision":null})
                    .to_string()
                    .into(),
            ))
            .await
            .unwrap();
        socket
    }
}
async fn frame(socket: &mut ClientSocket) -> Value {
    loop {
        let message = tokio::time::timeout(std::time::Duration::from_secs(4), socket.next())
            .await
            .expect("Timed out waiting for server frame")
            .expect("Socket closed")
            .unwrap();
        if let Message::Text(text) = message {
            return serde_json::from_str(&text).unwrap();
        }
    }
}
async fn command(socket: &mut ClientSocket, id: &str, revision: i64, action: Value) -> Value {
    let message = json!({"kind":"command","schemaVersion":1,"requestId":id,"baseRevision":revision,"command":action});
    socket
        .send(Message::Text(message.to_string().into()))
        .await
        .unwrap();
    loop {
        let reply = frame(socket).await;
        if reply["kind"] == "ack" || reply["kind"] == "error" {
            return reply;
        }
    }
}

#[tokio::test]
async fn websocket_rejects_missing_auth_foreign_origins_and_incompatible_protocols() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let server = LiveServer::start(&host).await;
    for (cookie, origin, protocol, status) in [
        (None, "http://localhost:8787", "hearth.v1", 401),
        (
            Some(owner.as_str()),
            "http://evil.example",
            "hearth.v1",
            403,
        ),
        (
            Some(owner.as_str()),
            "http://localhost:8787",
            "hearth.v99",
            400,
        ),
    ] {
        let error = connect_async(server.request(&id, cookie, origin, protocol))
            .await
            .unwrap_err();
        match error {
            tokio_tungstenite::tungstenite::Error::Http(response) => {
                assert_eq!(response.status().as_u16(), status)
            }
            other => panic!("Unexpected socket error: {other}"),
        }
    }
}

#[tokio::test]
async fn live_commands_enforce_ownership_dedupe_reconnect_and_hidden_projection() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let (alice, alice_id) = host.player(&owner, &id, "alice").await;
    let (bob, _) = host.player(&owner, &id, "bob").await;
    let server = LiveServer::start(&host).await;
    let mut dm = server.connect(&id, &owner).await;
    let snapshot = frame(&mut dm).await;
    assert_eq!(snapshot["kind"], "snapshot");
    assert_eq!(snapshot["revision"], 0);
    let token = snapshot["scenes"][0]["tokens"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["visibility"] == "shared")
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let hidden = snapshot["scenes"][0]["tokens"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["visibility"] == "dm")
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let mut a = server.connect(&id, &alice).await;
    let player_snapshot = frame(&mut a).await;
    assert!(!player_snapshot.to_string().contains("sentinel"));
    assert!(!player_snapshot.to_string().contains("clapper"));
    let hidden_reply = command(
        &mut a,
        &uuid::Uuid::new_v4().to_string(),
        0,
        json!({"type":"token.move","payload":{"tokenId":hidden,"x":630,"y":690}}),
    )
    .await;
    let unknown_reply = command(&mut a,&uuid::Uuid::new_v4().to_string(),0,json!({"type":"token.move","payload":{"tokenId":uuid::Uuid::new_v4().to_string(),"x":630,"y":690}})).await;
    assert_eq!(
        hidden_reply["error"], unknown_reply["error"],
        "Unknown and hidden token movement must not reveal existence"
    );
    let mut b = server.connect(&id, &bob).await;
    let _ = frame(&mut b).await;
    let assign = json!({"type":"token.assign","payload":{"tokenId":token,"userId":alice_id}});
    let ack = command(&mut dm, &uuid::Uuid::new_v4().to_string(), 0, assign).await;
    assert_eq!(ack["kind"], "ack");
    assert_eq!(ack["revision"], 1);
    let event = frame(&mut a).await;
    assert_eq!(event["revision"], 1);
    assert_eq!(event["payload"]["token"]["canMove"], true);
    let _ = frame(&mut b).await;
    let movement = json!({"type":"token.move","payload":{"tokenId":token,"x":630,"y":690}});
    let denied = command(
        &mut b,
        &uuid::Uuid::new_v4().to_string(),
        1,
        movement.clone(),
    )
    .await;
    assert_eq!(denied["error"]["code"], "FORBIDDEN");
    let request = uuid::Uuid::new_v4().to_string();
    let ack = command(&mut a, &request, 1, movement.clone()).await;
    assert_eq!(ack["revision"], 2);
    let duplicate = command(&mut a, &request, 1, movement).await;
    assert_eq!(duplicate["duplicate"], true);
    assert_eq!(duplicate["revision"], 2);
    let collision = command(
        &mut a,
        &request,
        1,
        json!({"type":"token.move","payload":{"tokenId":token,"x":690,"y":690}}),
    )
    .await;
    assert_eq!(collision["error"]["code"], "REQUEST_ID_REUSED");
    let stale = command(
        &mut a,
        &uuid::Uuid::new_v4().to_string(),
        0,
        json!({"type":"token.move","payload":{"tokenId":token,"x":690,"y":690}}),
    )
    .await;
    assert_eq!(stale["error"]["code"], "STALE_REVISION");
    let hide = command(
        &mut dm,
        &uuid::Uuid::new_v4().to_string(),
        2,
        json!({"type":"token.visibility","payload":{"tokenId":token,"visibility":"dm"}}),
    )
    .await;
    assert_eq!(hide["revision"], 3);
    let mut reconnected = server.connect(&id, &alice).await;
    let fresh = frame(&mut reconnected).await;
    assert_eq!(fresh["revision"], 3);
    assert!(!fresh.to_string().contains(&token));
    assert!(!fresh.to_string().contains(&hidden));
    let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM command_receipts")
        .fetch_one(&host.state.store.pool)
        .await
        .unwrap();
    assert_eq!(before, 3);
    for socket in [&mut dm, &mut a, &mut b, &mut reconnected] {
        let _ = socket.close(None).await;
    }
}

#[tokio::test]
async fn live_boundaries_concurrency_and_revocation_are_authoritative() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let (alice, alice_id) = host.player(&owner, &id, "alice").await;
    let server = LiveServer::start(&host).await;
    let mut dm = server.connect(&id, &owner).await;
    let snapshot = frame(&mut dm).await;
    let token = snapshot["scenes"][0]["tokens"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    for (x, y) in [(-1.0, 100.0), (1.0e100, 100.0), (100.0, -1.0)] {
        let result = command(
            &mut dm,
            &uuid::Uuid::new_v4().to_string(),
            0,
            json!({"type":"token.move","payload":{"tokenId":token,"x":x,"y":y}}),
        )
        .await;
        assert_eq!(result["error"]["code"], "VALIDATION_FAILED");
    }
    let mut other = server.connect(&id, &owner).await;
    let _ = frame(&mut other).await;
    let action = json!({"type":"token.move","payload":{"tokenId":token,"x":630,"y":690}});
    let a_id = uuid::Uuid::new_v4().to_string();
    let b_id = uuid::Uuid::new_v4().to_string();
    let (a, b) = tokio::join!(
        command(&mut dm, &a_id, 0, action.clone()),
        command(&mut other, &b_id, 0, action)
    );
    assert_eq!([&a, &b].iter().filter(|v| v["kind"] == "ack").count(), 1);
    assert_eq!(
        [&a, &b]
            .iter()
            .filter(|v| v["error"]["code"] == "STALE_REVISION")
            .count(),
        1
    );
    let mut player = server.connect(&id, &alice).await;
    let _ = frame(&mut player).await;
    host.request(
        "POST",
        &format!("/api/campaigns/{id}/members/{alice_id}/revoke"),
        json!({}),
        Some(&owner),
    )
    .await;
    assert_eq!(frame(&mut player).await["code"], "ACCESS_REVOKED");
    let (_, _, new_cookie) = host
        .request(
            "POST",
            "/api/auth/login",
            json!({"username":"gamemaster","password":"a long strong password"}),
            None,
        )
        .await;
    let mut expires = server.connect(&id, &new_cookie.unwrap()).await;
    let _ = frame(&mut expires).await;
    sqlx::query("UPDATE device_sessions SET expires_at=0")
        .execute(&host.state.store.pool)
        .await
        .unwrap();
    assert_eq!(frame(&mut expires).await["code"], "ACCESS_REVOKED");
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM command_receipts")
            .fetch_one(&host.state.store.pool)
            .await
            .unwrap(),
        1
    );
}

#[tokio::test]
async fn saved_commands_and_dedupe_receipts_survive_a_host_restart() {
    let host = Host::new().await;
    let owner = host.owner().await;
    let id = host.campaign_id(&owner).await;
    let config = (*host.state.config).clone();
    let root = host._dir.path().to_owned();
    let server = LiveServer::start(&host).await;
    let mut dm = server.connect(&id, &owner).await;
    let snapshot = frame(&mut dm).await;
    let token = snapshot["scenes"][0]["tokens"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let request = uuid::Uuid::new_v4().to_string();
    let action = json!({"type":"token.move","payload":{"tokenId":token,"x":930,"y":810}});
    assert_eq!(
        command(&mut dm, &request, 0, action.clone()).await["revision"],
        1
    );
    let stream = snapshot["streamId"].clone();
    dm.close(None).await.unwrap();
    host.state.shutdown();
    drop(server);
    // Wait for upgraded connections to release their Store clones/host lock.
    let Host { app, state, _dir } = host;
    drop(app);
    state.store.pool.close().await;
    drop(state);
    let mut restarted = None;
    for _ in 0..40 {
        match AppState::new(config.clone()).await {
            Ok(s) => {
                restarted = Some(s);
                break;
            }
            Err(_) => tokio::time::sleep(std::time::Duration::from_millis(25)).await,
        }
    }
    let state = restarted.expect("Old host must release its data lock");
    let host = Host {
        app: hearth_server::router(state.clone()),
        state,
        _dir,
    };
    assert!(root.join("hearth.db").exists());
    let server = LiveServer::start(&host).await;
    let mut dm = server.connect(&id, &owner).await;
    let fresh = frame(&mut dm).await;
    assert_eq!(fresh["revision"], 1);
    assert_ne!(fresh["streamId"], stream);
    let moved = fresh["scenes"][0]["tokens"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["id"] == token)
        .unwrap();
    assert_eq!(moved["x"], 930.0);
    assert_eq!(moved["y"], 810.0);
    let ack = command(&mut dm, &request, 0, action).await;
    assert_eq!(ack["duplicate"], true);
    assert_eq!(ack["revision"], 1);
}

#[tokio::test]
async fn map_pings_reach_current_members_only_for_revealed_active_shared_scenes_without_persistence()
 {
    let host = Host::new().await;
    let owner = host.owner().await;
    let campaign = host.campaign_id(&owner).await;
    let (alice, alice_id) = host.player(&owner, &campaign, "alice").await;
    let (bob, _) = host.player(&owner, &campaign, "bob").await;
    let server = LiveServer::start(&host).await;
    let mut dm = server.connect(&campaign, &owner).await;
    let snapshot = frame(&mut dm).await;
    let scene = snapshot["scenes"][0]["id"].as_str().unwrap().to_owned();
    let mut a = server.connect(&campaign, &alice).await;
    let _ = frame(&mut a).await;
    let mut b = server.connect(&campaign, &bob).await;
    let _ = frame(&mut b).await;
    let revision = snapshot["revision"].as_i64().unwrap();
    let ping = |scene: &str, x: f64, y: f64| json!({"kind":"ping","schemaVersion":1,"sceneId":scene,"x":x,"y":y});
    a.send(Message::Text(ping(&scene, 121.0, 181.0).to_string().into()))
        .await
        .unwrap();
    let received = frame(&mut b).await;
    assert_eq!(received["kind"], "ping");
    assert_eq!(received["sceneId"], scene);
    assert_eq!(received["senderId"], alice_id);
    assert_eq!(received["x"], 121.0);
    assert_eq!(received["y"], 181.0);
    assert!(uuid::Uuid::parse_str(received["pingId"].as_str().unwrap()).is_ok());
    assert_eq!(frame(&mut a).await["pingId"], received["pingId"]);
    assert_eq!(frame(&mut dm).await["pingId"], received["pingId"]);
    let after: i64 = sqlx::query_scalar("SELECT revision FROM campaigns WHERE id=?")
        .bind(&campaign)
        .fetch_one(&host.state.store.pool)
        .await
        .unwrap();
    assert_eq!(
        after, revision,
        "A ping must not create a saved campaign revision"
    );

    // A valid private scene ID must not be exposed through the transient channel.
    let draft = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at,visibility) SELECT ?,campaign_id,'Private draft',width,height,grid_size,background_asset_id,created_at+1,'dm' FROM scenes WHERE id=?")
        .bind(&draft).bind(&scene).execute(&host.state.store.pool).await.unwrap();
    for message in [
        ping(&draft, 121.0, 181.0),
        ping(&scene, -1.0, 181.0),
        ping(&scene, 99999.0, 181.0),
    ] {
        dm.send(Message::Text(message.to_string().into()))
            .await
            .unwrap();
    }
    assert!(
        tokio::time::timeout(std::time::Duration::from_millis(250), b.next())
            .await
            .is_err(),
        "Private and out-of-bounds pings must not reach players"
    );

    sqlx::query("UPDATE scenes SET fog_enabled=1,fog_bits=X'' WHERE id=?")
        .bind(&scene)
        .execute(&host.state.store.pool)
        .await
        .unwrap();
    dm.send(Message::Text(ping(&scene, 121.0, 181.0).to_string().into()))
        .await
        .unwrap();
    assert!(
        tokio::time::timeout(std::time::Duration::from_millis(250), b.next())
            .await
            .is_err(),
        "A fog-covered point must not reach players"
    );
    sqlx::query("UPDATE scenes SET fog_enabled=0 WHERE id=?")
        .bind(&scene)
        .execute(&host.state.store.pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM memberships WHERE campaign_id=? AND user_id=?")
        .bind(&campaign)
        .bind(&alice_id)
        .execute(&host.state.store.pool)
        .await
        .unwrap();
    a.send(Message::Text(ping(&scene, 121.0, 181.0).to_string().into()))
        .await
        .unwrap();
    assert!(
        tokio::time::timeout(std::time::Duration::from_millis(250), b.next())
            .await
            .is_err(),
        "A revoked user must not send a ping"
    );
}
