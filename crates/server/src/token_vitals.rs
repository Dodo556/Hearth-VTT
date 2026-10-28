//! Versioned placed-token resources; linked HP stays on the actor record.
use crate::{
    error::{ApiError, ApiResult},
    scenes,
};
use hearth_domain::{Token, TokenHealth, TokenVitals, commands::UpdateTokenVitals};
use serde_json::{Value, json};
use sqlx::SqliteConnection;
const MARKERS: [&str; 6] = [
    "marked",
    "bleeding",
    "poisoned",
    "prone",
    "stunned",
    "concentrating",
];
#[derive(sqlx::FromRow)]
struct Row {
    vitals_version: i64,
    hp: Option<i64>,
    max_hp: Option<i64>,
    hp_visibility: String,
    statuses: String,
    actor_id: Option<String>,
    actor_hp: Option<i64>,
    actor_max: Option<i64>,
    actor_version: Option<i64>,
}
pub(crate) async fn decorate(
    conn: &mut SqliteConnection,
    token: &mut Token,
    dm: bool,
) -> ApiResult<()> {
    let r:Row=sqlx::query_as("SELECT t.vitals_version,t.hp,t.max_hp,t.hp_visibility,t.statuses,t.actor_id,a.hp AS actor_hp,a.max_hp AS actor_max,a.version AS actor_version FROM tokens t LEFT JOIN actors a ON a.id=t.actor_id WHERE t.id=?").bind(&token.id).fetch_one(conn).await?;
    let (hp, max_hp) = if r.actor_id.is_some() {
        (r.actor_hp, r.actor_max)
    } else {
        (r.hp, r.max_hp)
    };
    token.statuses = serde_json::from_str(&r.statuses).map_err(|_| ApiError::internal())?;
    if dm || token.can_move {
        token.vitals = Some(TokenVitals {
            version: r.vitals_version,
            hp,
            max_hp,
            hp_visibility: r.hp_visibility.clone(),
            actor_version: r.actor_version,
        });
    }
    if (dm || token.can_move || r.hp_visibility == "shared")
        && (r.actor_id.is_none() || token.actor_id.is_some())
    {
        if let (Some(hp), Some(max_hp)) = (hp, max_hp) {
            token.health = Some(TokenHealth { hp, max_hp });
        }
    }
    Ok(())
}
fn stale() -> ApiError {
    ApiError(
        axum::http::StatusCode::CONFLICT,
        "STALE_TOKEN_VITALS",
        "This token or its linked sheet changed. Your draft is kept; reload health and status before saving.",
    )
}
pub(crate) async fn apply(
    conn: &mut SqliteConnection,
    camp: &str,
    user: &str,
    dm: bool,
    p: &UpdateTokenVitals,
) -> ApiResult<Value> {
    let token = scenes::projected_scenes(conn, camp, dm, user)
        .await?
        .into_iter()
        .flat_map(|s| s.tokens)
        .find(|t| t.id == p.token_id)
        .ok_or_else(ApiError::hidden)?;
    if !token.can_move {
        return Err(ApiError::forbidden());
    }
    let v = token.vitals.as_ref().ok_or_else(ApiError::hidden)?;
    if !(1..9_007_199_254_740_991).contains(&p.expected_version)
        || p.expected_actor_version
            .is_some_and(|v| !(1..9_007_199_254_740_991).contains(&v))
        || p.expected_actor_id
            .as_ref()
            .is_some_and(|id| uuid::Uuid::parse_str(id).is_err())
        || !matches!(p.hp_visibility.as_str(), "controllers" | "shared")
        || p.statuses.len() > 6
        || p.statuses.iter().any(|s| !MARKERS.contains(&s.as_str()))
        || p.statuses
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len()
            != p.statuses.len()
    {
        return Err(ApiError::invalid(
            "Use current resource versions and the supported unique status markers.",
        ));
    }
    match (p.hp, p.max_hp) {
        (None, None) if token.actor_id.is_none() => {}
        (Some(hp), Some(max)) if (1..=1_000_000).contains(&max) && (0..=max).contains(&hp) => {}
        _ => {
            return Err(ApiError::invalid(
                "Set current and maximum HP together, between zero and a maximum of1–1000000.",
            ));
        }
    }
    if !dm && p.hp_visibility != v.hp_visibility {
        return Err(ApiError::forbidden());
    }
    if p.expected_version != v.version
        || p.expected_actor_id != token.actor_id
        || p.expected_actor_version != v.actor_version
    {
        return Err(stale());
    }
    if let Some(actor) = &token.actor_id
        && (p.hp != v.hp || p.max_hp != v.max_hp)
    {
        let changed = sqlx::query(
            "UPDATE actors SET hp=?,max_hp=?,version=version+1 WHERE id=? AND campaign_id=?",
        )
        .bind(p.hp)
        .bind(p.max_hp)
        .bind(actor)
        .bind(camp)
        .execute(&mut *conn)
        .await?;
        if changed.rows_affected() != 1 {
            return Err(ApiError::hidden());
        }
    }
    sqlx::query("UPDATE tokens SET hp=CASE WHEN actor_id IS NULL THEN ? ELSE hp END,max_hp=CASE WHEN actor_id IS NULL THEN ? ELSE max_hp END,hp_visibility=?,statuses=?,vitals_version=vitals_version+1 WHERE id=?").bind(p.hp).bind(p.max_hp).bind(&p.hp_visibility).bind(serde_json::to_string(&p.statuses).map_err(|_|ApiError::internal())?).bind(&p.token_id).execute(conn).await?;
    Ok(json!({"projection":"snapshot"}))
}
