//! Encounter state references tokens; actor HP and all visibility stay authoritative.
use crate::{
    AppState,
    error::{ApiError, ApiResult},
    scenes,
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use hearth_domain::{Actor, Combatant, Encounter, Scene, commands::TokenCommand};
use serde_json::{Value, json};
use sqlx::SqliteConnection;

#[derive(sqlx::FromRow)]
struct EncounterRow {
    id: String,
    scene_id: String,
    name: String,
    version: i64,
    status: String,
    round: i64,
    active_combatant_id: Option<String>,
}
#[derive(sqlx::FromRow)]
struct Entry {
    id: String,
    token_id: String,
    version: i64,
    initiative: Option<i64>,
}
async fn encounter(conn: &mut SqliteConnection, camp: &str) -> ApiResult<Option<EncounterRow>> {
    Ok(sqlx::query_as("SELECT id,scene_id,name,version,status,round,active_combatant_id FROM combat_encounters WHERE campaign_id=?").bind(camp).fetch_optional(conn).await?)
}
async fn entries(conn: &mut SqliteConnection, id: &str) -> ApiResult<Vec<Entry>> {
    Ok(sqlx::query_as("SELECT id,token_id,version,initiative FROM combatants WHERE encounter_id=? ORDER BY initiative IS NULL,initiative DESC,sort_order,id").bind(id).fetch_all(conn).await?)
}
pub(crate) async fn projected(
    conn: &mut SqliteConnection,
    camp: &str,
    dm: bool,
    scenes: &[Scene],
    actors: &[Actor],
) -> ApiResult<Option<Encounter>> {
    let Some(e) = encounter(conn, camp).await? else {
        return Ok(None);
    };
    let Some(scene) = scenes
        .iter()
        .find(|s| s.id == e.scene_id && (dm || s.active && s.visibility == "shared"))
    else {
        return Ok(None);
    };
    let mut combatants = Vec::new();
    for entry in entries(conn, &e.id).await? {
        let Some(token) = scene.tokens.iter().find(|t| t.id == entry.token_id) else {
            continue;
        };
        let actor = token
            .actor_id
            .as_ref()
            .and_then(|id| actors.iter().find(|a| a.id == *id));
        combatants.push(Combatant {
            id: entry.id,
            version: entry.version,
            token_id: token.id.clone(),
            name: token.name.clone(),
            asset_id: token.asset_id.clone(),
            initiative: entry.initiative,
            can_edit_initiative: token.can_move,
            actor_id: actor.map(|a| a.id.clone()),
            can_edit_hp: actor.is_some_and(|a| a.can_edit),
            hp: actor
                .map(|a| a.hp)
                .or_else(|| token.health.as_ref().map(|h| h.hp)),
            max_hp: actor
                .map(|a| a.max_hp)
                .or_else(|| token.health.as_ref().map(|h| h.max_hp)),
            actor_version: actor.map(|a| a.version),
        });
    }
    let active_combatant_id = e
        .active_combatant_id
        .filter(|id| combatants.iter().any(|c| c.id == *id));
    Ok(Some(Encounter {
        id: e.id,
        scene_id: e.scene_id,
        name: e.name,
        version: e.version,
        status: e.status,
        round: e.round,
        active_combatant_id,
        combatants,
    }))
}
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(camp): Path<String>,
) -> ApiResult<Json<Value>> {
    let (mut tx, user, dm) = scenes::authorized_read(&state, &headers, &camp).await?;
    let scenes = scenes::projected_scenes(&mut tx, &camp, dm, &user).await?;
    let actors = crate::actors::projected(&mut tx, &camp, dm, &user).await?;
    let encounter = projected(&mut tx, &camp, dm, &scenes, &actors).await?;
    Ok(Json(json!({"schemaVersion":1,"encounter":encounter})))
}
fn valid_id(id: &str) -> ApiResult<()> {
    if uuid::Uuid::parse_str(id).is_ok() {
        Ok(())
    } else {
        Err(ApiError::invalid("Use valid IDs."))
    }
}
fn version(v: i64) -> ApiResult<()> {
    if (1..=9_007_199_254_740_991).contains(&v) {
        Ok(())
    } else {
        Err(ApiError::invalid("Use a positive safe version."))
    }
}
fn stale() -> ApiError {
    ApiError(
        StatusCode::CONFLICT,
        "STALE_COMBAT",
        "Combat changed. Review the current encounter and try again.",
    )
}
async fn nonce(
    conn: &mut SqliteConnection,
    camp: &str,
    user: &str,
    kind: &str,
    id: &str,
) -> ApiResult<()> {
    valid_id(id)?;
    let result=sqlx::query("INSERT OR IGNORE INTO combat_creation_nonces(campaign_id,user_id,kind,nonce) VALUES(?,?,?,?)").bind(camp).bind(user).bind(kind).bind(id).execute(conn).await?;
    if result.rows_affected() == 0 {
        Err(ApiError::conflict("Use a new creation ID."))
    } else {
        Ok(())
    }
}
pub(crate) async fn apply(
    conn: &mut SqliteConnection,
    camp: &str,
    user: &str,
    dm: bool,
    cmd: &TokenCommand,
) -> ApiResult<Value> {
    if !dm
        && !matches!(
            cmd,
            TokenCommand::CombatInitiative(_) | TokenCommand::CombatHp(_)
        )
    {
        return Err(ApiError::forbidden());
    }
    if let TokenCommand::CombatCreate(p) = cmd {
        valid_id(&p.scene_id)?;
        let name = p.name.trim();
        if name.is_empty() || name.chars().count() > 80 || p.name.chars().any(char::is_control) {
            return Err(ApiError::invalid(
                "Use an encounter name of 1–80 plain characters.",
            ));
        }
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM scenes WHERE id=? AND campaign_id=?)")
                .bind(&p.scene_id)
                .bind(camp)
                .fetch_one(&mut *conn)
                .await?;
        if !exists {
            return Err(ApiError::hidden());
        }
        if encounter(conn, camp).await?.is_some() {
            return Err(ApiError::conflict(
                "Clear the current encounter before preparing another.",
            ));
        }
        nonce(conn, camp, user, "encounter", &p.client_encounter_id).await?;
        sqlx::query("INSERT INTO combat_encounters(id,campaign_id,scene_id,name) VALUES(?,?,?,?)")
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(camp)
            .bind(&p.scene_id)
            .bind(name)
            .execute(conn)
            .await?;
        return Ok(json!({"projection":"snapshot"}));
    }
    let e = encounter(conn, camp).await?.ok_or_else(ApiError::hidden)?;
    let ordered = entries(conn, &e.id).await?;
    match cmd {
        TokenCommand::CombatAdd(p) => {
            valid_id(&p.encounter_id)?;
            valid_id(&p.token_id)?;
            version(p.expected_version)?;
            if p.encounter_id != e.id {
                return Err(ApiError::hidden());
            }
            if p.expected_version != e.version {
                return Err(stale());
            }
            let exists: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tokens WHERE id=? AND scene_id=?)")
                    .bind(&p.token_id)
                    .bind(&e.scene_id)
                    .fetch_one(&mut *conn)
                    .await?;
            if !exists {
                return Err(ApiError::hidden());
            }
            if ordered.len() >= 32 || ordered.iter().any(|c| c.token_id == p.token_id) {
                return Err(ApiError::invalid(
                    "Choose a unique token; encounters allow up to 32 combatants.",
                ));
            }
            nonce(conn, camp, user, "combatant", &p.client_combatant_id).await?;
            sqlx::query("INSERT INTO combatants(id,encounter_id,token_id,sort_order) SELECT ?,id,?,next_sort_order FROM combat_encounters WHERE id=?").bind(uuid::Uuid::new_v4().to_string()).bind(&p.token_id).bind(&e.id).execute(&mut *conn).await?;
            sqlx::query("UPDATE combat_encounters SET version=version+1,next_sort_order=next_sort_order+1 WHERE id=?").bind(&e.id).execute(&mut *conn).await?;
        }
        TokenCommand::CombatStart(p)
        | TokenCommand::CombatNext(p)
        | TokenCommand::CombatEnd(p)
        | TokenCommand::CombatClear(p) => {
            valid_id(&p.encounter_id)?;
            version(p.expected_version)?;
            if p.encounter_id != e.id {
                return Err(ApiError::hidden());
            }
            if p.expected_version != e.version {
                return Err(stale());
            }
            if matches!(cmd, TokenCommand::CombatClear(_)) {
                sqlx::query("DELETE FROM combat_encounters WHERE id=?")
                    .bind(&e.id)
                    .execute(&mut *conn)
                    .await?;
            } else {
                let (status, round, current) = match cmd {
                    TokenCommand::CombatStart(_)
                        if e.status == "preparing" && !ordered.is_empty() =>
                    {
                        ("active", 1, Some(ordered[0].id.clone()))
                    }
                    TokenCommand::CombatNext(_) if e.status == "active" && !ordered.is_empty() => {
                        let index = e
                            .active_combatant_id
                            .as_ref()
                            .and_then(|id| ordered.iter().position(|c| c.id == *id));
                        let next = index.map_or(0, |i| (i + 1) % ordered.len());
                        (
                            "active",
                            (e.round + i64::from(index.is_some() && next == 0)).min(1_000_000_000),
                            Some(ordered[next].id.clone()),
                        )
                    }
                    TokenCommand::CombatEnd(_) if e.status == "active" => ("ended", e.round, None),
                    _ => {
                        return Err(ApiError::invalid(
                            "This action is unavailable in the current combat state.",
                        ));
                    }
                };
                sqlx::query("UPDATE combat_encounters SET status=?,round=?,active_combatant_id=?,version=version+1 WHERE id=?").bind(status).bind(round).bind(current).bind(&e.id).execute(&mut *conn).await?;
            }
        }
        TokenCommand::CombatRemove(p) => {
            version(p.expected_version)?;
            let index = ordered
                .iter()
                .position(|c| c.id == p.combatant_id)
                .ok_or_else(ApiError::hidden)?;
            if e.version != p.expected_version {
                return Err(stale());
            }
            let current = e.active_combatant_id.as_deref() == Some(p.combatant_id.as_str());
            sqlx::query("DELETE FROM combatants WHERE id=?")
                .bind(&p.combatant_id)
                .execute(&mut *conn)
                .await?;
            if ordered.len() == 1 {
                sqlx::query("UPDATE combat_encounters SET status='preparing',round=0,active_combatant_id=NULL WHERE id=?").bind(&e.id).execute(&mut *conn).await?;
            } else if current {
                let next = (index + 1) % ordered.len();
                let round =
                    (e.round + i64::from(next == 0 && e.status == "active")).min(1_000_000_000);
                sqlx::query(
                    "UPDATE combat_encounters SET active_combatant_id=?,round=? WHERE id=?",
                )
                .bind(&ordered[next].id)
                .bind(round)
                .bind(&e.id)
                .execute(&mut *conn)
                .await?;
            }
        }
        TokenCommand::CombatInitiative(p) => {
            version(p.expected_version)?;
            let c = visible_entry(conn, camp, user, dm, &p.combatant_id).await?;
            if !c.can_edit_initiative {
                return Err(ApiError::forbidden());
            }
            if c.version != p.expected_version {
                return Err(stale());
            }
            if p.initiative.is_some_and(|i| !(-1000..=1000).contains(&i)) {
                return Err(ApiError::invalid(
                    "Initiative must be an integer from -1000 to 1000, or blank.",
                ));
            }
            sqlx::query("UPDATE combatants SET initiative=?,version=version+1 WHERE id=?")
                .bind(p.initiative)
                .bind(&c.id)
                .execute(&mut *conn)
                .await?;
            sqlx::query("UPDATE combat_encounters SET version=version+1 WHERE id=?")
                .bind(&e.id)
                .execute(&mut *conn)
                .await?;
        }
        TokenCommand::CombatHp(p) => {
            valid_id(&p.expected_actor_id)?;
            version(p.expected_actor_version)?;
            let c = visible_entry(conn, camp, user, dm, &p.combatant_id).await?;
            let actor = c.actor_id.ok_or_else(ApiError::hidden)?;
            if !c.can_edit_hp {
                return Err(ApiError::forbidden());
            }
            if actor != p.expected_actor_id || c.actor_version != Some(p.expected_actor_version) {
                return Err(ApiError(
                    StatusCode::CONFLICT,
                    "STALE_ACTOR",
                    "This sheet changed. Reload the latest sheet before saving.",
                ));
            }
            if !(0..=c.max_hp.ok_or_else(ApiError::hidden)?).contains(&p.hp) {
                return Err(ApiError::invalid("Keep HP between zero and maximum HP."));
            }
            sqlx::query("UPDATE actors SET hp=?,version=version+1 WHERE id=? AND campaign_id=?")
                .bind(p.hp)
                .bind(actor)
                .bind(camp)
                .execute(&mut *conn)
                .await?;
        }
        _ => return Err(ApiError::invalid("Unsupported combat command.")),
    }
    Ok(json!({"projection":"snapshot"}))
}

