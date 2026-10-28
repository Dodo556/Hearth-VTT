use crate::{
    AppState, auth, commands,
    error::{ApiError, ApiResult},
    security,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use hearth_domain::{Drawing, Journal, Scene, Token};
use serde_json::json;

type SceneRow = (
    String,
    String,
    i64,
    i64,
    i64,
    String,
    String,
    bool,
    bool,
    Vec<u8>,
);

type TokenRow = (
    String,
    String,
    f64,
    f64,
    f64,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    bool,
    bool,
);

type DrawingRow = (
    String,
    String,
    String,
    String,
    f64,
    f64,
    f64,
    f64,
    String,
    Option<String>,
    i64,
    i64,
    bool,
);

pub(crate) async fn projected_scenes(
    conn: &mut sqlx::SqliteConnection,
    id: &str,
    dm: bool,
    user_id: &str,
) -> ApiResult<Vec<Scene>> {
    let rows:Vec<SceneRow>=sqlx::query_as("SELECT s.id,s.name,s.width,s.height,s.grid_size,s.background_asset_id,s.visibility,COALESCE(c.active_scene_id=s.id,0),s.fog_enabled,s.fog_bits FROM scenes s JOIN campaigns c ON c.id=s.campaign_id WHERE s.campaign_id=? AND (?=1 OR (s.visibility='shared' AND c.active_scene_id=s.id)) ORDER BY s.created_at,s.id")
        .bind(id).bind(dm).fetch_all(&mut *conn).await?;
    let mut scenes = Vec::new();
    for (
        scene_id,
        name,
        width,
        height,
        grid_size,
        background_asset_id,
        visibility,
        active,
        fog_enabled,
        fog_bits,
    ) in rows
    {
        let fog = crate::fog::Mask::new(width, height, grid_size, fog_enabled, fog_bits)?;
        let rows:Vec<TokenRow>=sqlx::query_as("SELECT t.id,t.name,t.x,t.y,t.size,t.color,t.asset_id,t.visibility,c.user_id,t.actor_id,EXISTS(SELECT 1 FROM actor_ownership o WHERE o.actor_id=t.actor_id AND o.user_id=? AND o.permission='owner'),EXISTS(SELECT 1 FROM actors a WHERE a.id=t.actor_id AND (a.visibility='shared' OR EXISTS(SELECT 1 FROM actor_ownership o WHERE o.actor_id=a.id AND o.user_id=?))) FROM tokens t LEFT JOIN token_controllers c ON c.token_id=t.id AND EXISTS(SELECT 1 FROM memberships m JOIN scenes s ON s.campaign_id=m.campaign_id WHERE s.id=t.scene_id AND m.user_id=c.user_id) WHERE t.scene_id=? AND (t.visibility='shared' OR ?=1) ORDER BY t.id")
            .bind(user_id).bind(user_id).bind(&scene_id).bind(dm).fetch_all(&mut *conn).await?;
        let tokens = rows
            .into_iter()
            .filter(|row| dm || fog.visible(row.2, row.3, row.4))
            .map(
                |(
                    id,
                    name,
                    x,
                    y,
                    size,
                    color,
                    asset_id,
                    visibility,
                    controller,
                    actor,
                    owns,
                    readable,
                )| Token {
                    actor_id: if dm || readable { actor.clone() } else { None },
                    can_move: dm
                        || if actor.is_some() {
                            owns
                        } else {
                            controller.as_deref() == Some(user_id)
                        },
                    controller_user_id: if dm || controller.as_deref() == Some(user_id) {
                        controller
                    } else {
                        None
                    },
                    id,
                    name,
                    x,
                    y,
                    size,
                    color,
                    asset_id,
                    visibility,
                },
            )
            .collect();
        let drawing_rows: Vec<DrawingRow> = sqlx::query_as("SELECT id,shape,visibility,color,start_x,start_y,end_x,end_y,points,text,font_size,version,text_fit FROM drawings WHERE scene_id=? AND (visibility='shared' OR ?=1) ORDER BY sort_order,rowid")
            .bind(&scene_id).bind(dm).fetch_all(&mut *conn).await?;
        let mut drawings = Vec::new();
        for (
            id,
            shape,
            visibility,
            color,
            start_x,
            start_y,
            end_x,
            end_y,
            encoded,
            text,
            font_size,
            version,
            text_fit,
        ) in drawing_rows
        {
            let points: Vec<hearth_domain::DrawingPoint> =
                serde_json::from_str(&encoded).map_err(|_| ApiError::internal())?;
            let (mut left, mut top, mut right, mut bottom) = (
                start_x.min(end_x),
                start_y.min(end_y),
                start_x.max(end_x),
                start_y.max(end_y),
            );
            for point in &points {
                left = left.min(point.x);
                top = top.min(point.y);
                right = right.max(point.x);
                bottom = bottom.max(point.y);
            }
            if dm || fog.rectangle_visible(left, top, right, bottom) {
                drawings.push(Drawing {
                    font_size: if shape == "text" {
                        Some(font_size)
                    } else {
                        None
                    },
                    text_fit: if shape == "text" {
                        Some(text_fit)
                    } else {
                        None
                    },
                    version,
                    text,
                    id,
                    shape,
                    visibility,
                    color,
                    start_x,
                    start_y,
                    end_x,
                    end_y,
                    points,
                });
            }
        }
        let can_undo_drawing = if dm {
            Some(
                sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM drawing_history WHERE scene_id=?)",
                )
                .bind(&scene_id)
                .fetch_one(&mut *conn)
                .await?,
            )
        } else {
            None
        };
        let notes = crate::scene_notes::projected(conn, &scene_id, dm).await?;
        scenes.push(Scene {
            notes,
            can_undo_drawing,
            drawings,
            fog: fog.dto(),
            id: scene_id,
            campaign_id: id.into(),
            name,
            width,
            height,
            grid_size,
            background_asset_id,
            visibility,
            active,
            tokens,
        });
    }
    Ok(scenes)
}
pub(crate) async fn authorized_read(
    state: &AppState,
    headers: &HeaderMap,
    campaign: &str,
) -> ApiResult<(sqlx::Transaction<'static, sqlx::Sqlite>, String, bool)> {
    auth::require_user(state, headers).await?;
    let session =
        security::digest(&security::session_token(headers).ok_or_else(ApiError::unauthenticated)?);
    let mut conn = state.store.pool.begin().await?;
    let (user, role) = commands::access(&mut conn, &session, campaign)
        .await
        .map_err(|e| {
            if e.0 == axum::http::StatusCode::FORBIDDEN {
                ApiError::hidden()
            } else {
                e
            }
        })?;
    Ok((conn, user, role == "dm"))
}
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let (mut conn, user, dm) = authorized_read(&state, &headers, &id).await?;
    Ok(Json(
        json!({"schemaVersion":1,"scenes":projected_scenes(&mut conn,&id,dm,&user).await?}),
    ))
}
pub async fn detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, scene_id)): Path<(String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    let (mut conn, user, dm) = authorized_read(&state, &headers, &id).await?;
    let scene = projected_scenes(&mut conn, &id, dm, &user)
        .await?
        .into_iter()
        .find(|s| s.id == scene_id)
        .ok_or_else(ApiError::hidden)?;
    Ok(Json(json!({"schemaVersion":1,"scene":scene})))
}
pub(crate) async fn projected_journals(
    conn: &mut sqlx::SqliteConnection,
    id: &str,
    dm: bool,
) -> ApiResult<Vec<Journal>> {
    let rows:Vec<(String,String,String,String,i64)>=sqlx::query_as("SELECT id,title,body,visibility,version FROM journals WHERE campaign_id=? AND (visibility='shared' OR ?=1) ORDER BY created_at,id")
        .bind(id).bind(dm).fetch_all(&mut *conn).await?;
    Ok(rows
        .into_iter()
        .map(|(id, title, body, visibility, version)| Journal {
            version,
            id,
            title,
            body,
            visibility,
        })
        .collect())
}
pub async fn journals(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let (mut conn, _user, dm) = authorized_read(&state, &headers, &id).await?;
    Ok(Json(
        json!({"schemaVersion":1,"journals":projected_journals(&mut conn,&id,dm).await?}),
    ))
}
pub async fn journal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, journal_id)): Path<(String, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    let (mut conn, _user, dm) = authorized_read(&state, &headers, &id).await?;
    let journal = projected_journals(&mut conn, &id, dm)
        .await?
        .into_iter()
        .find(|j| j.id == journal_id)
        .ok_or_else(ApiError::hidden)?;
    Ok(Json(json!({"schemaVersion":1,"journal":journal})))
}

#[cfg(test)]
mod tests;
