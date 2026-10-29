//! Bounded plain-text pages; the caller owns the transaction and DM authorization.
use crate::{
    error::{ApiError, ApiResult},
    security,
};
use hearth_domain::commands::{JournalVisibility, TokenCommand};
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
pub(crate) async fn version(
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
async fn image(conn: &mut SqliteConnection, campaign: &str, asset: Option<&str>) -> ApiResult<()> {
    if let Some(id) = asset {
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM assets WHERE campaign_id=? AND id=?)")
                .bind(campaign)
                .bind(id)
                .fetch_one(conn)
                .await?;
        if !exists {
            return Err(ApiError::hidden());
        }
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
            crate::journal_folders::destination(conn, campaign, p.folder_id.as_deref()).await?;
            let title = fields(&p.title, &p.body)?;
            image(conn, campaign, p.asset_id.as_deref()).await?;
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
            let inserted = sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at,folder_id,asset_id,body_format) VALUES(?,?,?,?,'dm',?,?,?,?) ON CONFLICT(id) DO NOTHING")
                .bind(&p.journal_id).bind(campaign).bind(title).bind(&p.body).bind(security::now()).bind(&p.folder_id).bind(&p.asset_id).bind(p.body_format.as_ref().map(|f| f.as_str()).unwrap_or("plain")).execute(&mut *conn).await?;
            if inserted.rows_affected() != 1 {
                return Err(ApiError::invalid("Use a fresh journal ID."));
            }
        }
        TokenCommand::JournalCopy(p) => {
            if uuid::Uuid::parse_str(&p.source_journal_id).is_err() {
                return Err(ApiError::invalid("Use a valid source page ID."));
            }
            version(conn, campaign, &p.source_journal_id, p.expected_version).await?;
            let (body, asset_id): (String, Option<String>) =
                sqlx::query_as("SELECT body,asset_id FROM journals WHERE campaign_id=? AND id=?")
                    .bind(campaign)
                    .bind(&p.source_journal_id)
                    .fetch_one(&mut *conn)
                    .await?;
            let title = fields(&p.title, &body)?;
            image(conn, campaign, asset_id.as_deref()).await?;
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
            // Derive content from the scoped persisted source. Never copy scope, readers or folders.
            let inserted = sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at,asset_id,body_format) SELECT ?,campaign_id,?,body,'dm',?,asset_id,body_format FROM journals WHERE campaign_id=? AND id=? ON CONFLICT(id) DO NOTHING")
                .bind(&p.journal_id).bind(title).bind(security::now()).bind(campaign).bind(&p.source_journal_id).execute(&mut *conn).await?;
            if inserted.rows_affected() != 1 {
                return Err(ApiError::invalid("Use a fresh journal ID."));
            }
        }
        TokenCommand::JournalUpdate(p) => {
            version(conn, campaign, &p.journal_id, p.expected_version).await?;
            let title = fields(&p.title, &p.body)?;
            let old: Option<String> =
                sqlx::query_scalar("SELECT asset_id FROM journals WHERE campaign_id=? AND id=?")
                    .bind(campaign)
                    .bind(&p.journal_id)
                    .fetch_one(&mut *conn)
                    .await?;
            let asset_id = p.asset_id.as_ref().unwrap_or(&old);
            image(conn, campaign, asset_id.as_deref()).await?;
            if old != *asset_id && !matches!(p.visibility, JournalVisibility::Dm) {
                return Err(ApiError::invalid(
                    "Save image changes privately before revealing the page.",
                ));
            }
            validate_readers(conn, campaign, &p.visibility, &p.recipient_ids).await?;
            sqlx::query("DELETE FROM journal_recipients WHERE journal_id=?")
                .bind(&p.journal_id)
                .execute(&mut *conn)
                .await?;
            for user in &p.recipient_ids {
                sqlx::query(
                    "INSERT INTO journal_recipients(campaign_id,journal_id,user_id) VALUES(?,?,?)",
                )
                .bind(campaign)
                .bind(&p.journal_id)
                .bind(user)
                .execute(&mut *conn)
                .await?;
            }
            sqlx::query("UPDATE journals SET title=?,body=?,visibility=?,asset_id=?,body_format=COALESCE(?,body_format),version=version+1 WHERE campaign_id=? AND id=?")
                .bind(title).bind(&p.body).bind(match p.visibility { JournalVisibility::Shared => "shared", JournalVisibility::Dm | JournalVisibility::Selected => "dm" }).bind(asset_id).bind(p.body_format.as_ref().map(|f| f.as_str())).bind(campaign).bind(&p.journal_id).execute(&mut *conn).await?;
        }
        TokenCommand::JournalDelete(p) => {
            version(conn, campaign, &p.journal_id, p.expected_version).await?;
            sqlx::query("DELETE FROM journals WHERE campaign_id=? AND id=?")
                .bind(campaign)
                .bind(&p.journal_id)
                .execute(&mut *conn)
                .await?;
        }
        _ => return crate::journal_folders::apply(conn, campaign, command).await,
    }
    // Never put private text, title, IDs or historical versions into live events.
    Ok(json!({"projection":"snapshot"}))
}

async fn validate_readers(
    conn: &mut SqliteConnection,
    campaign: &str,
    visibility: &JournalVisibility,
    ids: &[String],
) -> ApiResult<()> {
    let invalid = || {
        ApiError::invalid(
            "Choose 1–8 distinct current players for selected sharing; GM-only/everyone need no selected readers.",
        )
    };
    if !matches!(visibility, JournalVisibility::Selected) {
        return if ids.is_empty() {
            Ok(())
        } else {
            Err(invalid())
        };
    }
    if ids.is_empty() || ids.len() > 8 {
        return Err(invalid());
    }
    let mut seen = std::collections::HashSet::new();
    for id in ids {
        if uuid::Uuid::parse_str(id).is_err() || !seen.insert(id) {
            return Err(invalid());
        }
        let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM memberships WHERE campaign_id=? AND user_id=? AND role='player')").bind(campaign).bind(id).fetch_one(&mut *conn).await?;
        if !exists {
            return Err(invalid());
        }
    }
    Ok(())
}
