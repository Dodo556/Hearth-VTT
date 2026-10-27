//! Scene drawings are authored by the GM and projected through scene/fog ACLs.
use crate::error::{ApiError, ApiResult};
use hearth_domain::commands::{TokenCommand, Visibility};
use serde_json::{Value, json};

pub(crate) async fn apply(
    conn: &mut sqlx::SqliteConnection,
    campaign: &str,
    user: &str,
    command: &TokenCommand,
) -> ApiResult<Value> {
    let scene = command.token_id();
    let dimensions: Option<(i64, i64)> =
        sqlx::query_as("SELECT width,height FROM scenes WHERE id=? AND campaign_id=?")
            .bind(scene)
            .bind(campaign)
            .fetch_optional(&mut *conn)
            .await?;
    let (width, height) = dimensions.ok_or_else(ApiError::hidden)?;
    match command {
        TokenCommand::DrawingCreate(p) => {
            let coords = [p.start_x, p.start_y, p.end_x, p.end_y];
            let valid_color = p.color.len() == 7
                && p.color.starts_with('#')
                && p.color.as_bytes()[1..]
                    .iter()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b));
            let dx = (p.end_x - p.start_x).abs();
            let dy = (p.end_y - p.start_y).abs();
            if uuid::Uuid::parse_str(&p.client_drawing_id).is_err()
                || !matches!(p.shape.as_str(), "line" | "rectangle")
                || !valid_color
                || !coords.iter().all(|v| v.is_finite())
                || p.start_x < 0.0
                || p.end_x < 0.0
                || p.start_y < 0.0
                || p.end_y < 0.0
                || p.start_x > width as f64
                || p.end_x > width as f64
                || p.start_y > height as f64
                || p.end_y > height as f64
                || if p.shape == "rectangle" {
                    dx < 1.0 || dy < 1.0
                } else {
                    dx.hypot(dy) < 1.0
                }
            {
                return Err(ApiError::invalid("Choose a valid shape inside the scene."));
            }
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM drawings WHERE scene_id=?")
                .bind(scene)
                .fetch_one(&mut *conn)
                .await?;
            if count >= 64 {
                return Err(ApiError::invalid("A scene can have at most 64 drawings."));
            }
            let nonce = sqlx::query("INSERT OR IGNORE INTO drawing_creation_nonces(campaign_id,user_id,nonce) VALUES(?,?,?)")
                .bind(campaign).bind(user).bind(&p.client_drawing_id).execute(&mut *conn).await?;
            if nonce.rows_affected() == 0 {
                return Err(ApiError::conflict("Use a new drawing ID."));
            }
            sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y) VALUES(?,?,?,?,?,?,?,?,?)")
                .bind(uuid::Uuid::new_v4().to_string()).bind(scene).bind(&p.shape)
                .bind(match p.visibility { Visibility::Shared => "shared", Visibility::Dm => "dm" })
                .bind(&p.color).bind(p.start_x).bind(p.start_y).bind(p.end_x).bind(p.end_y)
                .execute(&mut *conn).await?;
        }
        TokenCommand::DrawingUndo(_) => {
            let removed = sqlx::query("DELETE FROM drawings WHERE rowid=(SELECT rowid FROM drawings WHERE scene_id=? ORDER BY rowid DESC LIMIT 1)")
                .bind(scene).execute(&mut *conn).await?;
            if removed.rows_affected() == 0 {
                return Err(ApiError::invalid("There are no drawings to undo."));
            }
        }
        _ => return Err(ApiError::invalid("Unsupported drawing command.")),
    }
    Ok(json!({"projection":"snapshot"}))
}
