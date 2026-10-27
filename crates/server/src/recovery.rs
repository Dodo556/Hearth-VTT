//! Whole-host owner tools. No handler can select or overwrite a live data root.
use crate::{
    AppState, auth,
    error::{ApiError, ApiJson, ApiResult},
    security,
};
use axum::{
    Json,
    body::Body,
    extract::{FromRequest, Path, Request, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use futures_util::StreamExt;
use hearth_storage::backup::{self, PreparedBackup, SnapshotSummary, VerifiedBackup};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    io::AsyncWriteExt,
    sync::{Mutex, OwnedSemaphorePermit, Semaphore},
};
use tower::ServiceExt;
use tower_http::services::ServeFile;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupInfo {
    id: String,
    byte_size: u64,
    sha256: String,
    summary: SnapshotSummary,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VerificationInfo {
    #[serde(flatten)]
    backup: BackupInfo,
    expires_at: i64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreInfo {
    directory_name: String,
    created_at: i64,
    summary: SnapshotSummary,
}
struct Prepared {
    info: BackupInfo,
    artifact: PreparedBackup,
}
struct Verified {
    info: VerificationInfo,
    artifact: VerifiedBackup,
    expires: Instant,
}
#[derive(Default)]
struct Memory {
    prepared: Option<Arc<Prepared>>,
    verified: Option<Verified>,
    last_restore: Option<RestoreInfo>,
}
pub(crate) struct Recovery {
    gate: Arc<Semaphore>,
    memory: Mutex<Memory>,
}
impl Default for Recovery {
    fn default() -> Self {
        Self {
            gate: Arc::new(Semaphore::new(1)),
            memory: Mutex::new(Memory::default()),
        }
    }
}
impl Recovery {
    fn enter(&self) -> ApiResult<OwnedSemaphorePermit> {
        self.gate.clone().try_acquire_owned().map_err(|_| {
            ApiError(
                StatusCode::TOO_MANY_REQUESTS,
                "RECOVERY_BUSY",
                "Another recovery operation is running. Try again shortly.",
            )
        })
    }
    async fn expire(&self) {
        let mut memory = self.memory.lock().await;
        let expired = if memory
            .verified
            .as_ref()
            .is_some_and(|v| v.expires <= Instant::now())
        {
            memory.verified.take()
        } else {
            None
        };
        drop(memory);
        if expired.is_some() {
            tokio::task::spawn_blocking(move || drop(expired));
        }
    }
}
async fn owner(state: &AppState, headers: &HeaderMap) -> ApiResult<()> {
    if !auth::require_user(state, headers).await?.is_owner {
        return Err(ApiError::forbidden());
    }
    Ok(())
}
fn invalid_backup() -> ApiError {
    ApiError(
        StatusCode::UNPROCESSABLE_ENTITY,
        "INVALID_BACKUP",
        "This backup is invalid, incomplete or incompatible. Choose a complete Hearth backup from the supported schema.",
    )
}
fn verify_error(error: anyhow::Error) -> ApiError {
    if error.downcast_ref::<std::io::Error>().is_some_and(|e| {
        matches!(
            e.kind(),
            std::io::ErrorKind::StorageFull
                | std::io::ErrorKind::PermissionDenied
                | std::io::ErrorKind::ReadOnlyFilesystem
        )
    }) {
        ApiError::internal()
    } else {
        invalid_backup()
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Empty {}
pub(crate) async fn status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    owner(&state, &headers).await?;
    state.recovery.expire().await;
    let memory = state.recovery.memory.lock().await;
    let directory =
        std::fs::canonicalize(&state.config.data_dir).map_err(|_| ApiError::internal())?;
    Ok(Json(
        json!({"schemaVersion":1,"dataDirectory":directory.to_string_lossy(),"prepared":memory.prepared.as_ref().map(|p|&p.info),"verified":memory.verified.as_ref().map(|v|&v.info),"lastRestore":memory.last_restore}),
    ))
}
pub(crate) async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    request: Request,
) -> ApiResult<Json<Value>> {
    owner(&state, &headers).await?;
    let ApiJson(_): ApiJson<Empty> = ApiJson::from_request(request, &state).await?;
    let permit = state.recovery.enter()?;
    // The detached job keeps its permit and temporary files if the caller leaves.
    tokio::spawn(async move {
        let _permit = permit;
        owner(&state, &headers).await?;
        let artifact = backup::create(
            &state.store,
            &state.config.data_dir,
            env!("CARGO_PKG_VERSION"),
            security::now(),
        )
        .await
        .map_err(|_| ApiError::internal())?;
        owner(&state, &headers).await?;
        let info = BackupInfo {
            id: uuid::Uuid::new_v4().to_string(),
            byte_size: artifact.byte_size,
            sha256: artifact.sha256.clone(),
            summary: artifact.summary.clone(),
        };
        let previous = state
            .recovery
            .memory
            .lock()
            .await
            .prepared
            .replace(Arc::new(Prepared {
                info: info.clone(),
                artifact,
            }));
        tokio::task::spawn_blocking(move || drop(previous));
        Ok(Json(json!({"schemaVersion":1,"backup":info})))
    })
    .await
    .map_err(|_| ApiError::internal())?
}
pub(crate) async fn download(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    request: Request,
) -> ApiResult<Response> {
    owner(&state, &headers).await?;
    let prepared = state
        .recovery
        .memory
        .lock()
        .await
        .prepared
        .as_ref()
        .filter(|p| p.info.id == id)
        .cloned()
        .ok_or_else(ApiError::hidden)?;
    let response = ServeFile::new(&prepared.artifact.path)
        .oneshot(request)
        .await
        .map_err(|_| ApiError::internal())?
        .into_response();
    let (mut parts, body) = response.into_parts();
    parts.headers.insert(
        header::CONTENT_TYPE,
        "application/octet-stream".parse().expect("constant"),
    );
    parts.headers.insert(
        header::CONTENT_DISPOSITION,
        format!(
            "attachment; filename=\"hearth-host-{}.hearthbackup\"",
            prepared.info.id
        )
        .parse()
        .map_err(|_| ApiError::internal())?,
    );
    let stream = futures_util::stream::unfold(
        (body.into_data_stream(), prepared),
        |(mut body, keep)| async move { body.next().await.map(|item| (item, (body, keep))) },
    );
    Ok(Response::from_parts(parts, Body::from_stream(stream)))
}
pub(crate) async fn verify(
    State(state): State<AppState>,
    headers: HeaderMap,
    request: Request,
) -> ApiResult<Json<Value>> {
    owner(&state, &headers).await?;
    if headers
        .get(header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        != Some("application/octet-stream")
    {
        return Err(invalid_backup());
    }
    if headers
        .get(header::CONTENT_LENGTH)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.parse::<u64>().ok())
        .is_some_and(|n| n > backup::MAX_ARCHIVE_BYTES)
    {
        return Err(ApiError(
            StatusCode::PAYLOAD_TOO_LARGE,
            "PAYLOAD_TOO_LARGE",
            "A backup must be at most 512 MiB.",
        ));
    }
    let permit = state.recovery.enter()?;
    let parent = state.config.data_dir.join("backups");
    backup::private_parent(&parent).map_err(|_| ApiError::internal())?;
    let incoming = tempfile::Builder::new()
        .prefix(".hearth-upload-")
        .tempdir_in(parent)
        .map_err(|_| ApiError::internal())?;
    let input = incoming.path().join("upload.hearthbackup");
    let upload = async {
        let mut output = tokio::fs::File::create(&input)
            .await
            .map_err(|_| ApiError::internal())?;
        let mut body = request.into_body().into_data_stream();
        let mut size = 0u64;
        while let Some(chunk) = body.next().await {
            let chunk = chunk.map_err(|_| invalid_backup())?;
            size = size
                .checked_add(chunk.len() as u64)
                .ok_or_else(invalid_backup)?;
            if size > backup::MAX_ARCHIVE_BYTES {
                return Err(ApiError(
                    StatusCode::PAYLOAD_TOO_LARGE,
                    "PAYLOAD_TOO_LARGE",
                    "A backup must be at most 512 MiB.",
                ));
            }
            output
                .write_all(&chunk)
                .await
                .map_err(|_| ApiError::internal())?;
        }
        output.flush().await.map_err(|_| ApiError::internal())?;
        output.sync_all().await.map_err(|_| ApiError::internal())?;
        Ok::<_, ApiError>(())
    };
    tokio::time::timeout(Duration::from_secs(60), upload)
        .await
        .map_err(|_| {
            ApiError(
                StatusCode::REQUEST_TIMEOUT,
                "UPLOAD_TIMEOUT",
                "Backup upload timed out. Try again.",
            )
        })??;
    tokio::spawn(async move {
        let _permit = permit;
        let _incoming = incoming;
        owner(&state, &headers).await?;
        let artifact = backup::verify(&input, &state.config.data_dir.join("restores"))
            .await
            .map_err(verify_error)?;
        owner(&state, &headers).await?;
        let info = VerificationInfo {
            backup: BackupInfo {
                id: uuid::Uuid::new_v4().to_string(),
                byte_size: artifact.byte_size,
                sha256: artifact.sha256.clone(),
                summary: artifact.summary.clone(),
            },
            expires_at: security::now() + 900,
        };
        let previous = state
            .recovery
            .memory
            .lock()
            .await
            .verified
            .replace(Verified {
                info: info.clone(),
                artifact,
                expires: Instant::now() + Duration::from_secs(900),
            });
        tokio::task::spawn_blocking(move || drop(previous));
        Ok(Json(json!({"schemaVersion":1,"verification":info})))
    })
    .await
    .map_err(|_| ApiError::internal())?
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RestoreRequest {
    verification_id: String,
}
pub(crate) async fn restore(
    State(state): State<AppState>,
    headers: HeaderMap,
    request: Request,
) -> ApiResult<Json<Value>> {
    owner(&state, &headers).await?;
    let ApiJson(payload): ApiJson<RestoreRequest> = ApiJson::from_request(request, &state).await?;
    let permit = state.recovery.enter()?;
    state.recovery.expire().await;
    let mut memory = state.recovery.memory.lock().await;
    if memory
        .verified
        .as_ref()
        .is_none_or(|v| v.info.backup.id != payload.verification_id)
    {
        return Err(ApiError::hidden());
    }
    let verified = memory.verified.take().ok_or_else(ApiError::hidden)?;
    drop(memory);
    tokio::spawn(async move {
        let _permit = permit;
        owner(&state, &headers).await?;
        let summary = verified.artifact.summary.clone();
        let now = security::now();
        let path = backup::restore(verified.artifact, now)
            .await
            .map_err(|_| ApiError::internal())?;
        let info = RestoreInfo {
            directory_name: path
                .file_name()
                .and_then(|p| p.to_str())
                .ok_or_else(ApiError::internal)?
                .into(),
            created_at: now,
            summary,
        };
        state.recovery.memory.lock().await.last_restore = Some(info.clone());
        Ok(Json(json!({"schemaVersion":1,"restore":info})))
    })
    .await
    .map_err(|_| ApiError::internal())?
}