async fn visible_entry(
    conn: &mut SqliteConnection,
    camp: &str,
    user: &str,
    dm: bool,
    id: &str,
) -> ApiResult<Combatant> {
    let scenes = scenes::projected_scenes(conn, camp, dm, user).await?;
    let actors = crate::actors::projected(conn, camp, dm, user).await?;
    projected(conn, camp, dm, &scenes, &actors)
        .await?
        .and_then(|e| e.combatants.into_iter().find(|c| c.id == id))
        .ok_or_else(ApiError::hidden)
}

pub(crate) async fn reconcile(conn: &mut SqliteConnection, camp: &str) -> ApiResult<bool> {
    let Some(e) = encounter(conn, camp).await? else {
        return Ok(false);
    };
    let entries = entries(conn, &e.id).await?;
    let missing = e
        .active_combatant_id
        .as_ref()
        .is_some_and(|id| !entries.iter().any(|c| c.id == *id));
    if entries.is_empty()
        && (e.status != "preparing" || e.round != 0 || e.active_combatant_id.is_some())
    {
        sqlx::query("UPDATE combat_encounters SET status='preparing',round=0,active_combatant_id=NULL,version=version+1 WHERE id=?").bind(&e.id).execute(conn).await?;
    } else if missing {
        sqlx::query(
            "UPDATE combat_encounters SET active_combatant_id=?,version=version+1 WHERE id=?",
        )
        .bind(&entries[0].id)
        .bind(&e.id)
        .execute(conn)
        .await?;
    } else {
        return Ok(false);
    }
    Ok(true)
}
