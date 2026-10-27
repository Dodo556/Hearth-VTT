//! Shared current-member validation; no implicit DM recipient or scope fallback.
use crate::{
    AppState,
    error::{ApiError, ApiResult},
    scenes,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use serde_json::{Value, json};
use sqlx::SqliteConnection;
pub(crate) async fn validate(
    conn: &mut SqliteConnection,
    campaign: &str,
    sender: &str,
    selected: bool,
    ids: &[String],
) -> ApiResult<()> {
    let bad = || {
        ApiError::invalid(
            "Choose 1–8 distinct other current participants for a private selection; public/other scopes need none.",
        )
    };
    if !selected {
        return if ids.is_empty() { Ok(()) } else { Err(bad()) };
    }
    if ids.is_empty() || ids.len() > 8 {
        return Err(bad());
    }
    let mut seen = std::collections::HashSet::new();
    for id in ids {
        if id == sender || uuid::Uuid::parse_str(id).is_err() || !seen.insert(id) {
            return Err(bad());
        }
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM memberships WHERE campaign_id=? AND user_id=?)",
        )
        .bind(campaign)
        .bind(id)
        .fetch_one(&mut *conn)
        .await?;
        if !exists {
            return Err(bad());
        }
    }
    Ok(())
}
pub(crate) async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(campaign): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, _, _) = scenes::authorized_read(&state, &headers, &campaign).await?;
    let rows:Vec<(String,String,String)>=sqlx::query_as("SELECT u.id,u.display_name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.campaign_id=? ORDER BY m.role,u.display_name,u.id").bind(campaign).fetch_all(&mut *tx).await?;
    let participants: Vec<_> = rows
        .into_iter()
        .map(|(id, display_name, role)| json!({"id":id,"displayName":display_name,"role":role}))
        .collect();
    Ok(Json(json!({"schemaVersion":1,"participants":participants})))
}
