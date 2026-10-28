mod history;
// Scene drawings are authored by the GM and projected through scene/fog ACLs.
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
        TokenCommand::DrawingDelete(p) => {
            if uuid::Uuid::parse_str(&p.drawing_id).is_err() {
                return Err(ApiError::invalid("Use a valid drawing ID."));
            }
            let before = history::load(conn, scene, &p.drawing_id, p.expected_version).await?;
            history::record(conn, scene, &p.drawing_id, "delete", Some(&before)).await?;
            sqlx::query("DELETE FROM drawings WHERE scene_id=? AND id=?")
                .bind(scene)
                .bind(&p.drawing_id)
                .execute(&mut *conn)
                .await?;
        }
        TokenCommand::DrawingUpdateText(p) => {
            if uuid::Uuid::parse_str(&p.drawing_id).is_err() {
                return Err(ApiError::invalid("Use a valid drawing ID."));
            }
            let before = history::load(conn, scene, &p.drawing_id, p.expected_version).await?;
            if before.shape != "text" {
                return Err(ApiError::invalid("Choose a text drawing."));
            }
            let text = valid_text(&p.text)?;
            let (sx, sy, ex, ey) = text_box(p.start_x, p.start_y, p.end_x, p.end_y, width, height)?;
            if !valid_color(&p.color) || !(8..=96).contains(&p.font_size) {
                return Err(ApiError::invalid(
                    "Use a valid color and a font size of 8–96.",
                ));
            }
            history::record(conn, scene, &p.drawing_id, "update", Some(&before)).await?;
            sqlx::query("UPDATE drawings SET visibility=?,color=?,start_x=?,start_y=?,end_x=?,end_y=?,text=?,font_size=?,text_fit=0,version=version+1 WHERE scene_id=? AND id=?").bind(match p.visibility{Visibility::Shared=>"shared",Visibility::Dm=>"dm"}).bind(&p.color).bind(sx).bind(sy).bind(ex).bind(ey).bind(text).bind(p.font_size).bind(scene).bind(&p.drawing_id).execute(&mut *conn).await?;
        }
        TokenCommand::DrawingCreate(p) => {
            if p.shape != "text" && p.font_size.is_some() {
                return Err(ApiError::invalid("Only text drawings accept a font size."));
            }
            let font_size = p.font_size.unwrap_or(24);
            if !(8..=96).contains(&font_size) {
                return Err(ApiError::invalid("Use a font size of 8–96."));
            }
            let text = if p.shape == "text" {
                let text = p
                    .text
                    .as_deref()
                    .ok_or_else(|| ApiError::invalid("Enter drawing text."))?;
                if text.trim().is_empty()
                    || text.chars().count() > 120
                    || text.split('\n').count() > 4
                    || text.chars().any(|c| c.is_control() && c != '\n')
                {
                    return Err(ApiError::invalid(
                        "Use 1–120 plain characters over at most four lines.",
                    ));
                }
                Some(text.trim())
            } else {
                if p.text.is_some() {
                    return Err(ApiError::invalid("Only text drawings accept text."));
                }
                None
            };
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
            let (mut start_x, mut start_y, mut end_x, mut end_y) =
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
            if uuid::Uuid::parse_str(&p.client_drawing_id).is_err()
                || !matches!(p.shape.as_str(), "line" | "rectangle" | "freehand" | "text")
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
            {
                return Err(ApiError::invalid("Choose a valid shape inside the scene."));
            }
            if p.shape == "text" {
                let round = |v: f64| (v * 100.0).round() / 100.0;
                (start_x, start_y, end_x, end_y) = (
                    round(start_x.min(end_x)),
                    round(start_y.min(end_y)),
                    round(start_x.max(end_x)),
                    round(start_y.max(end_y)),
                );
            }
            let dx = (end_x - start_x).abs();
            let dy = (end_y - start_y).abs();
            if match p.shape.as_str() {
                "text" => {
                    // Exact hundredths avoid rejecting an exactly minimum-size box.
                    let width = (end_x * 100.0).round() - (start_x * 100.0).round();
                    let height = (end_y * 100.0).round() - (start_y * 100.0).round();
                    !(4000.0..=102400.0).contains(&width) || !(3200.0..=51200.0).contains(&height)
                }
                "rectangle" => dx < 1.0 || dy < 1.0,
                "line" => dx.hypot(dy) < 1.0,
                _ => false,
            } {
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
            let drawing_id = uuid::Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO drawings(id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points,text,font_size,text_fit,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sort_order),0)+1 FROM drawings WHERE scene_id=?))")
                .bind(&drawing_id).bind(scene).bind(&p.shape)
                .bind(match p.visibility { Visibility::Shared => "shared", Visibility::Dm => "dm" })
                .bind(&p.color).bind(start_x).bind(start_y).bind(end_x).bind(end_y).bind(serde_json::to_string(&points).map_err(|_|ApiError::internal())?).bind(text).bind(font_size).bind(p.font_size.is_none()).bind(scene)
                .execute(&mut *conn).await?;
            history::record(conn, scene, &drawing_id, "create", None).await?;
        }
        TokenCommand::DrawingUndo(_) => {
            history::undo(conn, scene).await?;
        }
        _ => return Err(ApiError::invalid("Unsupported drawing command.")),
    }
    Ok(json!({"projection":"snapshot"}))
}

fn valid_text(text: &str) -> ApiResult<&str> {
    if text.trim().is_empty()
        || text.chars().count() > 120
        || text.split('\n').count() > 4
        || text.chars().any(|c| c.is_control() && c != '\n')
    {
        return Err(ApiError::invalid(
            "Use 1–120 plain characters over at most four lines.",
        ));
    }
    Ok(text.trim())
}
fn valid_color(color: &str) -> bool {
    color.len() == 7
        && color.starts_with('#')
        && color.as_bytes()[1..]
            .iter()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b))
}
fn text_box(
    sx: f64,
    sy: f64,
    ex: f64,
    ey: f64,
    width: i64,
    height: i64,
) -> ApiResult<(f64, f64, f64, f64)> {
    if ![sx, sy, ex, ey].iter().all(|v| v.is_finite())
        || sx < 0.0
        || sy < 0.0
        || ex < 0.0
        || ey < 0.0
        || sx > width as f64
        || ex > width as f64
        || sy > height as f64
        || ey > height as f64
    {
        return Err(ApiError::invalid("Keep the text box inside the scene."));
    }
    let r = |v: f64| (v * 100.0).round() / 100.0;
    let (sx, sy, ex, ey) = (r(sx.min(ex)), r(sy.min(ey)), r(sx.max(ex)), r(sy.max(ey)));
    let w = (ex * 100.0).round() - (sx * 100.0).round();
    let h = (ey * 100.0).round() - (sy * 100.0).round();
    if !(4000.0..=102400.0).contains(&w) || !(3200.0..=51200.0).contains(&h) {
        return Err(ApiError::invalid(
            "Use a text box 40–1024 pixels wide and 32–512 high.",
        ));
    }
    Ok((sx, sy, ex, ey))
}
