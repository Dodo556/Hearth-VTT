//! GM-only organization; hierarchy never grants access to a page.
use crate::error::{ApiError, ApiResult};
use hearth_domain::{JournalFolder, commands::TokenCommand};
use serde_json::{Value, json};
use sqlx::SqliteConnection;

pub(crate) async fn projected(
    conn: &mut SqliteConnection,
    campaign: &str,
    dm: bool,
) -> ApiResult<Vec<JournalFolder>> {
    if !dm {
        return Ok(Vec::new());
    }
    let rows:Vec<(String,Option<String>,String,i64)>=sqlx::query_as("SELECT id,parent_id,name,version FROM journal_folders WHERE campaign_id=? ORDER BY name COLLATE NOCASE,id").bind(campaign).fetch_all(conn).await?;
    Ok(rows
        .into_iter()
        .map(|(id, parent_id, name, version)| JournalFolder {
            id,
            parent_id,
            name,
            version,
        })
        .collect())
}
pub(crate) async fn destination(
    conn: &mut SqliteConnection,
    campaign: &str,
    id: Option<&str>,
) -> ApiResult<()> {
    if let Some(id) = id {
        if uuid::Uuid::parse_str(id).is_err() {
            return Err(ApiError::invalid("Use a current journal folder."));
        }
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM journal_folders WHERE id=? AND campaign_id=?)",
        )
        .bind(id)
        .bind(campaign)
        .fetch_one(conn)
        .await?;
        if !exists {
            return Err(ApiError::hidden());
        }
    }
    Ok(())
}
fn name(value: &str) -> ApiResult<&str> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 60 || value.chars().any(char::is_control) {
        return Err(ApiError::invalid(
            "Use a folder name of 1–60 characters without controls.",
        ));
    }
    Ok(value)
}
fn hierarchy(folders: &[JournalFolder]) -> ApiResult<()> {
    for item in folders {
        let mut seen = std::collections::HashSet::new();
        let mut current = Some(item.id.as_str());
        while let Some(id) = current {
            if !seen.insert(id) || seen.len() > 4 {
                return Err(ApiError::invalid(
                    "Keep folders within four levels, without circular parents.",
                ));
            }
            let item = folders
                .iter()
                .find(|f| f.id == id)
                .ok_or_else(ApiError::hidden)?;
            current = item.parent_id.as_deref();
        }
    }
    Ok(())
}
fn version(actual: i64, expected: i64) -> ApiResult<()> {
    if !(1..9_007_199_254_740_991).contains(&expected) {
        return Err(ApiError::invalid("Use the current folder version."));
    }
    if expected != actual {
        return Err(ApiError(
            axum::http::StatusCode::CONFLICT,
            "STALE_JOURNAL_FOLDER",
            "This folder changed. Your draft is kept; reload the folder before saving.",
        ));
    }
    Ok(())
}
pub(crate) async fn apply(
    conn: &mut SqliteConnection,
    campaign: &str,
    command: &TokenCommand,
) -> ApiResult<Value> {
    let mut folders = projected(conn, campaign, true).await?;
    match command {
        TokenCommand::JournalFolderCreate(p) => {
            let name = name(&p.name)?;
            if folders.len() >= 16 || uuid::Uuid::parse_str(&p.folder_id).is_err() {
                return Err(ApiError::invalid(
                    "Use a fresh ID and at most 16 folders per campaign.",
                ));
            }
            destination(conn, campaign, p.parent_id.as_deref()).await?;
            folders.push(JournalFolder {
                id: p.folder_id.clone(),
                parent_id: p.parent_id.clone(),
                name: name.into(),
                version: 1,
            });
            hierarchy(&folders)?;
            let n=sqlx::query("INSERT INTO journal_folders(id,campaign_id,parent_id,name) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(&p.folder_id).bind(campaign).bind(&p.parent_id).bind(name).execute(conn).await?;
            if n.rows_affected() != 1 {
                return Err(ApiError::invalid("Use a fresh folder ID."));
            }
        }
        TokenCommand::JournalFolderUpdate(p) => {
            let name = name(&p.name)?;
            destination(conn, campaign, p.parent_id.as_deref()).await?;
            let item = folders
                .iter_mut()
                .find(|f| f.id == p.folder_id)
                .ok_or_else(ApiError::hidden)?;
            version(item.version, p.expected_version)?;
            item.parent_id = p.parent_id.clone();
            hierarchy(&folders)?;
            sqlx::query("UPDATE journal_folders SET name=?,parent_id=?,version=version+1 WHERE id=? AND campaign_id=?").bind(name).bind(&p.parent_id).bind(&p.folder_id).bind(campaign).execute(conn).await?;
        }
        TokenCommand::JournalFolderDelete(p) => {
            let item = folders
                .iter()
                .find(|f| f.id == p.folder_id)
                .ok_or_else(ApiError::hidden)?;
            version(item.version, p.expected_version)?;
            sqlx::query("UPDATE journals SET folder_id=?,version=version+1 WHERE campaign_id=? AND folder_id=?").bind(&item.parent_id).bind(campaign).bind(&p.folder_id).execute(&mut *conn).await?;
            sqlx::query("UPDATE journal_folders SET parent_id=?,version=version+1 WHERE campaign_id=? AND parent_id=?").bind(&item.parent_id).bind(campaign).bind(&p.folder_id).execute(&mut *conn).await?;
            sqlx::query("DELETE FROM journal_folders WHERE campaign_id=? AND id=?")
                .bind(campaign)
                .bind(&p.folder_id)
                .execute(conn)
                .await?;
        }
        TokenCommand::JournalMove(p) => {
            super::journals::version(conn, campaign, &p.journal_id, p.expected_version).await?;
            destination(conn, campaign, p.folder_id.as_deref()).await?;
            sqlx::query(
                "UPDATE journals SET folder_id=?,version=version+1 WHERE id=? AND campaign_id=?",
            )
            .bind(&p.folder_id)
            .bind(&p.journal_id)
            .bind(campaign)
            .execute(conn)
            .await?;
        }
        _ => return Err(ApiError::invalid("Unsupported folder command.")),
    }
    Ok(json!({"projection":"snapshot"}))
}
