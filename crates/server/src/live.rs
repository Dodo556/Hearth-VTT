//! Bounded connections, fresh authorized snapshots, ordered filtered deltas.
use crate::{
    AppState, auth, campaigns, commands,
    error::{ApiError, ApiResult},
    scenes, security,
};
use axum::{
    extract::{
        Path, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::{HeaderMap, StatusCode},
    response::Response,
};
use futures_util::SinkExt;
use hearth_domain::commands::ClientFrame;
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};
use tokio::sync::{OwnedSemaphorePermit, Semaphore, broadcast, watch};

pub(crate) struct Runtime {
    notices: broadcast::Sender<()>,
    pings: broadcast::Sender<MapPing>,
    shutdown: watch::Sender<bool>,
    slots: Arc<Semaphore>,
    users: Mutex<HashMap<String, usize>>,
    stream_id: String,
    access_epoch: AtomicU64,
}
impl Default for Runtime {
    fn default() -> Self {
        Self {
            notices: broadcast::channel(64).0,
            pings: broadcast::channel(64).0,
            shutdown: watch::channel(false).0,
            slots: Arc::new(Semaphore::new(64)),
            users: Mutex::new(HashMap::new()),
            stream_id: uuid::Uuid::new_v4().to_string(),
            access_epoch: AtomicU64::new(0),
        }
    }
}

#[derive(Clone)]
struct MapPing {
    campaign: String,
    scene: String,
    sender: String,
    id: String,
    x: f64,
    y: f64,
}

// A ping is deliberately ephemeral, but its location must still be authorized
// when it is created and again when each subscriber receives it.
async fn allowed_ping(
    state: &AppState,
    campaign: &str,
    session: &str,
    scene: &str,
    x: f64,
    y: f64,
) -> ApiResult<Option<String>> {
    if uuid::Uuid::parse_str(scene).is_err() || !x.is_finite() || !y.is_finite() {
        return Ok(None);
    }
    let mut tx = state.store.pool.begin().await?;
    let (user, _) = commands::access(&mut tx, session, campaign).await?;
    let dimensions: Option<(i64, i64)> = sqlx::query_as(
        "SELECT s.width,s.height FROM scenes s JOIN campaigns c ON c.id=s.campaign_id WHERE s.id=? AND s.campaign_id=? AND s.visibility='shared' AND c.active_scene_id=s.id AND c.archived=0",
    )
    .bind(scene)
    .bind(campaign)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((width, height)) = dimensions else {
        return Ok(None);
    };
    if x < 0.0 || y < 0.0 || x >= width as f64 || y >= height as f64 {
        return Ok(None);
    }
    let fog = crate::fog::Mask::load(&mut tx, campaign, scene).await?;
    let visible = fog.visible(x.floor() + 0.5, y.floor() + 0.5, 1.0);
    tx.commit().await?;
    Ok(visible.then_some(user))
}
impl Runtime {
    pub(crate) fn notify(&self) {
        let _ = self.notices.send(());
    }
    pub(crate) fn notify_access(&self) {
        self.access_epoch.fetch_add(1, Ordering::SeqCst);
        self.notify();
    }
    pub(crate) fn stop(&self) {
        self.shutdown.send_replace(true);
    }
    fn reserve(self: &Arc<Self>, user: String) -> ApiResult<Reservation> {
        let permit = self
            .slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| capacity())?;
        let mut users = self.users.lock().map_err(|_| ApiError::internal())?;
        let count = users.entry(user.clone()).or_default();
        if *count >= 4 {
            return Err(capacity());
        }
        *count += 1;
        Ok(Reservation {
            runtime: self.clone(),
            user,
            _permit: permit,
        })
    }
}
struct Reservation {
    runtime: Arc<Runtime>,
    user: String,
    _permit: OwnedSemaphorePermit,
}
impl Drop for Reservation {
    fn drop(&mut self) {
        if let Ok(mut users) = self.runtime.users.lock()
            && let Some(count) = users.get_mut(&self.user)
        {
            *count -= 1;
            if *count == 0 {
                users.remove(&self.user);
            }
        }
    }
}
fn capacity() -> ApiError {
    ApiError(
        StatusCode::TOO_MANY_REQUESTS,
        "CONNECTION_LIMIT",
        "The host connection limit has been reached.",
    )
}

