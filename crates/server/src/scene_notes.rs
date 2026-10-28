//! Scene-owned literal notes; command caller supplies membership/GM transaction checks.
use crate::error::{ApiError, ApiResult};
use hearth_domain::{
    SceneNote, SceneNotes,
    commands::{UpdateSceneNote, Visibility},
};
use serde_json::{Value, json};
use sqlx::SqliteConnection;

pub(crate) async fn apply(
    conn: &mut SqliteConnection,
    campaign: &str,
    p: &UpdateSceneNote,
) -> ApiResult<Value> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM scenes WHERE id=? AND campaign_id=?)")
            .bind(&p.scene_id)
            .bind(campaign)
            .fetch_one(&mut *conn)
            .await?;
    if !exists {
        return Err(ApiError::hidden());
    }
    if !(0..9_007_199_254_740_991).contains(&p.expected_version)
        || p.body.chars().count() > 1000
        || p.body
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\t'))
    {
        return Err(ApiError::invalid(
            "Use plain note text up to 1000 characters and the current note version.",
        ));
    }
    let scope = match p.visibility {
        Visibility::Dm => "dm",
        Visibility::Shared => "shared",
    };
    let version: Option<i64> =
        sqlx::query_scalar("SELECT version FROM scene_notes WHERE scene_id=? AND visibility=?")
            .bind(&p.scene_id)
            .bind(scope)
            .fetch_optional(&mut *conn)
            .await?;
    if version.unwrap_or(0) != p.expected_version {
        return Err(ApiError(
            axum::http::StatusCode::CONFLICT,
            "STALE_SCENE_NOTE",
            "This note changed. Your draft is kept; reload the saved note before saving.",
        ));
    }
    sqlx::query("INSERT INTO scene_notes(scene_id,visibility,body,version) VALUES(?,?,?,1) ON CONFLICT(scene_id,visibility) DO UPDATE SET body=excluded.body,version=scene_notes.version+1").bind(&p.scene_id).bind(scope).bind(&p.body).execute(conn).await?;
    Ok(json!({"projection":"snapshot"}))
}

pub(crate) async fn projected(
    conn: &mut SqliteConnection,
    scene: &str,
    dm: bool,
) -> ApiResult<Option<SceneNotes>> {
    let rows: Vec<(String,String,i64)> = sqlx::query_as("SELECT visibility,body,version FROM scene_notes WHERE scene_id=? AND (?=1 OR visibility='shared')").bind(scene).bind(dm).fetch_all(conn).await?;
    let mut notes = SceneNotes {
        dm: dm.then(SceneNote::default),
        shared: dm.then(SceneNote::default),
    };
    for (scope, body, version) in rows {
        if scope == "dm" {
            notes.dm = Some(SceneNote { body, version });
        } else if dm || !body.trim().is_empty() {
            notes.shared = Some(SceneNote { body, version });
        }
    }
    Ok(if dm || notes.shared.is_some() {
        Some(notes)
    } else {
        None
    })
}
