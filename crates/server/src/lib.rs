mod actors;
mod auth;
mod authoring;
mod campaigns;
mod chat;
mod combat;
mod commands;
pub mod config;
mod demo;
mod dice;
mod drawings;
pub mod error;
mod fog;
mod invites;
mod journals;
mod live;
mod media;
mod recipients;
mod recovery;
mod scene_notes;
mod scenes;
mod security;
mod token_vitals;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    middleware,
    routing::{get, post},
};
use config::Config;
use hearth_storage::Store;
use security::RateLimiter;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tower_http::services::{ServeDir, ServeFile};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub store: Store,
    limiter: Arc<RateLimiter>,
    password_slots: Arc<Semaphore>,
    upload_slots: Arc<Semaphore>,
    dummy_hash: Arc<str>,
    live: Arc<live::Runtime>,
    recovery: Arc<recovery::Recovery>,
}
impl AppState {
    pub fn shutdown(&self) {
        self.live.stop();
    }
    pub async fn new(config: Config) -> anyhow::Result<Self> {
        config.validate()?;
        let store = Store::open(&config.data_dir).await?;
        let owners: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM host_profile")
            .fetch_one(&store.pool)
            .await?;
        if !config.bind.ip().is_loopback() && owners == 0 {
            anyhow::bail!("Set up the owner on localhost before enabling LAN access");
        }
        let dummy_hash = auth::encode_password(security::secret())
            .await
            .map_err(|_| anyhow::anyhow!("Cannot initialize password hashing"))?;
        Ok(Self {
            config: Arc::new(config),
            live: Arc::new(live::Runtime::default()),
            recovery: Arc::new(recovery::Recovery::default()),
            store,
            limiter: Arc::new(RateLimiter::default()),
            password_slots: Arc::new(Semaphore::new(2)),
            upload_slots: Arc::new(Semaphore::new(2)),
            dummy_hash: Arc::from(dummy_hash),
        })
    }
}

async fn health(State(state): State<AppState>) -> Result<Json<serde_json::Value>, error::ApiError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM host_profile")
        .fetch_one(&state.store.pool)
        .await?;
    Ok(Json(
        json!({"schemaVersion":1,"status":"ok","version":env!("CARGO_PKG_VERSION"),"setupRequired":count == 0}),
    ))
}
async fn missing() -> error::ApiError {
    error::ApiError::hidden()
}

pub fn router(state: AppState) -> Router {
    let static_files = ServeDir::new(&state.config.web_dir)
        .not_found_service(ServeFile::new(state.config.web_dir.join("index.html")));
    Router::new()
        .route("/api/health", get(health))
        .route("/api/host/recovery", get(recovery::status))
        .route("/api/host/backups", post(recovery::create))
        .route("/api/host/backups/{id}", get(recovery::download))
        .route("/api/host/restores/verify", post(recovery::verify))
        .route("/api/host/restores", post(recovery::restore))
        .route("/api/setup/owner", post(auth::setup))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/logout", post(auth::logout))
        .route(
            "/api/campaigns",
            get(campaigns::list).post(campaigns::create),
        )
        .route(
            "/api/campaigns/{id}",
            get(campaigns::detail).patch(campaigns::update),
        )
        .route("/api/campaigns/{id}/members", get(campaigns::members))
        .route("/api/campaigns/{id}/participants", get(recipients::list))
        .route("/api/campaigns/{id}/chat", get(chat::list))
        .route("/api/campaigns/{id}/combat", get(combat::list))
        .route("/api/campaigns/{id}/chat/{message_id}", get(chat::detail))
        .route(
            "/api/campaigns/{id}/members/{user_id}/revoke",
            post(campaigns::revoke_member),
        )
        .route("/api/campaigns/{id}/invites", post(invites::issue))
        .route(
            "/api/campaigns/{id}/invites/{invite_id}/revoke",
            post(invites::revoke),
        )
        .route("/api/invites/redeem", post(invites::redeem))
        .route("/api/campaigns/{id}/ws", get(live::upgrade))
        .route("/api/campaigns/{id}/scenes", get(scenes::list))
        .route("/api/campaigns/{id}/scenes/{scene_id}", get(scenes::detail))
        .route("/api/campaigns/{id}/rolls", get(dice::list))
        .route("/api/campaigns/{id}/rolls/{roll}", get(dice::detail))
        .route("/api/campaigns/{id}/actors", get(actors::list))
        .route("/api/campaigns/{id}/actors/{actor}", get(actors::detail))
        .route("/api/campaigns/{id}/journals", get(scenes::journals))
        .route(
            "/api/campaigns/{id}/journals/{journal_id}",
            get(scenes::journal),
        )
        .route(
            "/api/campaigns/{id}/assets",
            get(media::list).post(media::upload),
        )
        .route("/api/campaigns/{id}/assets/{asset_id}", get(media::read))
        .route("/api", get(missing))
        .route(
            "/api/{*path}",
            get(missing).post(missing).patch(missing).delete(missing),
        )
        .fallback_service(static_files)
        .layer(DefaultBodyLimit::max(16 * 1024))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            security::guard,
        ))
        .with_state(state)
}
