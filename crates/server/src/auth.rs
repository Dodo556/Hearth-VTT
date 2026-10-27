use crate::{
    AppState,
    error::{ApiError, ApiJson, ApiResult},
    security,
};
use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::{SaltString, rand_core::OsRng},
};
use axum::{
    Json,
    extract::State,
    http::{HeaderMap, header},
    response::{IntoResponse, Response},
};
use hearth_domain::User;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Credentials {
    pub username: String,
    pub display_name: String,
    pub password: String,
    #[serde(default)]
    pub create_demo: bool,
}
impl Credentials {
    pub fn validate(&mut self) -> ApiResult<()> {
        self.username = self.username.trim().to_ascii_lowercase();
        self.display_name = self.display_name.trim().to_owned();
        if !(3..=32).contains(&self.username.len())
            || !self
                .username
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-')
        {
            return Err(ApiError::invalid(
                "Username must use 3–32 letters, digits, underscores or hyphens.",
            ));
        }
        if self.display_name.is_empty()
            || self.display_name.chars().count() > 64
            || self.display_name.chars().any(char::is_control)
        {
            return Err(ApiError::invalid(
                "Display name must have 1–64 visible characters.",
            ));
        }
        validate_password(&self.password)
    }
}
fn validate_password(password: &str) -> ApiResult<()> {
    if !(12..=128).contains(&password.len()) || password.trim().len() < 12 {
        return Err(ApiError::invalid(
            "Use a password of 12–128 bytes with at least 12 non-padding bytes.",
        ));
    }
    Ok(())
}
pub async fn encode_password(password: String) -> ApiResult<String> {
    tokio::task::spawn_blocking(move || {
        Argon2::default()
            .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng))
            .map(|hash| hash.to_string())
            .map_err(|_| ApiError::internal())
    })
    .await
    .map_err(|_| ApiError::internal())?
}
pub async fn hash_password(state: &AppState, password: String) -> ApiResult<String> {
    let _permit = state
        .password_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| {
            ApiError(
                axum::http::StatusCode::TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "The host is busy. Try again shortly.",
            )
        })?;
    encode_password(password).await
}

pub async fn current_user(state: &AppState, headers: &HeaderMap) -> ApiResult<Option<User>> {
    let Some(token) = security::session_token(headers) else {
        return Ok(None);
    };
    let row: Option<(String,String,String,bool)> = sqlx::query_as("SELECT u.id,u.username,u.display_name,u.is_owner FROM device_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?")
        .bind(security::digest(&token)).bind(security::now()).fetch_optional(&state.store.pool).await?;
    Ok(row.map(|(id, username, display_name, is_owner)| User {
        id,
        username,
        display_name,
        is_owner,
    }))
}
pub async fn require_user(state: &AppState, headers: &HeaderMap) -> ApiResult<User> {
    current_user(state, headers)
        .await?
        .ok_or_else(ApiError::unauthenticated)
}
pub async fn insert_session(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    user_id: &str,
) -> ApiResult<String> {
    let token = security::secret();
    sqlx::query("DELETE FROM device_sessions WHERE expires_at <= ?")
        .bind(security::now())
        .execute(&mut **tx)
        .await?;
    sqlx::query(
        "INSERT INTO device_sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)",
    )
    .bind(security::digest(&token))
    .bind(user_id)
    .bind(security::now() + security::SESSION_SECONDS)
    .bind(security::now())
    .execute(&mut **tx)
    .await?;
    Ok(token)
}
pub fn authenticated_response(state: &AppState, token: &str, body: serde_json::Value) -> Response {
    (
        [(
            header::SET_COOKIE,
            security::cookie(token, state.config.secure_cookie),
        )],
        Json(body),
    )
        .into_response()
}

