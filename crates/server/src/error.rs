use axum::{
    Json,
    extract::{FromRequest, Request, rejection::JsonRejection},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::de::DeserializeOwned;
use serde_json::json;

pub struct ApiError(pub StatusCode, pub &'static str, pub &'static str);
pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    pub fn unauthenticated() -> Self {
        Self(
            StatusCode::UNAUTHORIZED,
            "UNAUTHENTICATED",
            "Sign in to continue.",
        )
    }
    pub fn forbidden() -> Self {
        Self(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "This action is not permitted.",
        )
    }
    pub fn hidden() -> Self {
        Self(
            StatusCode::NOT_FOUND,
            "NOT_FOUND_OR_HIDDEN",
            "This content is unavailable.",
        )
    }
    pub fn invalid(message: &'static str) -> Self {
        Self(
            StatusCode::UNPROCESSABLE_ENTITY,
            "VALIDATION_FAILED",
            message,
        )
    }
    pub fn conflict(message: &'static str) -> Self {
        Self(StatusCode::CONFLICT, "CONFLICT", message)
    }
    pub fn internal() -> Self {
        Self(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "The host could not complete this action. Check host storage and retry.",
        )
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.0,
            Json(json!({"schemaVersion":1,"error":{"code":self.1,"message":self.2}})),
        )
            .into_response()
    }
}
impl From<sqlx::Error> for ApiError {
    fn from(_: sqlx::Error) -> Self {
        tracing::error!("Database operation failed");
        Self::internal()
    }
}

pub struct ApiJson<T>(pub T);
impl<S, T> FromRequest<S> for ApiJson<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = ApiError;
    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        Json::<T>::from_request(req, state)
            .await
            .map(|Json(value)| Self(value))
            .map_err(|error: JsonRejection| {
                if error.status() == StatusCode::PAYLOAD_TOO_LARGE {
                    ApiError(
                        StatusCode::PAYLOAD_TOO_LARGE,
                        "PAYLOAD_TOO_LARGE",
                        "The request exceeds the 16 KiB limit.",
                    )
                } else {
                    ApiError::invalid("Send a JSON object matching the documented request fields.")
                }
            })
    }
}
