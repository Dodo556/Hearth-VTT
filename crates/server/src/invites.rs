use crate::{
    AppState,
    auth::{self, Credentials},
    campaigns,
    error::{ApiError, ApiJson, ApiResult},
    security,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
    response::Response,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Issue {
    expires_in_hours: i64,
}
pub async fn issue(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    ApiJson(input): ApiJson<Issue>,
) -> ApiResult<Json<serde_json::Value>> {
    let user = campaigns::require_dm(&state, &headers, &id).await?;
    if !(1..=168).contains(&input.expires_in_hours) {
        return Err(ApiError::invalid(
            "Invitation lifetime must be 1–168 hours.",
        ));
    }
    let invite_id = Uuid::new_v4().to_string();
    let code = security::secret();
    let expires_at = security::now() + input.expires_in_hours * 3600;
    sqlx::query("INSERT INTO invites(id,campaign_id,code_hash,created_by,expires_at,created_at) VALUES (?,?,?,?,?,?)")
        .bind(&invite_id).bind(id).bind(security::digest(&code)).bind(user.id).bind(expires_at).bind(security::now()).execute(&state.store.pool).await?;
    Ok(Json(
        json!({"schemaVersion":1,"invite":{"id":invite_id,"code":code,"expiresAt":expires_at}}),
    ))
}
pub async fn revoke(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, invite_id)): Path<(String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    campaigns::require_dm(&state, &headers, &id).await?;
    sqlx::query("UPDATE invites SET revoked_at=? WHERE id=? AND campaign_id=?")
        .bind(security::now())
        .bind(invite_id)
        .bind(id)
        .execute(&state.store.pool)
        .await?;
    Ok(Json(json!({"schemaVersion":1,"ok":true})))
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Redeem {
    code: String,
    username: String,
    display_name: String,
    password: String,
}
pub async fn redeem(
    State(state): State<AppState>,
    ApiJson(input): ApiJson<Redeem>,
) -> ApiResult<Response> {
    if input.code.len() != 64 || !input.code.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(ApiError::invalid(
            "This invitation is invalid, expired or already used.",
        ));
    }
    let mut credentials = Credentials {
        username: input.username,
        display_name: input.display_name,
        password: input.password,
        create_demo: false,
    };
    credentials.validate()?;
    let code_hash = security::digest(&input.code);
    let valid:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM invites WHERE code_hash=? AND expires_at>? AND used_at IS NULL AND revoked_at IS NULL)")
        .bind(&code_hash).bind(security::now()).fetch_one(&state.store.pool).await?;
    if !valid {
        return Err(ApiError::invalid(
            "This invitation is invalid, expired or already used.",
        ));
    }
    let hash = auth::hash_password(&state, credentials.password).await?;
    let mut tx = state.store.pool.begin_with("BEGIN IMMEDIATE").await?;
    let row:Option<(String,String)>=sqlx::query_as("SELECT id,campaign_id FROM invites WHERE code_hash=? AND expires_at>? AND used_at IS NULL AND revoked_at IS NULL")
        .bind(code_hash).bind(security::now()).fetch_optional(&mut *tx).await?;
    let Some((invite_id, campaign_id)) = row else {
        return Err(ApiError::invalid(
            "This invitation is invalid, expired or already used.",
        ));
    };
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username=?)")
        .bind(&credentials.username)
        .fetch_one(&mut *tx)
        .await?;
    if exists {
        return Err(ApiError::conflict(
            "That username is unavailable. Choose another username.",
        ));
    }
    let user = hearth_domain::User {
        id: Uuid::new_v4().to_string(),
        username: credentials.username,
        display_name: credentials.display_name,
        is_owner: false,
    };
    sqlx::query("INSERT INTO users(id,username,display_name,password_hash,is_owner,created_at) VALUES (?,?,?,?,0,?)")
        .bind(&user.id).bind(&user.username).bind(&user.display_name).bind(hash).bind(security::now()).execute(&mut *tx).await?;
    sqlx::query(
        "INSERT INTO memberships(campaign_id,user_id,role,created_at) VALUES (?,?,'player',?)",
    )
    .bind(&campaign_id)
    .bind(&user.id)
    .bind(security::now())
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE invites SET used_at=? WHERE id=?")
        .bind(security::now())
        .bind(invite_id)
        .execute(&mut *tx)
        .await?;
    let token = auth::insert_session(&mut tx, &user.id).await?;
    tx.commit().await?;
    Ok(auth::authenticated_response(
        &state,
        &token,
        json!({"schemaVersion":1,"user":user,"campaignId":campaign_id}),
    ))
}
