//! Bounded plain-text pages; the caller owns the transaction and DM authorization.
use crate::{
    error::{ApiError, ApiResult},
    security,
};
use hearth_domain::commands::{TokenCommand, Visibility};
use serde_json::{Value, json};
use sqlx::SqliteConnection;

fn fields<'a>(title: &'a str, body: &str) -> ApiResult<&'a str> {
    let title = title.trim();
    if title.is_empty()
        || title.chars().count() > 80
        || title.chars().any(char::is_control)
        || body.chars().count() > 1000
        || body
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\t'))
    {
        return Err(ApiError::invalid(
            "Use a title of 1–80 characters and plain page text up to 1000 characters.",
        ));
    }
    Ok(title)
}
async fn version(
    conn: &mut SqliteConnection,
    campaign: &str,
    id: &str,
    expected: i64,
) -> ApiResult<()> {
    let current: i64 =
        sqlx::query_scalar("SELECT version FROM journals WHERE campaign_id=? AND id=?")
            .bind(campaign)
            .bind(id)
            .fetch_optional(conn)
            .await?
            .ok_or_else(ApiError::hidden)?;
    if expected <= 0 || expected >= 9_007_199_254_740_991 {
        return Err(ApiError::invalid("Use the current page version."));
    }
    if current != expected {
        return Err(ApiError(
            axum::http::StatusCode::CONFLICT,
            "STALE_JOURNAL",
            "This page changed. Your draft is kept; reload the page before saving.",
        ));
    }
    Ok(())
}
pub(crate) async fn apply(
    conn: &mut SqliteConnection,
    campaign: &str,
    command: &TokenCommand,
) -> ApiResult<Value> {
    match command {
        TokenCommand::JournalCreate(p) => {
            let title = fields(&p.title, &p.body)?;
            let count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM journals WHERE campaign_id=?")
                    .bind(campaign)
                    .fetch_one(&mut *conn)
                    .await?;
            if count >= 16 {
                return Err(ApiError::invalid(
                    "This build supports up to 16 journal pages per campaign.",
                ));
            }
            let inserted = sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES(?,?,?,?,'dm',?) ON CONFLICT(id) DO NOTHING")
                .bind(&p.journal_id).bind(campaign).bind(title).bind(&p.body).bind(security::now()).execute(&mut *conn).await?;
            if inserted.rows_affected() != 1 {
                return Err(ApiError::invalid("Use a fresh journal ID."));
            }
        }
        TokenCommand::JournalUpdate(p) => {
            version(conn, campaign, &p.journal_id, p.expected_version).await?;
            let title = fields(&p.title, &p.body)?;
            sqlx::query("UPDATE journals SET title=?,body=?,visibility=?,version=version+1 WHERE campaign_id=? AND id=?")
                .bind(title).bind(&p.body).bind(match p.visibility { Visibility::Shared => "shared", Visibility::Dm => "dm" }).bind(campaign).bind(&p.journal_id).execute(&mut *conn).await?;
        }
        TokenCommand::JournalDelete(p) => {
            version(conn, campaign, &p.journal_id, p.expected_version).await?;
            sqlx::query("DELETE FROM journals WHERE campaign_id=? AND id=?")
                .bind(campaign)
                .bind(&p.journal_id)
                .execute(&mut *conn)
                .await?;
        }
        _ => return Err(ApiError::invalid("Unsupported journal command.")),
    }
    // Never put private text, title, IDs or historical versions into live events.
    Ok(json!({"projection":"snapshot"}))
}
