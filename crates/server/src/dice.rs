//! Authoritative entropy, immutable roll records and current per-reader privacy.
use crate::{
    AppState,
    error::{ApiError, ApiResult},
    scenes, security,
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use hearth_domain::{
    Roll,
    commands::RollDice,
    dice::{self, DiceError},
};
use rand::{RngCore, rngs::OsRng};
use serde_json::{Value, json};
fn sampled_face(
    sides: u32,
    fill: &mut impl FnMut(&mut [u8]) -> Result<(), DiceError>,
) -> Result<u32, DiceError> {
    if sides == 0 || sides > 1_000_000 {
        return Err(DiceError::Limit);
    }
    let range = 1u64 << 32;
    let limit = range - range % sides as u64;
    for _ in 0..128 {
        let mut bytes = [0u8; 4];
        fill(&mut bytes)?;
        let value = u32::from_le_bytes(bytes) as u64;
        if value < limit {
            return Ok((value % sides as u64) as u32 + 1);
        }
    }
    Err(DiceError::Entropy)
}
fn result_id(
    fill: &mut impl FnMut(&mut [u8]) -> Result<(), DiceError>,
) -> Result<String, DiceError> {
    let mut bytes = [0u8; 16];
    fill(&mut bytes)?;
    Ok(uuid::Builder::from_random_bytes(bytes)
        .into_uuid()
        .to_string())
}
fn secure_face(sides: u32) -> Result<u32, DiceError> {
    sampled_face(sides, &mut |bytes| {
        OsRng.try_fill_bytes(bytes).map_err(|_| DiceError::Entropy)
    })
}
fn evaluation_error(error: DiceError) -> ApiError {
    match error {
        DiceError::Entropy => ApiError::internal(),
        DiceError::Syntax => {
            ApiError::invalid("Use dice, integers, + - * / and parentheses; for example 2d6+3.")
        }
        DiceError::Limit => ApiError::invalid(
            "Use at most 120 characters, 100 dice, 1000000 sides/constants and 12 nesting levels.",
        ),
        DiceError::Arithmetic => ApiError::invalid(
            "Keep arithmetic finite and within ±1000000000; division by zero is invalid.",
        ),
    }
}
pub(crate) async fn apply(
    conn: &mut sqlx::SqliteConnection,
    campaign: &str,
    user: &str,
    revision: i64,
    p: &RollDice,
) -> ApiResult<Value> {
    crate::recipients::validate(
        conn,
        campaign,
        user,
        matches!(
            p.visibility,
            hearth_domain::commands::RollVisibility::Selected
        ),
        &p.recipient_ids,
    )
    .await?;
    let ast = dice::parse(&p.expression).map_err(evaluation_error)?;
    let existing:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM dice_rolls WHERE campaign_id=?1 AND roller_user_id=?2 AND client_roll_id=?3 UNION ALL SELECT 1 FROM dice_roll_rate WHERE campaign_id=?1 AND user_id=?2 AND client_roll_id=?3)").bind(campaign).bind(user).bind(&p.client_roll_id).fetch_one(&mut *conn).await?;
    if existing {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "ROLL_ID_UNAVAILABLE",
            "Use a new roll ID for a new roll.",
        ));
    }
    let now = security::now();
    let recent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM dice_roll_rate WHERE campaign_id=? AND user_id=? AND accepted_at>?",
    )
    .bind(campaign)
    .bind(user)
    .bind(now - 10)
    .fetch_one(&mut *conn)
    .await?;
    if recent >= 10 {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "ROLL_RATE_LIMITED",
            "Wait a few seconds: at most 10 rolls per 10 seconds.",
        ));
    }
    let result = dice::evaluate(&ast, &mut secure_face).map_err(evaluation_error)?;
    let name: String = sqlx::query_scalar("SELECT display_name FROM users WHERE id=?")
        .bind(user)
        .fetch_one(&mut *conn)
        .await?;
    let roll = Roll {
        id: result_id(&mut |bytes| OsRng.try_fill_bytes(bytes).map_err(|_| DiceError::Entropy))
            .map_err(evaluation_error)?,
        roller_id: user.into(),
        roller_name: name,
        expression: p.expression.trim().into(),
        normalized_expression: ast.normalized(),
        visibility: p.visibility,
        recipient_ids: p.recipient_ids.clone(),
        created_at: now,
        revision,
        total: result.total,
        dice: result.dice,
    };
    let ast_json = serde_json::to_string(&ast).map_err(|_| ApiError::internal())?;
    let result_json = serde_json::to_string(&roll).map_err(|_| ApiError::internal())?;
    sqlx::query("INSERT INTO dice_rolls(id,campaign_id,roller_user_id,client_roll_id,visibility,revision,created_at,ast_json,result_json) VALUES(?,?,?,?,?,?,?,?,?)").bind(&roll.id).bind(campaign).bind(user).bind(&p.client_roll_id).bind(p.visibility.as_str()).bind(revision).bind(now).bind(ast_json).bind(result_json).execute(&mut *conn).await?;
    for recipient in &p.recipient_ids {
        sqlx::query("INSERT INTO dice_recipients(roll_id,user_id) VALUES(?,?)")
            .bind(&roll.id)
            .bind(recipient)
            .execute(&mut *conn)
            .await?;
    }
    sqlx::query("DELETE FROM dice_roll_rate WHERE accepted_at<=?")
        .bind(now - 10)
        .execute(&mut *conn)
        .await?;
    sqlx::query("INSERT INTO dice_roll_rate(roll_id,campaign_id,user_id,accepted_at,client_roll_id) VALUES(?,?,?,?,?)").bind(&roll.id).bind(campaign).bind(user).bind(now).bind(&p.client_roll_id).execute(&mut *conn).await?;
    sqlx::query("DELETE FROM dice_rolls WHERE campaign_id=? AND id NOT IN(SELECT id FROM dice_rolls WHERE campaign_id=? ORDER BY revision DESC LIMIT 1000)").bind(campaign).bind(campaign).execute(conn).await?;
    Ok(json!({"projection":"snapshot"}))
}
pub(crate) async fn projected(
    conn: &mut sqlx::SqliteConnection,
    campaign: &str,
    dm: bool,
    user: &str,
    id: Option<&str>,
) -> ApiResult<Vec<Roll>> {
    let rows:Vec<String>=sqlx::query_scalar("SELECT result_json FROM dice_rolls WHERE campaign_id=? AND (? IS NULL OR id=?) AND (visibility='public' OR (visibility='gm' AND (?=1 OR roller_user_id=?)) OR (visibility='self' AND roller_user_id=?) OR (visibility='blind' AND ?=1) OR (visibility='selected' AND (roller_user_id=? OR EXISTS(SELECT 1 FROM dice_recipients r WHERE r.roll_id=dice_rolls.id AND r.user_id=?)))) ORDER BY revision DESC LIMIT 20").bind(campaign).bind(id).bind(id).bind(dm).bind(user).bind(user).bind(dm).bind(user).bind(user).fetch_all(conn).await?;
    rows.into_iter()
        .map(|row| serde_json::from_str(&row).map_err(|_| ApiError::internal()))
        .collect()
}
pub(crate) async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(campaign): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, user, dm) = scenes::authorized_read(&state, &headers, &campaign).await?;
    Ok(Json(
        json!({"schemaVersion":1,"rolls":projected(&mut tx,&campaign,dm,&user,None).await?}),
    ))
}
pub(crate) async fn detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((campaign, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let (mut tx, user, dm) = scenes::authorized_read(&state, &headers, &campaign).await?;
    let roll = projected(&mut tx, &campaign, dm, &user, Some(&id))
        .await?
        .into_iter()
        .next()
        .ok_or_else(ApiError::hidden)?;
    Ok(Json(json!({"schemaVersion":1,"roll":roll})))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn result_id_entropy_failure_is_fallible_and_ids_are_v4() {
        assert_eq!(
            result_id(&mut |_| Err(DiceError::Entropy)),
            Err(DiceError::Entropy)
        );
        let id = result_id(&mut |bytes| {
            bytes.fill(0);
            Ok(())
        })
        .unwrap();
        let parsed = uuid::Uuid::parse_str(&id).unwrap();
        assert_eq!(parsed.get_version_num(), 4);
        assert_eq!(parsed.get_variant(), uuid::Variant::RFC4122);
    }
    #[test]
    fn entropy_sampler_rejects_bias_and_propagates_failure() {
        let mut calls = 0;
        let result = sampled_face(6, &mut |bytes| {
            calls += 1;
            bytes.copy_from_slice(&if calls == 1 { u32::MAX } else { 42u32 }.to_le_bytes());
            Ok(())
        });
        assert_eq!(result, Ok(1));
        assert_eq!(calls, 2);
        assert_eq!(
            sampled_face(6, &mut |_| Err(DiceError::Entropy)),
            Err(DiceError::Entropy)
        );
        assert_eq!(
            sampled_face(6, &mut |bytes| {
                bytes.fill(255);
                Ok(())
            }),
            Err(DiceError::Entropy)
        );
    }
}
