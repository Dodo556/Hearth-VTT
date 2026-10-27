//! Scene drawings are authored by the GM and projected through scene/fog ACLs.
use crate::error::{ApiError, ApiResult};
use hearth_domain::{
    DrawingPoint,
    commands::{TokenCommand, Visibility},
};
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
            let mut points = Vec::new();
            if p.shape == "freehand" {
                if !(2..=128).contains(&p.points.len()) {
                    return Err(ApiError::invalid("Use 2–128 points per freehand drawing."));
                }
                for point in &p.points {
                    if !point.x.is_finite()
                        || !point.y.is_finite()
                        || point.x < 0.0
                        || point.y < 0.0
                        || point.x > width as f64
                        || point.y > height as f64
                    {
                        return Err(ApiError::invalid(
                            "Keep every drawing point inside the scene.",
                        ));
                    }
                    let normalized = DrawingPoint {
                        x: (point.x * 100.0).round() / 100.0,
                        y: (point.y * 100.0).round() / 100.0,
                    };
                    if points.last() != Some(&normalized) {
                        points.push(normalized);
                    }
                }
                let length: f64 = points
                    .windows(2)
                    .map(|p| (p[1].x - p[0].x).hypot(p[1].y - p[0].y))
                    .sum();
                if points.len() < 2 || length < 1.0 {
                    return Err(ApiError::invalid(
                        "Draw a path at least one scene pixel long.",
                    ));
                }
            } else if !p.points.is_empty() {
                return Err(ApiError::invalid("Only freehand drawings accept points."));
            }
            let (start_x, start_y, end_x, end_y) =
                if let (Some(first), Some(last)) = (points.first(), points.last()) {
                    (first.x, first.y, last.x, last.y)
                } else {
                    (p.start_x, p.start_y, p.end_x, p.end_y)
                };
            let coords = [start_x, start_y, end_x, end_y];
            let valid_color = p.color.len() == 7
                && p.color.starts_with('#')
                && p.color.as_bytes()[1..]
                    .iter()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b));
            let dx = (end_x - start_x).abs();
            let dy = (end_y - start_y).abs();
            if uuid::Uuid::parse_str(&p.client_drawing_id).is_err()
                || !matches!(p.shape.as_str(), "line" | "rectangle" | "freehand")
                || !valid_color
                || !coords.iter().all(|v| v.is_finite())
                || start_x < 0.0
                || end_x < 0.0
                || start_y < 0.0
                || end_y < 0.0
                || start_x > width as f64
                || end_x > width as f64
                || start_y > height as f64
                || end_y > height as f64
                || match p.shape.as_str() {
                    "rectangle" => dx < 1.0 || dy < 1.0,
                    "line" => dx.hypot(dy) < 1.0,
                    _ => false,
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
            sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points) VALUES(?,?,?,?,?,?,?,?,?,?)")
                .bind(uuid::Uuid::new_v4().to_string()).bind(scene).bind(&p.shape)
                .bind(match p.visibility { Visibility::Shared => "shared", Visibility::Dm => "dm" })
                .bind(&p.color).bind(start_x).bind(start_y).bind(end_x).bind(end_y).bind(serde_json::to_string(&points).map_err(|_|ApiError::internal())?)
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
