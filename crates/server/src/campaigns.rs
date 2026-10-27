use crate::{
    AppState, auth,
    error::{ApiError, ApiJson, ApiResult},
    security,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use hearth_domain::Campaign;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

type Row = (String, String, String, bool, i64, String, i64);
fn project((id, name, description, archived, created_at, role, scene_count): Row) -> Campaign {
    Campaign {
        id,
        name,
        description,
        archived,
        created_at,
        role,
        scene_count,
    }
}
pub async fn for_user(state: &AppState, user_id: &str, campaign_id: &str) -> ApiResult<Campaign> {
    sqlx::query_as::<_,Row>("SELECT c.id,c.name,c.description,c.archived,c.created_at,m.role,(SELECT COUNT(*) FROM scenes s WHERE s.campaign_id=c.id AND (m.role='dm' OR (s.visibility='shared' AND c.active_scene_id=s.id))) FROM campaigns c JOIN memberships m ON m.campaign_id=c.id WHERE m.user_id=? AND c.id=?")
        .bind(user_id).bind(campaign_id).fetch_optional(&state.store.pool).await?.map(project).ok_or_else(ApiError::hidden)
}
pub async fn require_dm(
    state: &AppState,
    headers: &HeaderMap,
    campaign_id: &str,
) -> ApiResult<hearth_domain::User> {
    let user = auth::require_user(state, headers).await?;
    let campaign = for_user(state, &user.id, campaign_id).await?;
    if campaign.role != "dm" {
        return Err(ApiError::forbidden());
    }
    Ok(user)
}
pub async fn insert_campaign(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    user_id: &str,
    name: &str,
    description: &str,
    demo: bool,
) -> ApiResult<String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO campaigns(id,name,description,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)")
        .bind(&id).bind(name).bind(description).bind(user_id).bind(security::now()).bind(security::now()).execute(&mut **tx).await?;
    sqlx::query("INSERT INTO memberships(campaign_id,user_id,role,created_at) VALUES (?,?,'dm',?)")
        .bind(&id)
        .bind(user_id)
        .bind(security::now())
        .execute(&mut **tx)
        .await?;
    if demo {
        crate::demo::seed(tx, &id).await?;
    }
    Ok(id)
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Create {
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    create_demo: bool,
}
fn validate(name: &str, description: &str) -> ApiResult<()> {
    if name.trim().is_empty() || name.chars().count() > 100 || name.chars().any(char::is_control) {
        return Err(ApiError::invalid(
            "Campaign name must have 1–100 visible characters.",
        ));
    }
    if description.chars().count() > 1000
        || description.chars().any(|c| c.is_control() && c != '\n')
    {
        return Err(ApiError::invalid(
            "Description must be at most 1,000 characters.",
        ));
    }
    Ok(())
}
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    let user = auth::require_user(&state, &headers).await?;
    let rows=sqlx::query_as::<_,Row>("SELECT c.id,c.name,c.description,c.archived,c.created_at,m.role,(SELECT COUNT(*) FROM scenes s WHERE s.campaign_id=c.id AND (m.role='dm' OR (s.visibility='shared' AND c.active_scene_id=s.id))) FROM campaigns c JOIN memberships m ON m.campaign_id=c.id WHERE m.user_id=? ORDER BY c.archived,c.created_at DESC,c.id")
        .bind(user.id).fetch_all(&state.store.pool).await?;
    Ok(Json(
        json!({"schemaVersion":1,"campaigns":rows.into_iter().map(project).collect::<Vec<_>>()}),
    ))
}
pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiJson(input): ApiJson<Create>,
) -> ApiResult<Json<serde_json::Value>> {
    let user = auth::require_user(&state, &headers).await?;
    if !user.is_owner {
        return Err(ApiError::forbidden());
    }
    validate(&input.name, &input.description)?;
    let mut tx = state.store.pool.begin().await?;
    let id = insert_campaign(
        &mut tx,
        &user.id,
        input.name.trim(),
        input.description.trim(),
        input.create_demo,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(
        json!({"schemaVersion":1,"campaign":for_user(&state,&user.id,&id).await?}),
    ))
}
pub async fn detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let user = auth::require_user(&state, &headers).await?;
    Ok(Json(
        json!({"schemaVersion":1,"campaign":for_user(&state,&user.id,&id).await?}),
    ))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Update {
    name: String,
    description: String,
    archived: bool,
}
pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    ApiJson(input): ApiJson<Update>,
) -> ApiResult<Json<serde_json::Value>> {
    let user = require_dm(&state, &headers, &id).await?;
    validate(&input.name, &input.description)?;
    sqlx::query("UPDATE campaigns SET name=?,description=?,archived=?,updated_at=? WHERE id=?")
        .bind(input.name.trim())
        .bind(input.description.trim())
        .bind(input.archived)
        .bind(security::now())
        .bind(&id)
        .execute(&state.store.pool)
        .await?;
    Ok(Json(
        json!({"schemaVersion":1,"campaign":for_user(&state,&user.id,&id).await?}),
    ))
}
pub async fn members(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    require_dm(&state, &headers, &id).await?;
    let rows:Vec<(String,String,String,String)>=sqlx::query_as("SELECT u.id,u.display_name,u.username,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.campaign_id=? ORDER BY m.created_at,u.id")
        .bind(id).fetch_all(&state.store.pool).await?;
    let members:Vec<_>=rows.into_iter().map(|(id,display_name,username,role)|json!({"id":id,"displayName":display_name,"username":username,"role":role})).collect();
    Ok(Json(json!({"schemaVersion":1,"members":members})))
}
pub async fn revoke_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, user_id)): Path<(String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    let user = require_dm(&state, &headers, &id).await?;
    if user.id == user_id {
        return Err(ApiError::conflict(
            "The campaign DM cannot revoke their own membership.",
        ));
    }
    let mut tx = state.store.pool.begin_with("BEGIN IMMEDIATE").await?;
    sqlx::query("DELETE FROM token_controllers WHERE user_id=? AND token_id IN (SELECT t.id FROM tokens t JOIN scenes s ON s.id=t.scene_id WHERE s.campaign_id=?)").bind(&user_id).bind(&id).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM memberships WHERE campaign_id=? AND user_id=? AND role='player'")
        .bind(&id)
        .bind(&user_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    state.live.notify_access();
    Ok(Json(json!({"schemaVersion":1,"ok":true})))
}