pub(crate) async fn upgrade(
    State(state): State<AppState>,
    Path(campaign): Path<String>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> ApiResult<Response> {
    let origin = headers
        .get("origin")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(ApiError::forbidden)?;
    if !state.config.origins.iter().any(|allowed| allowed == origin) {
        return Err(ApiError::forbidden());
    }
    let user = auth::require_user(&state, &headers).await?;
    campaigns::for_user(&state, &user.id, &campaign).await?;
    if !ws.requested_protocols().any(|p| p == "hearth.v1") {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "UNSUPPORTED_PROTOCOL",
            "Use the hearth.v1 subprotocol.",
        ));
    }
    let session =
        security::digest(&security::session_token(&headers).ok_or_else(ApiError::unauthenticated)?);
    let reservation = state.live.reserve(user.id)?;
    Ok(ws
        .protocols(["hearth.v1"])
        .max_frame_size(16 * 1024)
        .max_message_size(16 * 1024)
        .write_buffer_size(0)
        .max_write_buffer_size(4 * 1024 * 1024)
        .on_upgrade(move |socket| run(socket, state, campaign, session, reservation)))
}
async fn send(socket: &mut WebSocket, value: Value) -> ApiResult<()> {
    tokio::time::timeout(
        Duration::from_secs(3),
        socket.send(Message::Text(value.to_string().into())),
    )
    .await
    .map_err(|_| ApiError::internal())?
    .map_err(|_| ApiError::internal())
}
fn error(request: Option<&str>, error: ApiError) -> Value {
    json!({"kind":"error","schemaVersion":1,"requestId":request,"error":{"code":error.1,"message":error.2}})
}
struct View {
    epoch: u64,
    revision: i64,
    known: HashSet<String>,
}
async fn snapshot(
    state: &AppState,
    campaign: &str,
    session: &str,
    view: &mut View,
) -> ApiResult<Value> {
    view.epoch = state.live.access_epoch.load(Ordering::SeqCst);
    let mut tx = state.store.pool.begin().await?;
    let (user, role) = commands::access(&mut tx, session, campaign).await?;
    let revision: i64 = sqlx::query_scalar("SELECT revision FROM campaigns WHERE id=?")
        .bind(campaign)
        .fetch_one(&mut *tx)
        .await?;
    let scenes = scenes::projected_scenes(&mut tx, campaign, role == "dm", &user).await?;
    let journals = scenes::projected_journals(&mut tx, campaign, role == "dm").await?;
    let actors = crate::actors::projected(&mut tx, campaign, role == "dm", &user).await?;
    let encounter =
        crate::combat::projected(&mut tx, campaign, role == "dm", &scenes, &actors).await?;
    let rolls = crate::dice::projected(&mut tx, campaign, role == "dm", &user, None).await?;
    let messages = crate::chat::projected(&mut tx, campaign, &user, None).await?;
    tx.commit().await?;
    view.revision = revision;
    view.known = scenes
        .iter()
        .flat_map(|s| s.tokens.iter().map(|t| t.id.clone()))
        .collect();
    Ok(
        json!({"kind":"snapshot","schemaVersion":1,"streamId":state.live.stream_id,"revision":revision,"role":role,"scenes":scenes,"journals":journals,"actors":actors,"rolls":rolls,"messages":messages,"encounter":encounter,"serverTime":security::now()}),
    )
}
trait FrameSink {
    fn write(&mut self, value: Value) -> impl std::future::Future<Output = ApiResult<()>> + Send;
}
impl FrameSink for WebSocket {
    async fn write(&mut self, value: Value) -> ApiResult<()> {
        send(self, value).await
    }
}
async fn flush(
    socket: &mut (impl FrameSink + Send),
    state: &AppState,
    campaign: &str,
    session: &str,
    view: &mut View,
) -> ApiResult<()> {
    if view.epoch != state.live.access_epoch.load(Ordering::SeqCst) {
        return socket
            .write(snapshot(state, campaign, session, view).await?)
            .await;
    }
    let mut tx = state.store.pool.begin().await?;
    commands::access(&mut tx, session, campaign).await?;
    let revision: i64 = sqlx::query_scalar("SELECT revision FROM campaigns WHERE id=?")
        .bind(campaign)
        .fetch_one(&mut *tx)
        .await?;
    if revision == view.revision {
        return Ok(());
    }
    let events:Vec<(i64,String,String)>=sqlx::query_as("SELECT revision,event_id,payload FROM campaign_events WHERE campaign_id=? AND revision>? ORDER BY revision LIMIT 256").bind(campaign).bind(view.revision).fetch_all(&mut *tx).await?;
    if events.first().map(|e| e.0) != Some(view.revision + 1)
        || events.last().map(|e| e.0) != Some(revision)
    {
        tx.rollback().await?;
        let fresh = snapshot(state, campaign, session, view).await?;
        return socket.write(fresh).await;
    }
    tx.commit().await?;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    for (revision, event_id, payload) in events {
        if tokio::time::Instant::now() >= deadline {
            return Err(ApiError::internal());
        }
        // Reauthorize after every awaited send. A previous batch projection can
        // become privileged while a slow connection is draining its queue.
        let mut tx = state.store.pool.begin().await?;
        let (user, role) = commands::access(&mut tx, session, campaign).await?;
        let current = scenes::projected_scenes(&mut tx, campaign, role == "dm", &user).await?;
        let current: HashMap<_, _> = current
            .into_iter()
            .flat_map(|s| s.tokens)
            .map(|t| (t.id.clone(), t))
            .collect();
        tx.commit().await?;
        let mut data: Value = serde_json::from_str(&payload).map_err(|_| ApiError::internal())?;
        if data["projection"] == "snapshot" {
            return socket
                .write(snapshot(state, campaign, session, view).await?)
                .await;
        }
        let was_public = data["sceneWasPublic"].as_bool().unwrap_or(true)
            && data["tokenWasVisible"].as_bool().unwrap_or(true);
        data.as_object_mut()
            .ok_or_else(ApiError::internal)?
            .remove("tokenWasVisible");
        data.as_object_mut()
            .ok_or_else(ApiError::internal)?
            .remove("sceneWasPublic");
        let id = data["token"]["id"]
            .as_str()
            .ok_or_else(ApiError::internal)?
            .to_owned();
        let visible = current
            .get(&id)
            .filter(|_| role == "dm" || was_public && data["token"]["visibility"] == "shared");
        let (kind, payload) = if let Some(token) = visible {
            data["token"]["actorId"] = json!(token.actor_id);
            data["token"]["canMove"] = json!(token.can_move);
            data["token"]["controllerUserId"] = json!(token.controller_user_id);
            view.known.insert(id.clone());
            ("token.upsert", data)
        } else if view.known.remove(&id) {
            (
                "token.removed",
                json!({"sceneId":data["sceneId"],"tokenId":id}),
            )
        } else {
            ("sync.cursor", json!({}))
        };
        tokio::time::timeout_at(deadline, socket.write(json!({"kind":"event","schemaVersion":1,"streamId":state.live.stream_id,"eventId":event_id,"revision":revision,"type":kind,"payload":payload,"serverTime":security::now()}))).await.map_err(|_|ApiError::internal())??;
        view.revision = revision;
    }
    Ok(())
}
async fn run(
    mut socket: WebSocket,
    state: AppState,
    campaign: String,
    session: String,
    _reservation: Reservation,
) {
    let mut notices = state.live.notices.subscribe();
    let mut pings = state.live.pings.subscribe();
    let mut shutdown = state.live.shutdown.subscribe();
    let hello = tokio::time::timeout(Duration::from_secs(5), socket.recv()).await;
    if !matches!(hello,Ok(Some(Ok(Message::Text(ref text)))) if matches!(serde_json::from_str::<ClientFrame>(text),Ok(ClientFrame::Hello{schema_version:1,last_revision}) if last_revision.is_none_or(|r| (0..=9_007_199_254_740_991).contains(&r))))
    {
        let _ = send(
            &mut socket,
            error(
                None,
                ApiError::invalid("Begin with a supported hello frame."),
            ),
        )
        .await;
        return;
    }
    let mut view = View {
        epoch: 0,
        revision: 0,
        known: HashSet::new(),
    };
    match snapshot(&state, &campaign, &session, &mut view).await {
        Ok(value) => {
            if send(&mut socket, value).await.is_err() {
                return;
            }
        }
        Err(_) => return,
    }
    let mut tick = tokio::time::interval(Duration::from_secs(1));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut window = Instant::now();
    let mut frames = 0u32;
    let mut last_receive = Instant::now();
    let mut last_ping = Instant::now();
    let mut last_map_ping: Option<Instant> = None;
    loop {
        if *shutdown.borrow() {
            let _ = send(
                &mut socket,
                json!({"kind":"closing","schemaVersion":1,"code":"HOST_SHUTTING_DOWN"}),
            )
            .await;
            break;
        }
        tokio::select! {
            _=shutdown.changed()=>continue,
            _=notices.recv()=>{},
            received=pings.recv()=> {
                if let Ok(ping)=received
                    && ping.campaign==campaign
                    && matches!(allowed_ping(&state,&campaign,&session,&ping.scene,ping.x,ping.y).await,Ok(Some(_)))
                    && send(&mut socket,json!({"kind":"ping","schemaVersion":1,"pingId":ping.id,"sceneId":ping.scene,"senderId":ping.sender,"x":ping.x,"y":ping.y})).await.is_err()
                {break;}
            },
            _=tick.tick()=> {
                if last_receive.elapsed()>Duration::from_secs(45) {break;}
                if last_ping.elapsed()>Duration::from_secs(15) {if socket.send(Message::Ping(Vec::new().into())).await.is_err(){break;}last_ping=Instant::now();}
            },
            message=socket.recv()=> {
                let Some(Ok(message))=message else {break;};last_receive=Instant::now();
                if window.elapsed()>=Duration::from_secs(1) {window=Instant::now();frames=0;}
                frames+=1;if frames>20 {let _=send(&mut socket,error(None,capacity())).await;break;}
                match message {
                    Message::Text(text)=>match serde_json::from_str::<ClientFrame>(&text) {
                        Ok(ClientFrame::Command{schema_version:1,request_id,base_revision,command})=> {
                            // Flush before ack, so the browser observes committed state first.
                            let result=commands::execute(&state,&session,&campaign,&request_id,base_revision,command).await;
                            if flush(&mut socket,&state,&campaign,&session,&mut view).await.is_err() {break;}
                            let value=result.unwrap_or_else(|e|error(Some(&request_id),e));
                            if send(&mut socket,value).await.is_err(){break;}
                        },
                        Ok(ClientFrame::Ping{schema_version:1,scene_id,x,y})=> {
                            if last_map_ping.is_none_or(|last|last.elapsed()>=Duration::from_millis(500))
                                && let Ok(Some(sender))=allowed_ping(&state,&campaign,&session,&scene_id,x,y).await
                            {
                                last_map_ping=Some(Instant::now());
                                let _=state.live.pings.send(MapPing{campaign:campaign.clone(),scene:scene_id,sender,id:uuid::Uuid::new_v4().to_string(),x,y});
                            }
                        },
                        _=>if send(&mut socket,error(None,ApiError::invalid("Unsupported or malformed live frame."))).await.is_err(){break;}
                    },
                    Message::Close(_)=>break,
                    Message::Binary(_)=>break,
                    _=>{},
                }
            }
        }
        if flush(&mut socket, &state, &campaign, &session, &mut view)
            .await
            .is_err()
        {
            let _ = send(
                &mut socket,
                json!({"kind":"closing","schemaVersion":1,"code":"ACCESS_REVOKED"}),
            )
            .await;
            break;
        }
    }
    let _ = tokio::time::timeout(Duration::from_secs(1), socket.close()).await;
}

#[cfg(test)]
mod tests;