pub async fn setup(
    State(state): State<AppState>,
    ApiJson(mut credentials): ApiJson<Credentials>,
) -> ApiResult<Response> {
    credentials.validate()?;
    let owners: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM host_profile")
        .fetch_one(&state.store.pool)
        .await?;
    if owners > 0 {
        return Err(ApiError(
            axum::http::StatusCode::CONFLICT,
            "ALREADY_CONFIGURED",
            "This host already has an owner. Sign in instead.",
        ));
    }
    let hash = hash_password(&state, credentials.password).await?;
    let user = User {
        id: Uuid::new_v4().to_string(),
        username: credentials.username,
        display_name: credentials.display_name,
        is_owner: true,
    };
    let mut tx = state.store.pool.begin_with("BEGIN IMMEDIATE").await?;
    let owners: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM host_profile")
        .fetch_one(&mut *tx)
        .await?;
    if owners > 0 {
        return Err(ApiError::conflict(
            "This host already has an owner. Sign in instead.",
        ));
    }
    sqlx::query("INSERT INTO users(id,username,display_name,password_hash,is_owner,created_at) VALUES (?,?,?,?,1,?)")
        .bind(&user.id).bind(&user.username).bind(&user.display_name).bind(hash).bind(security::now()).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO host_profile(singleton,owner_id) VALUES (1,?)")
        .bind(&user.id)
        .execute(&mut *tx)
        .await?;
    if credentials.create_demo {
        crate::campaigns::insert_campaign(
            &mut tx,
            &user.id,
            "The Amber Keep",
            "A forgotten watchtower. Two travelers. One sealed vault.",
            true,
        )
        .await?;
    }
    let token = insert_session(&mut tx, &user.id).await?;
    tx.commit().await?;
    Ok(authenticated_response(
        &state,
        &token,
        json!({"schemaVersion":1,"user":user}),
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Login {
    username: String,
    password: String,
}
pub async fn login(
    State(state): State<AppState>,
    ApiJson(credentials): ApiJson<Login>,
) -> ApiResult<Response> {
    if credentials.username.len() > 32 || credentials.password.len() > 128 {
        return Err(ApiError::invalid("Credentials exceed the allowed length."));
    }
    let row: Option<(String, String)> =
        sqlx::query_as("SELECT id,password_hash FROM users WHERE username=?")
            .bind(credentials.username.trim().to_ascii_lowercase())
            .fetch_optional(&state.store.pool)
            .await?;
    let hash = row
        .as_ref()
        .map(|r| r.1.clone())
        .unwrap_or_else(|| state.dummy_hash.to_string());
    let _permit = state
        .password_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| {
            ApiError(
                axum::http::StatusCode::TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "The host is busy. Try again shortly.",
            )
        })?;
    let verified = tokio::task::spawn_blocking(move || {
        PasswordHash::new(&hash).is_ok_and(|parsed| {
            Argon2::default()
                .verify_password(credentials.password.as_bytes(), &parsed)
                .is_ok()
        })
    })
    .await
    .map_err(|_| ApiError::internal())?;
    let Some((id, _)) = row.filter(|_| verified) else {
        return Err(ApiError(
            axum::http::StatusCode::UNAUTHORIZED,
            "UNAUTHENTICATED",
            "Incorrect username or password.",
        ));
    };
    let mut tx = state.store.pool.begin().await?;
    let token = insert_session(&mut tx, &id).await?;
    tx.commit().await?;
    let mut headers = HeaderMap::new();
    headers.insert(
        header::COOKIE,
        format!("hearth_session={token}")
            .parse()
            .map_err(|_| ApiError::internal())?,
    );
    let user = require_user(&state, &headers).await?;
    Ok(authenticated_response(
        &state,
        &token,
        json!({"schemaVersion":1,"user":user}),
    ))
}
pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    Ok(Json(
        json!({"schemaVersion":1,"user":current_user(&state,&headers).await?}),
    ))
}
pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Response> {
    if let Some(token) = security::session_token(&headers) {
        sqlx::query("DELETE FROM device_sessions WHERE token_hash=?")
            .bind(security::digest(&token))
            .execute(&state.store.pool)
            .await?;
    }
    state.live.notify_access();
    Ok((
        [(header::SET_COOKIE, security::clear_cookie())],
        Json(json!({"schemaVersion":1,"ok":true})),
    )
        .into_response())
}
