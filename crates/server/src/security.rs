use crate::{
    AppState,
    error::{ApiError, ApiResult},
};
use axum::{
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, Method, header},
    middleware::Next,
    response::Response,
};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

pub const SESSION_SECONDS: i64 = 8 * 60 * 60;
pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System clock is before 1970")
        .as_secs() as i64
}
pub fn secret() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}
pub fn digest(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}
pub fn session_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|part| {
            part.trim()
                .strip_prefix("hearth_session=")
                .filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()))
                .map(str::to_owned)
        })
}
pub fn cookie(token: &str, secure: bool) -> String {
    format!(
        "hearth_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_SECONDS}{}",
        if secure { "; Secure" } else { "" }
    )
}
pub fn clear_cookie() -> &'static str {
    "hearth_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
}

#[derive(Default)]
pub struct RateLimiter(Mutex<HashMap<String, (Instant, u32)>>);
impl RateLimiter {
    fn check(&self, key: String) -> ApiResult<()> {
        let mut buckets = self.0.lock().map_err(|_| ApiError::internal())?;
        buckets.retain(|_, (start, _)| start.elapsed() < Duration::from_secs(60));
        if buckets.len() >= 1024 && !buckets.contains_key(&key) {
            return Err(rate_error());
        }
        let (_, attempts) = buckets.entry(key).or_insert((Instant::now(), 0));
        if *attempts >= 10 {
            return Err(rate_error());
        }
        *attempts += 1;
        Ok(())
    }
}
fn rate_error() -> ApiError {
    ApiError(
        axum::http::StatusCode::TOO_MANY_REQUESTS,
        "RATE_LIMITED",
        "Too many attempts. Wait one minute and try again.",
    )
}

pub async fn guard(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(ApiError::forbidden)?;
    if !state
        .config
        .origins
        .iter()
        .any(|origin| origin.strip_prefix("http://") == Some(host))
    {
        return Err(ApiError::forbidden());
    }
    if !matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS) {
        let origin = req
            .headers()
            .get(header::ORIGIN)
            .and_then(|h| h.to_str().ok());
        if !state
            .config
            .origins
            .iter()
            .any(|allowed| Some(allowed.as_str()) == origin)
            || req
                .headers()
                .get("x-hearth-request")
                .and_then(|v| v.to_str().ok())
                != Some("1")
        {
            return Err(ApiError::forbidden());
        }
        if matches!(
            req.uri().path(),
            "/api/auth/login" | "/api/setup/owner" | "/api/invites/redeem"
        ) {
            let peer = req
                .extensions()
                .get::<ConnectInfo<SocketAddr>>()
                .map(|p| p.0.ip().to_string())
                .unwrap_or_else(|| "local-test".into());
            state.limiter.check(peer)?;
        }
    }
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        header::CACHE_CONTROL,
        "no-store".parse().expect("constant header"),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        "nosniff".parse().expect("constant header"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        "no-referrer".parse().expect("constant header"),
    );
    headers.insert("x-frame-options", "DENY".parse().expect("constant header"));
    headers.insert(
        "permissions-policy",
        "camera=(), microphone=(), geolocation=()"
            .parse()
            .expect("constant header"),
    );
    headers.insert(header::CONTENT_SECURITY_POLICY,
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'".parse().expect("constant header"));
    Ok(response)
}

/// Fallible host-owned UUID for immutable records; caller nonces are separate.
pub(crate) fn new_record_id() -> ApiResult<String> {
    let mut bytes = [0u8; 16];
    rand::rngs::OsRng
        .try_fill_bytes(&mut bytes)
        .map_err(|_| ApiError::internal())?;
    Ok(uuid::Builder::from_random_bytes(bytes)
        .into_uuid()
        .to_string())
}
