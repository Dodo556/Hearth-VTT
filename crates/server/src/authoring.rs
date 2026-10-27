//! DM authoring runs inside the same revision/receipt transaction as movement.
use crate::{
    error::{ApiError, ApiResult},
    scenes, security,
};
use hearth_domain::commands::{TokenCommand, Visibility};
use serde_json::{Value, json};
use sqlx::SqliteConnection;
fn name(value: &str) -> ApiResult<&str> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 80 || value.chars().any(char::is_control) {
        return Err(ApiError::invalid(
            "Use a name with 1–80 characters and no control characters.",
        ));
    }
    Ok(value)
}
pub(crate) async fn asset(
    conn: &mut SqliteConnection,
    campaign: &str,
    id: &str,
) -> ApiResult<(i64, i64)> {
    if let Some(dimensions) = match id {
        "amber-map" => Some((1440, 960)),
        "token-warden" | "token-scout" | "vault-sentinel" => Some((256, 256)),
        _ => None,
    } {
        return Ok(dimensions);
    }
    sqlx::query_as("SELECT width,height FROM assets WHERE campaign_id=? AND id=?")
        .bind(campaign)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(ApiError::hidden)
}
async fn scene(conn: &mut SqliteConnection, campaign: &str, id: &str) -> ApiResult<(i64, i64)> {
    sqlx::query_as("SELECT width,height FROM scenes WHERE campaign_id=? AND id=?")
        .bind(campaign)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(ApiError::hidden)
}
fn bounds(size: f64, x: f64, y: f64, width: i64, height: i64) -> ApiResult<()> {
    if !size.is_finite()
        || !(16.0..=256.0).contains(&size)
        || !x.is_finite()
        || !y.is_finite()
        || x < size / 2.0
        || y < size / 2.0
        || x > width as f64 - size / 2.0
        || y > height as f64 - size / 2.0
    {
        return Err(ApiError::invalid(
            "Use a token size of 16–256 pixels and keep it entirely inside the scene.",
        ));
    }
    Ok(())
}
async fn token_payload(
    conn: &mut SqliteConnection,
    campaign: &str,
    user: &str,
    id: &str,
) -> ApiResult<Value> {
    for scene in scenes::projected_scenes(conn, campaign, true, user).await? {
        if let Some(token) = scene.tokens.into_iter().find(|t| t.id == id) {
            return Ok(json!({"sceneId":scene.id,"token":token}));
        }
    }
    Err(ApiError::hidden())
}
pub(crate) async fn apply(
    conn: &mut SqliteConnection,
    campaign: &str,
    user: &str,
    command: &TokenCommand,
) -> ApiResult<Value> {
    match command {
        TokenCommand::SceneRename(p) => {
            scene(conn, campaign, &p.scene_id).await?;
            let current: String = sqlx::query_scalar("SELECT name FROM scenes WHERE id=?")
                .bind(&p.scene_id)
                .fetch_one(&mut *conn)
                .await?;
            if current != p.expected_name {
                return Err(ApiError(
                    axum::http::StatusCode::CONFLICT,
                    "STALE_SCENE",
                    "This scene name changed. Reload the latest name before saving.",
                ));
            }
            sqlx::query("UPDATE scenes SET name=? WHERE id=?")
                .bind(name(&p.name)?)
                .bind(&p.scene_id)
                .execute(&mut *conn)
                .await?;
            Ok(json!({"projection":"snapshot"}))
        }
        TokenCommand::SceneDelete(p) => {
            scene(conn, campaign, &p.scene_id).await?;
            sqlx::query("DELETE FROM scenes WHERE id=?")
                .bind(&p.scene_id)
                .execute(&mut *conn)
                .await?;
            Ok(json!({"projection":"snapshot"}))
        }

        TokenCommand::SceneCreate(p) => {
            let name = name(&p.name)?;
            if !(20..=256).contains(&p.grid_size) {
                return Err(ApiError::invalid("Use a grid size of 20–256 pixels."));
            }
            let (width, height) = asset(conn, campaign, &p.asset_id).await?;
            if width < 64 || height < 64 {
                return Err(ApiError::invalid(
                    "Scene maps must be at least 64 pixels on each side.",
                ));
            }
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM scenes WHERE campaign_id=?")
                .bind(campaign)
                .fetch_one(&mut *conn)
                .await?;
            if count >= 8 {
                return Err(ApiError::invalid(
                    "This campaign has reached its 8-scene limit.",
                ));
            }
            let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM scenes WHERE id=?)")
                .bind(&p.scene_id)
                .fetch_one(&mut *conn)
                .await?;
            if exists {
                return Err(ApiError::conflict("Use a new scene ID."));
            }
            sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at,visibility) VALUES(?,?,?,?,?,?,?,?,'dm')").bind(&p.scene_id).bind(campaign).bind(name).bind(width).bind(height).bind(p.grid_size).bind(&p.asset_id).bind(security::now()).execute(&mut *conn).await?;
            Ok(json!({"projection":"snapshot"}))
        }
        TokenCommand::SceneActivate(p) | TokenCommand::SceneConceal(p) => {
            scene(conn, campaign, &p.scene_id).await?;
            if matches!(command, TokenCommand::SceneActivate(_)) {
                sqlx::query("UPDATE scenes SET visibility='shared' WHERE id=?")
                    .bind(&p.scene_id)
                    .execute(&mut *conn)
                    .await?;
                sqlx::query("UPDATE campaigns SET active_scene_id=? WHERE id=?")
                    .bind(&p.scene_id)
                    .bind(campaign)
                    .execute(&mut *conn)
                    .await?;
            } else {
                sqlx::query("UPDATE scenes SET visibility='dm' WHERE id=?")
                    .bind(&p.scene_id)
                    .execute(&mut *conn)
                    .await?;
                sqlx::query(
                    "UPDATE campaigns SET active_scene_id=NULL WHERE id=? AND active_scene_id=?",
                )
                .bind(campaign)
                .bind(&p.scene_id)
                .execute(&mut *conn)
                .await?;
            }
            Ok(json!({"projection":"snapshot"}))
        }
        TokenCommand::Create(p) => {
            let name = name(&p.name)?;
            let (width, height) = scene(conn, campaign, &p.scene_id).await?;
            asset(conn, campaign, &p.asset_id).await?;
            bounds(p.size, p.x, p.y, width, height)?;
            let count:i64=sqlx::query_scalar("SELECT COUNT(*) FROM tokens t JOIN scenes s ON t.scene_id=s.id WHERE s.campaign_id=?").bind(campaign).fetch_one(&mut *conn).await?;
            if count >= 100 {
                return Err(ApiError::invalid(
                    "This campaign has reached its 100-token limit.",
                ));
            }
            let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tokens WHERE id=?)")
                .bind(&p.token_id)
                .fetch_one(&mut *conn)
                .await?;
            if exists {
                return Err(ApiError::conflict("Use a new token ID."));
            }
            sqlx::query("INSERT INTO tokens(id,scene_id,name,x,y,size,color,asset_id,visibility) VALUES(?,?,?,?,?,?,'#dbb969',?,?)").bind(&p.token_id).bind(&p.scene_id).bind(name).bind(p.x).bind(p.y).bind(p.size).bind(&p.asset_id).bind(match p.visibility{Visibility::Shared=>"shared",Visibility::Dm=>"dm"}).execute(&mut *conn).await?;
            token_payload(conn, campaign, user, &p.token_id).await
        }
        TokenCommand::Update(p) => {
            let name = name(&p.name)?;
            asset(conn, campaign, &p.asset_id).await?;
            let row:Option<(f64,f64,i64,i64)>=sqlx::query_as("SELECT t.x,t.y,s.width,s.height FROM tokens t JOIN scenes s ON s.id=t.scene_id WHERE t.id=? AND s.campaign_id=?").bind(&p.token_id).bind(campaign).fetch_optional(&mut *conn).await?;
            let (x, y, width, height) = row.ok_or_else(ApiError::hidden)?;
            bounds(p.size, x, y, width, height)?;
            sqlx::query("UPDATE tokens SET name=?,size=?,asset_id=? WHERE id=?")
                .bind(name)
                .bind(p.size)
                .bind(&p.asset_id)
                .bind(&p.token_id)
                .execute(&mut *conn)
                .await?;
            token_payload(conn, campaign, user, &p.token_id).await
        }
        TokenCommand::Delete(p) => {
            let payload = token_payload(conn, campaign, user, &p.token_id).await?;
            sqlx::query("DELETE FROM tokens WHERE id=?")
                .bind(&p.token_id)
                .execute(&mut *conn)
                .await?;
            Ok(payload)
        }
        _ => Err(ApiError::invalid("Unsupported authoring command.")),
    }
}
