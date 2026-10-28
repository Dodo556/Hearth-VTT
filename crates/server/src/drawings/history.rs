use crate::error::{ApiError, ApiResult};
use serde::{Deserialize, Serialize};
use sqlx::SqliteConnection;

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub(super) struct SavedDrawing {
    pub sort_order: i64,
    pub id: String,
    pub scene_id: String,
    pub shape: String,
    pub visibility: String,
    pub color: String,
    pub start_x: f64,
    pub start_y: f64,
    pub end_x: f64,
    pub end_y: f64,
    pub points: String,
    pub text: Option<String>,
    pub font_size: i64,
    pub text_fit: bool,
    pub version: i64,
}
pub(super) async fn load(
    conn: &mut SqliteConnection,
    scene: &str,
    id: &str,
    expected: i64,
) -> ApiResult<SavedDrawing> {
    let row=sqlx::query_as::<_,SavedDrawing>("SELECT sort_order,id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points,text,font_size,text_fit,version FROM drawings WHERE scene_id=? AND id=?").bind(scene).bind(id).fetch_optional(conn).await?.ok_or_else(ApiError::hidden)?;
    if !(1..9_007_199_254_740_991).contains(&expected) {
        return Err(ApiError::invalid("Use the current drawing version."));
    }
    if row.version != expected {
        return Err(ApiError(
            axum::http::StatusCode::CONFLICT,
            "STALE_DRAWING",
            "This drawing changed. Your draft is kept; cancel and select it again before saving.",
        ));
    }
    Ok(row)
}
pub(super) async fn record(
    conn: &mut SqliteConnection,
    scene: &str,
    id: &str,
    action: &str,
    before: Option<&SavedDrawing>,
) -> ApiResult<()> {
    let encoded = before
        .map(serde_json::to_string)
        .transpose()
        .map_err(|_| ApiError::internal())?;
    sqlx::query(
        "INSERT INTO drawing_history(scene_id,drawing_id,action,before_state) VALUES(?,?,?,?)",
    )
    .bind(scene)
    .bind(id)
    .bind(action)
    .bind(encoded)
    .execute(&mut *conn)
    .await?;
    sqlx::query("DELETE FROM drawing_history WHERE scene_id=? AND id NOT IN(SELECT id FROM drawing_history WHERE scene_id=? ORDER BY id DESC LIMIT 128)").bind(scene).bind(scene).execute(conn).await?;
    Ok(())
}
pub(super) async fn undo(conn: &mut SqliteConnection, scene: &str) -> ApiResult<()> {
    let last:Option<(i64,String,String,Option<String>)>=sqlx::query_as("SELECT id,drawing_id,action,before_state FROM drawing_history WHERE scene_id=? ORDER BY id DESC LIMIT 1").bind(scene).fetch_optional(&mut *conn).await?;
    let (history_id, id, action, encoded) =
        last.ok_or_else(|| ApiError::invalid("There are no drawing changes to undo."))?;
    if action == "create" {
        sqlx::query("DELETE FROM drawings WHERE scene_id=? AND id=?")
            .bind(scene)
            .bind(&id)
            .execute(&mut *conn)
            .await?;
    } else {
        let mut old: SavedDrawing =
            serde_json::from_str(encoded.as_deref().ok_or_else(ApiError::internal)?)
                .map_err(|_| ApiError::internal())?;
        if old.id != id || old.scene_id != scene {
            return Err(ApiError::internal());
        }
        if action == "delete" {
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM drawings WHERE scene_id=?")
                .bind(scene)
                .fetch_one(&mut *conn)
                .await?;
            if count >= 64 {
                return Err(ApiError::invalid(
                    "Make room in this scene before restoring the erased drawing.",
                ));
            }
            old.version += 1;
            sqlx::query("INSERT INTO drawings(sort_order,id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points,text,font_size,text_fit,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(old.sort_order).bind(&old.id).bind(scene).bind(&old.shape).bind(&old.visibility).bind(&old.color).bind(old.start_x).bind(old.start_y).bind(old.end_x).bind(old.end_y).bind(&old.points).bind(&old.text).bind(old.font_size).bind(old.text_fit).bind(old.version).execute(&mut *conn).await?;
        } else {
            let current: i64 =
                sqlx::query_scalar("SELECT version FROM drawings WHERE scene_id=? AND id=?")
                    .bind(scene)
                    .bind(&id)
                    .fetch_optional(&mut *conn)
                    .await?
                    .ok_or_else(ApiError::hidden)?;
            sqlx::query("UPDATE drawings SET visibility=?,color=?,start_x=?,start_y=?,end_x=?,end_y=?,points=?,text=?,font_size=?,text_fit=?,version=? WHERE scene_id=? AND id=?").bind(&old.visibility).bind(&old.color).bind(old.start_x).bind(old.start_y).bind(old.end_x).bind(old.end_y).bind(&old.points).bind(&old.text).bind(old.font_size).bind(old.text_fit).bind(current+1).bind(scene).bind(&id).execute(&mut *conn).await?;
        }
    }
    sqlx::query("DELETE FROM drawing_history WHERE id=? AND scene_id=?")
        .bind(history_id)
        .bind(scene)
        .execute(conn)
        .await?;
    Ok(())
}
