//! Campaign-scoped canonical raster storage. Client filenames never become paths.
use crate::{
    AppState, campaigns,
    error::{ApiError, ApiResult},
    security,
};
use axum::{
    Json,
    body::to_bytes,
    extract::{Path, Request, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use image::{ImageFormat, ImageReader};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    io::{Cursor, Write},
    path::PathBuf,
    time::Duration,
};
use tower::ServiceExt;
use tower_http::services::ServeFile;
const INPUT_LIMIT: usize = 8 * 1024 * 1024;
const OUTPUT_LIMIT: usize = 16 * 1024 * 1024;
type AssetRow = (String, i64, i64, i64);
fn asset_json((id, width, height, byte_size): AssetRow) -> Value {
    json!({"id":id,"width":width,"height":height,"byteSize":byte_size})
}
fn invalid() -> ApiError {
    ApiError::invalid(
        "Choose a valid static PNG, JPEG or WebP, at most 8 MiB and 4096 pixels per side.",
    )
}
fn busy() -> ApiError {
    ApiError(
        StatusCode::TOO_MANY_REQUESTS,
        "UPLOAD_BUSY",
        "The host is processing other artwork. Try again shortly.",
    )
}
fn decode(bytes: Vec<u8>, mime: String) -> ApiResult<(Vec<u8>, i64, i64)> {
    let expected = match mime.as_str() {
        "image/png" => ImageFormat::Png,
        "image/jpeg" => ImageFormat::Jpeg,
        "image/webp" => ImageFormat::WebP,
        _ => return Err(invalid()),
    };
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| invalid())?;
    if reader.format() != Some(expected) {
        return Err(invalid());
    }
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let raster = reader.decode().map_err(|_| invalid())?.into_rgba8();
    let (width, height) = raster.dimensions();
    if width == 0 || height == 0 {
        return Err(invalid());
    }
    // Re-encoding discards metadata, original filenames and appended executable bytes.
    let mut output = Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(raster)
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|_| invalid())?;
    let bytes = output.into_inner();
    if bytes.len() > OUTPUT_LIMIT {
        return Err(ApiError::invalid(
            "The decoded artwork is too large. Reduce its dimensions or complexity.",
        ));
    }
    Ok((bytes, i64::from(width), i64::from(height)))
}
pub(crate) async fn upload(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    request: Request,
) -> ApiResult<Json<Value>> {
    let user = campaigns::require_dm(&state, &headers, &id).await?;
    let _permit = state
        .upload_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| busy())?;
    let mime = headers
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_owned();
    if !["image/png", "image/jpeg", "image/webp"].contains(&mime.as_str()) {
        return Err(invalid());
    }
    let bytes = tokio::time::timeout(
        Duration::from_secs(10),
        to_bytes(request.into_body(), INPUT_LIMIT),
    )
    .await
    .map_err(|_| ApiError::invalid("Artwork upload timed out."))?
    .map_err(|_| {
        ApiError(
            StatusCode::PAYLOAD_TOO_LARGE,
            "PAYLOAD_TOO_LARGE",
            "Artwork must be at most 8 MiB.",
        )
    })?;
    let (bytes, width, height) = tokio::task::spawn_blocking(move || decode(bytes.to_vec(), mime))
        .await
        .map_err(|_| ApiError::internal())??;
    let sha = hex::encode(Sha256::digest(&bytes));
    let size = bytes.len() as i64;
    let mut tx = state.store.pool.begin_with("BEGIN IMMEDIATE").await?;
    // A membership/archive change while the image was decoding must still win.
    let session =
        security::digest(&security::session_token(&headers).ok_or_else(ApiError::unauthenticated)?);
    let (_, role) = crate::commands::access(&mut tx, &session, &id).await?;
    if role != "dm" {
        return Err(ApiError::forbidden());
    }
    let authorized:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM memberships m JOIN campaigns c ON c.id=m.campaign_id WHERE m.campaign_id=? AND m.user_id=? AND m.role='dm' AND c.archived=0)").bind(&id).bind(&user.id).fetch_one(&mut *tx).await?;
    if !authorized {
        return Err(ApiError::forbidden());
    }
    let existing: Option<AssetRow> = sqlx::query_as(
        "SELECT id,width,height,byte_size FROM assets WHERE campaign_id=? AND sha256=?",
    )
    .bind(&id)
    .bind(&sha)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(row) = existing {
        return Ok(Json(json!({"schemaVersion":1,"asset":asset_json(row)})));
    }
    let (count, total): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*),COALESCE(SUM(byte_size),0) FROM assets WHERE campaign_id=?",
    )
    .bind(&id)
    .fetch_one(&mut *tx)
    .await?;
    if count >= 32 || total + size > 100 * 1024 * 1024 {
        return Err(ApiError::invalid(
            "This campaign has reached its 32-artwork / 100 MiB limit.",
        ));
    }
    let path = blob_path(&state, &sha)?;
    // Create-only installation; a crash may leave an unreferenced blob, never a
    // committed reference to a partial file. Future cleanup can collect orphans.
    tokio::task::spawn_blocking(move || -> std::io::Result<()> {
        if !path.exists() {
            let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
            let result = (|| {
                let mut file = std::fs::OpenOptions::new()
                    .create_new(true)
                    .write(true)
                    .open(&temporary)?;
                file.write_all(&bytes)?;
                file.sync_all()?;
                std::fs::rename(&temporary, &path)
            })();
            if result.is_err() {
                let _ = std::fs::remove_file(&temporary);
            }
            result?;
        }
        Ok(())
    })
    .await
    .map_err(|_| ApiError::internal())?
    .map_err(|_| ApiError::internal())?;
    let asset_id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO assets(id,campaign_id,sha256,width,height,byte_size,created_at) VALUES(?,?,?,?,?,?,?)").bind(&asset_id).bind(&id).bind(sha).bind(width).bind(height).bind(size).bind(security::now()).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"schemaVersion":1,"asset":asset_json((asset_id,width,height,size))}),
    ))
}
fn blob_path(state: &AppState, sha: &str) -> ApiResult<PathBuf> {
    if sha.len() != 64 || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(ApiError::internal());
    }
    Ok(state
        .config
        .data_dir
        .join("assets")
        .join(format!("{sha}.png")))
}
pub(crate) async fn list(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    campaigns::require_dm(&state, &headers, &id).await?;
    let rows: Vec<AssetRow> = sqlx::query_as(
        "SELECT id,width,height,byte_size FROM assets WHERE campaign_id=? ORDER BY created_at,id",
    )
    .bind(id)
    .fetch_all(&state.store.pool)
    .await?;
    Ok(Json(
        json!({"schemaVersion":1,"assets":rows.into_iter().map(asset_json).collect::<Vec<_>>()}),
    ))
}
pub(crate) async fn read(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, asset_id)): Path<(String, String)>,
) -> ApiResult<Response> {
    let (mut tx, user, dm) = crate::scenes::authorized_read(&state, &headers, &id).await?;
    let metadata: Option<String> =
        sqlx::query_scalar("SELECT sha256 FROM assets WHERE campaign_id=? AND id=?")
            .bind(&id)
            .bind(&asset_id)
            .fetch_optional(&mut *tx)
            .await?;
    let permitted = crate::scenes::projected_scenes(&mut tx, &id, dm, &user)
        .await?
        .iter()
        .any(|s| {
            s.background_asset_id == asset_id || s.tokens.iter().any(|t| t.asset_id == asset_id)
        });
    let actor_reference:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM actors a WHERE a.campaign_id=? AND a.asset_id=? AND (?=1 OR a.visibility='shared' OR EXISTS(SELECT 1 FROM actor_ownership o WHERE o.actor_id=a.id AND o.user_id=?)))").bind(&id).bind(&asset_id).bind(dm).bind(&user).fetch_one(&mut *tx).await?;
    if !(permitted || actor_reference || dm && metadata.is_some()) {
        return Err(ApiError::hidden());
    }
    tx.commit().await?;
    if let Some(sha) = metadata {
        let path = blob_path(&state, &sha)?;
        let response = ServeFile::new(path)
            .oneshot(axum::http::Request::new(axum::body::Body::empty()))
            .await
            .map_err(|_| ApiError::internal())?;
        if response.status() != StatusCode::OK {
            return Err(ApiError::hidden());
        }
        return Ok(response.into_response());
    }
    let bytes = {
        match asset_id.as_str() {
            "amber-map" => include_bytes!("../../../content/examples/amber-keep/map.png").to_vec(),
            "token-warden" => {
                include_bytes!("../../../content/examples/amber-keep/warden.png").to_vec()
            }
            "token-scout" => {
                include_bytes!("../../../content/examples/amber-keep/scout.png").to_vec()
            }
            "vault-sentinel" => {
                include_bytes!("../../../content/examples/amber-keep/sentinel.png").to_vec()
            }
            _ => return Err(ApiError::hidden()),
        }
    };
    Ok(([(axum::http::header::CONTENT_TYPE, "image/png")], bytes).into_response())
}
