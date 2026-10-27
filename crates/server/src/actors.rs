//! Authoritative generic sheets and explicit campaign-member grants.
use crate::{
    AppState, authoring,
    error::{ApiError, ApiResult},
    scenes, security,
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use hearth_domain::{
    Actor, ActorGrant,
    commands::{TokenCommand, Visibility},
};
use serde_json::{Value, json};
use sqlx::SqliteConnection;
use std::collections::BTreeMap;
#[derive(sqlx::FromRow)]
struct Row {
    id: String,
    version: i64,
    name: String,
    kind: String,
    asset_id: String,
    biography: String,
    dm_notes: String,
    hp: i64,
    max_hp: i64,
    attributes: String,
    visibility: String,
    my_permission: Option<String>,
}
pub(crate) async fn projected(
    conn: &mut SqliteConnection,
    camp: &str,
    dm: bool,
    user: &str,
) -> ApiResult<Vec<Actor>> {
    let rows:Vec<Row>=sqlx::query_as("SELECT a.*,(SELECT permission FROM actor_ownership o WHERE o.actor_id=a.id AND o.user_id=?) AS my_permission FROM actors a WHERE a.campaign_id=? AND (?=1 OR a.visibility='shared' OR EXISTS(SELECT 1 FROM actor_ownership o WHERE o.actor_id=a.id AND o.user_id=?)) ORDER BY a.created_at,a.id").bind(user).bind(camp).bind(dm).bind(user).fetch_all(&mut *conn).await?;
    let mut result = Vec::new();
    for a in rows {
        let permissions = if dm {
            let grants: Vec<(String, String)> = sqlx::query_as(
                "SELECT user_id,permission FROM actor_ownership WHERE actor_id=? ORDER BY user_id",
            )
            .bind(&a.id)
            .fetch_all(&mut *conn)
            .await?;
            Some(
                grants
                    .into_iter()
                    .map(|(user_id, permission)| ActorGrant {
                        user_id,
                        permission,
                    })
                    .collect(),
            )
        } else {
            None
        };
        result.push(Actor {
            id: a.id,
            version: a.version,
            name: a.name,
            kind: a.kind,
            asset_id: a.asset_id,
            biography: a.biography,
            hp: a.hp,
            max_hp: a.max_hp,
            attributes: serde_json::from_str(&a.attributes).map_err(|_| ApiError::internal())?,
            visibility: a.visibility,
            can_edit: dm || a.my_permission.as_deref() == Some("owner"),
            dm_notes: dm.then_some(a.dm_notes),
            permissions,
        });
    }
    Ok(result)
}
async fn existing(conn: &mut SqliteConnection, camp: &str, id: &str) -> ApiResult<()> {
    let yes: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM actors WHERE campaign_id=? AND id=?)")
            .bind(camp)
            .bind(id)
            .fetch_one(conn)
            .await?;
    if yes { Ok(()) } else { Err(ApiError::hidden()) }
}
fn text(v: &str, max: usize, multiline: bool) -> ApiResult<()> {
    if v.chars().count() > max
        || v.chars()
            .any(|c| c.is_control() && !(multiline && matches!(c, '\n' | '\t')))
    {
        Err(ApiError::invalid(
            "Use plain text within the displayed field limits.",
        ))
    } else {
        Ok(())
    }
}
fn fields(
    name: &str,
    bio: &str,
    hp: i64,
    max: i64,
    attributes: &BTreeMap<String, String>,
) -> ApiResult<()> {
    text(name, 80, false)?;
    text(bio, 1000, true)?;
    if name.trim().is_empty()
        || !(1..=1000000).contains(&max)
        || !(0..=max).contains(&hp)
        || attributes.len() > 8
    {
        return Err(ApiError::invalid(
            "Check the name, HP bounds and maximum eight custom properties.",
        ));
    }
    for (key, value) in attributes {
        text(key, 40, false)?;
        text(value, 120, true)?;
        if key.trim().is_empty() {
            return Err(ApiError::invalid("Property names must not be empty."));
        }
    }
    Ok(())
}
pub(crate) async fn apply(
    conn: &mut SqliteConnection,
    camp: &str,
    user: &str,
    dm: bool,
    cmd: &TokenCommand,
) -> ApiResult<Value> {
    if !dm && !matches!(cmd, TokenCommand::ActorUpdate(_)) {
        return Err(ApiError::forbidden());
    }
    match cmd {
        TokenCommand::ActorCreate(p) => {
            fields(&p.name, &p.biography, p.hp, p.max_hp, &p.attributes)?;
            text(&p.dm_notes, 1000, true)?;
            if !matches!(p.kind.as_str(), "character" | "npc") {
                return Err(ApiError::invalid("Choose Character or NPC."));
            }
            authoring::asset(conn, camp, &p.asset_id).await?;
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM actors WHERE campaign_id=?")
                .bind(camp)
                .fetch_one(&mut *conn)
                .await?;
            if count >= 16 {
                return Err(ApiError::invalid(
                    "This campaign has reached its 16-actor limit.",
                ));
            }
            let used: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM actors WHERE id=?)")
                .bind(&p.actor_id)
                .fetch_one(&mut *conn)
                .await?;
            if used {
                return Err(ApiError::conflict("Use a new actor ID."));
            }
            sqlx::query("INSERT INTO actors(id,campaign_id,name,kind,asset_id,biography,dm_notes,hp,max_hp,attributes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(&p.actor_id).bind(camp).bind(p.name.trim()).bind(&p.kind).bind(&p.asset_id).bind(&p.biography).bind(&p.dm_notes).bind(p.hp).bind(p.max_hp).bind(json!(p.attributes).to_string()).bind(security::now()).execute(&mut *conn).await?;
        }
        TokenCommand::ActorUpdate(p) => {
            let actor = projected(conn, camp, dm, user)
                .await?
                .into_iter()
                .find(|a| a.id == p.actor_id)
                .ok_or_else(ApiError::hidden)?;
            if !actor.can_edit || !dm && (p.dm_notes.is_some() || p.asset_id.is_some()) {
                return Err(ApiError::forbidden());
            }
            if actor.version != p.expected_version {
                return Err(ApiError(
                    StatusCode::CONFLICT,
                    "STALE_ACTOR",
                    "This sheet changed. Reload the latest sheet before saving.",
                ));
            }
            fields(&p.name, &p.biography, p.hp, p.max_hp, &p.attributes)?;
            if let Some(notes) = &p.dm_notes {
                text(notes, 1000, true)?;
            }
            if let Some(asset) = &p.asset_id {
                authoring::asset(conn, camp, asset).await?;
            }
            sqlx::query("UPDATE actors SET version=version+1,name=?,biography=?,hp=?,max_hp=?,attributes=?,dm_notes=COALESCE(?,dm_notes),asset_id=COALESCE(?,asset_id) WHERE id=? AND campaign_id=?").bind(p.name.trim()).bind(&p.biography).bind(p.hp).bind(p.max_hp).bind(json!(p.attributes).to_string()).bind(&p.dm_notes).bind(&p.asset_id).bind(&p.actor_id).bind(camp).execute(&mut *conn).await?;
        }
        TokenCommand::ActorPermission(p) => {
            existing(conn, camp, &p.actor_id).await?;
            if uuid::Uuid::parse_str(&p.user_id).is_err()
                || !matches!(p.permission.as_str(), "none" | "observer" | "owner")
            {
                return Err(ApiError::invalid(
                    "Choose a current player and valid permission.",
                ));
            }
            let member:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM memberships WHERE campaign_id=? AND user_id=? AND role='player')").bind(camp).bind(&p.user_id).fetch_one(&mut *conn).await?;
            if !member {
                return Err(ApiError::invalid(
                    "Choose a current player in this campaign.",
                ));
            }
            sqlx::query("DELETE FROM actor_ownership WHERE actor_id=? AND user_id=?")
                .bind(&p.actor_id)
                .bind(&p.user_id)
                .execute(&mut *conn)
                .await?;
            if p.permission != "none" {
                let n: i64 =
                    sqlx::query_scalar("SELECT COUNT(*) FROM actor_ownership WHERE actor_id=?")
                        .bind(&p.actor_id)
                        .fetch_one(&mut *conn)
                        .await?;
                if n >= 32 {
                    return Err(ApiError::invalid(
                        "This actor has reached its 32-permission limit.",
                    ));
                }
                sqlx::query("INSERT INTO actor_ownership(actor_id,campaign_id,user_id,permission) VALUES(?,?,?,?)").bind(&p.actor_id).bind(camp).bind(&p.user_id).bind(&p.permission).execute(&mut *conn).await?;
            }
        }
        TokenCommand::ActorVisibility(p) => {
            existing(conn, camp, &p.actor_id).await?;
            sqlx::query("UPDATE actors SET visibility=? WHERE id=?")
                .bind(match p.visibility {
                    Visibility::Dm => "dm",
                    Visibility::Shared => "shared",
                })
                .bind(&p.actor_id)
                .execute(&mut *conn)
                .await?;
        }
        TokenCommand::ActorDelete(p) => {
            existing(conn, camp, &p.actor_id).await?;
            sqlx::query("DELETE FROM actors WHERE id=?")
                .bind(&p.actor_id)
                .execute(&mut *conn)
                .await?;
        }
        TokenCommand::Link(p) => {
            let yes:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tokens t JOIN scenes s ON s.id=t.scene_id WHERE t.id=? AND s.campaign_id=?)").bind(&p.token_id).bind(camp).fetch_one(&mut *conn).await?;
            if !yes {
                return Err(ApiError::hidden());
            }
            if let Some(actor) = &p.actor_id {
                existing(conn, camp, actor).await?;
            }
            sqlx::query("DELETE FROM token_controllers WHERE token_id=?")
                .bind(&p.token_id)
                .execute(&mut *conn)
                .await?;
            sqlx::query("UPDATE tokens SET actor_id=? WHERE id=?")
                .bind(&p.actor_id)
                .bind(&p.token_id)
                .execute(&mut *conn)
                .await?;
        }
        _ => return Err(ApiError::invalid("Unsupported actor command.")),
    }
    Ok(json!({"projection":"snapshot"}))
}
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, user, dm) = scenes::authorized_read(&state, &headers, &id).await?;
    Ok(Json(
        json!({"schemaVersion":1,"actors":projected(&mut tx,&id,dm,&user).await?}),
    ))
}
pub async fn detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, actor)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let (mut tx, user, dm) = scenes::authorized_read(&state, &headers, &id).await?;
    let a = projected(&mut tx, &id, dm, &user)
        .await?
        .into_iter()
        .find(|a| a.id == actor)
        .ok_or_else(ApiError::hidden)?;
    Ok(Json(json!({"schemaVersion":1,"actor":a})))
}
