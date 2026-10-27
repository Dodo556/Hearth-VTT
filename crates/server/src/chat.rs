//! Immutable text history with explicit recipients and independent rate records.
use crate::{
    AppState,
    error::{ApiError, ApiResult},
    scenes, security,
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use hearth_domain::{
    ChatMessage,
    commands::{ChatVisibility, SendMessage},
};
use serde_json::{Value, json};
use sqlx::SqliteConnection;
pub(crate) async fn apply(
    conn: &mut SqliteConnection,
    campaign: &str,
    user: &str,
    revision: i64,
    p: &SendMessage,
) -> ApiResult<Value> {
    if p.body.trim().is_empty()
        || p.body.chars().count() > 1000
        || p.body
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\t'))
    {
        return Err(ApiError::invalid(
            "Write 1–1000 characters of plain text; only line breaks and tabs are allowed controls.",
        ));
    }
    crate::recipients::validate(
        conn,
        campaign,
        user,
        matches!(p.visibility, ChatVisibility::Whisper),
        &p.recipient_ids,
    )
    .await?;
    let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM chat_messages WHERE campaign_id=?1 AND sender_user_id=?2 AND client_message_id=?3 UNION ALL SELECT 1 FROM chat_rate WHERE campaign_id=?1 AND user_id=?2 AND client_message_id=?3)").bind(campaign).bind(user).bind(&p.client_message_id).fetch_one(&mut *conn).await?;
    if exists {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "MESSAGE_ID_UNAVAILABLE",
            "Use a new message ID for a new message.",
        ));
    }
    let now: i64 = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| ApiError::internal())?
        .as_millis()
        .try_into()
        .map_err(|_| ApiError::internal())?;
    let recent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM chat_rate WHERE campaign_id=? AND user_id=? AND accepted_at_ms>?",
    )
    .bind(campaign)
    .bind(user)
    .bind(now - 10000)
    .fetch_one(&mut *conn)
    .await?;
    if recent >= 10 {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "CHAT_RATE_LIMITED",
            "Wait a few seconds: at most 10 messages per 10 seconds.",
        ));
    }
    let id = security::new_record_id()?;
    let name: String = sqlx::query_scalar("SELECT display_name FROM users WHERE id=?")
        .bind(user)
        .fetch_one(&mut *conn)
        .await?;
    sqlx::query("INSERT INTO chat_messages(id,campaign_id,sender_user_id,client_message_id,sender_name,body,visibility,created_at,revision) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(&id).bind(campaign).bind(user).bind(&p.client_message_id).bind(name).bind(&p.body).bind(p.visibility.as_str()).bind(now/1000).bind(revision).execute(&mut *conn).await?;
    for recipient in &p.recipient_ids {
        sqlx::query("INSERT INTO chat_recipients(message_id,user_id) VALUES(?,?)")
            .bind(&id)
            .bind(recipient)
            .execute(&mut *conn)
            .await?;
    }
    sqlx::query("DELETE FROM chat_rate WHERE accepted_at_ms<=?")
        .bind(now - 10000)
        .execute(&mut *conn)
        .await?;
    sqlx::query("INSERT INTO chat_rate(message_id,campaign_id,user_id,client_message_id,accepted_at_ms) VALUES(?,?,?,?,?)").bind(id).bind(campaign).bind(user).bind(&p.client_message_id).bind(now).execute(&mut *conn).await?;
    sqlx::query("DELETE FROM chat_messages WHERE campaign_id=? AND id NOT IN(SELECT id FROM chat_messages WHERE campaign_id=? ORDER BY revision DESC LIMIT 1000)").bind(campaign).bind(campaign).execute(conn).await?;
    Ok(json!({"projection":"snapshot"}))
}
#[derive(sqlx::FromRow)]
struct Row {
    id: String,
    sender_user_id: String,
    sender_name: String,
    body: String,
    visibility: String,
    created_at: i64,
    revision: i64,
}
pub(crate) async fn projected(
    conn: &mut SqliteConnection,
    campaign: &str,
    user: &str,
    id: Option<&str>,
) -> ApiResult<Vec<ChatMessage>> {
    let rows:Vec<Row>=sqlx::query_as("SELECT id,sender_user_id,sender_name,body,visibility,created_at,revision FROM chat_messages m WHERE campaign_id=? AND (? IS NULL OR id=?) AND (visibility='public' OR sender_user_id=? OR EXISTS(SELECT 1 FROM chat_recipients r WHERE r.message_id=m.id AND r.user_id=?)) ORDER BY revision DESC LIMIT 20").bind(campaign).bind(id).bind(id).bind(user).bind(user).fetch_all(&mut *conn).await?;
    let mut messages = Vec::new();
    for row in rows.into_iter().rev() {
        let recipient_ids = sqlx::query_scalar(
            "SELECT user_id FROM chat_recipients WHERE message_id=? ORDER BY user_id",
        )
        .bind(&row.id)
        .fetch_all(&mut *conn)
        .await?;
        messages.push(ChatMessage {
            id: row.id,
            sender_id: row.sender_user_id,
            sender_name: row.sender_name,
            body: row.body,
            visibility: match row.visibility.as_str() {
                "public" => ChatVisibility::Public,
                "whisper" => ChatVisibility::Whisper,
                _ => return Err(ApiError::internal()),
            },
            recipient_ids,
            created_at: row.created_at,
            revision: row.revision,
        });
    }
    Ok(messages)
}
pub(crate) async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(campaign): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, user, _) = scenes::authorized_read(&state, &headers, &campaign).await?;
    Ok(Json(
        json!({"schemaVersion":1,"messages":projected(&mut tx,&campaign,&user,None).await?}),
    ))
}
pub(crate) async fn detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((campaign, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let (mut tx, user, _) = scenes::authorized_read(&state, &headers, &campaign).await?;
    let message = projected(&mut tx, &campaign, &user, Some(&id))
        .await?
        .into_iter()
        .next()
        .ok_or_else(ApiError::hidden)?;
    Ok(Json(json!({"schemaVersion":1,"message":message})))
}
