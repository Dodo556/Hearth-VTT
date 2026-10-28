//! All live mutations commit state, revision, event and receipt atomically.
use crate::{
    AppState,
    error::{ApiError, ApiResult},
    scenes, security,
};
use hearth_domain::commands::{TokenCommand, Visibility};
use serde_json::{Value, json};
use sqlx::SqliteConnection;
type MoveRow = (
    String,
    f64,
    i64,
    i64,
    String,
    Option<String>,
    Option<String>,
    bool,
);

pub(crate) async fn access(
    conn: &mut SqliteConnection,
    session: &str,
    campaign: &str,
) -> ApiResult<(String, String)> {
    sqlx::query_as("SELECT s.user_id,m.role FROM device_sessions s JOIN memberships m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND m.campaign_id=?")
        .bind(session).bind(security::now()).bind(campaign).fetch_optional(conn).await?.ok_or_else(ApiError::forbidden)
}
fn conflict(code: &'static str, message: &'static str) -> ApiError {
    ApiError(axum::http::StatusCode::CONFLICT, code, message)
}
pub(crate) async fn execute(
    state: &AppState,
    session: &str,
    campaign: &str,
    request: &str,
    base: i64,
    command: TokenCommand,
) -> ApiResult<Value> {
    if uuid::Uuid::parse_str(request).is_err()
        || uuid::Uuid::parse_str(command.token_id()).is_err()
        || !(0..9_007_199_254_740_991).contains(&base)
    {
        return Err(ApiError::invalid(
            "Use valid request/token IDs and a safe campaign revision.",
        ));
    }
    let fingerprint = security::digest(&json!({"baseRevision":base,"command":command}).to_string());
    let mut tx = state.store.pool.begin_with("BEGIN IMMEDIATE").await?;
    let (user, role) = access(&mut tx, session, campaign).await?;
    let receipt:Option<(String,i64)>=sqlx::query_as("SELECT fingerprint,revision FROM command_receipts WHERE campaign_id=? AND user_id=? AND request_id=?").bind(campaign).bind(&user).bind(request).fetch_optional(&mut *tx).await?;
    if let Some((saved, revision)) = receipt {
        if saved != fingerprint {
            return Err(conflict(
                "REQUEST_ID_REUSED",
                "Use a new request ID for a different command.",
            ));
        }
        return Ok(
            json!({"kind":"ack","schemaVersion":1,"requestId":request,"revision":revision,"duplicate":true,"serverTime":security::now()}),
        );
    }
    let (revision, archived): (i64, bool) =
        sqlx::query_as("SELECT revision,archived FROM campaigns WHERE id=?")
            .bind(campaign)
            .fetch_one(&mut *tx)
            .await?;
    if revision != base {
        return Err(conflict(
            "STALE_REVISION",
            "The table changed. Review the current state and try again.",
        ));
    }
    if archived {
        return Err(ApiError::forbidden());
    }
    let mut payload = if let TokenCommand::SceneNotesUpdate(p) = &command {
        if role != "dm" {
            return Err(ApiError::forbidden());
        }
        crate::scene_notes::apply(&mut tx, campaign, p).await?
    } else if let TokenCommand::Chat(p) = &command {
        crate::chat::apply(&mut tx, campaign, &user, revision + 1, p).await?
    } else if let TokenCommand::Roll(p) = &command {
        crate::dice::apply(&mut tx, campaign, &user, revision + 1, p).await?
    } else if command.is_combat() {
        crate::combat::apply(&mut tx, campaign, &user, role == "dm", &command).await?
    } else if command.is_journal() {
        if role != "dm" {
            return Err(ApiError::forbidden());
        }
        crate::journals::apply(&mut tx, campaign, &command).await?
    } else if command.is_actor() {
        crate::actors::apply(&mut tx, campaign, &user, role == "dm", &command).await?
    } else if command.is_drawing() {
        if role != "dm" {
            return Err(ApiError::forbidden());
        }
        crate::drawings::apply(&mut tx, campaign, &user, &command).await?
    } else if command.is_fog() {
        if role != "dm" {
            return Err(ApiError::forbidden());
        }
        crate::fog::apply(&mut tx, campaign, &command).await?
    } else if command.is_authoring() {
        if role != "dm" {
            return Err(ApiError::forbidden());
        }
        crate::authoring::apply(&mut tx, campaign, &user, &command).await?
    } else {
        let row:Option<MoveRow>=sqlx::query_as("SELECT t.scene_id,t.size,s.width,s.height,t.visibility,c.user_id,t.actor_id,EXISTS(SELECT 1 FROM actor_ownership o WHERE o.actor_id=t.actor_id AND o.user_id=? AND o.permission='owner') FROM tokens t JOIN scenes s ON s.id=t.scene_id LEFT JOIN token_controllers c ON c.token_id=t.id WHERE t.id=? AND s.campaign_id=? AND (?=1 OR (t.visibility='shared' AND s.visibility='shared' AND s.id=(SELECT active_scene_id FROM campaigns WHERE id=s.campaign_id)))")
        .bind(&user).bind(command.token_id()).bind(campaign).bind(role=="dm").fetch_optional(&mut *tx).await?;
        let (scene_id, size, width, height, visibility, controller, actor_id, owns_actor) =
            row.ok_or_else(ApiError::hidden)?;
        let token_id = command.token_id().to_owned();
        let mask = crate::fog::Mask::load(&mut tx, campaign, &scene_id).await?;
        if role != "dm" {
            let (x, y): (f64, f64) = sqlx::query_as("SELECT x,y FROM tokens WHERE id=?")
                .bind(&token_id)
                .fetch_one(&mut *tx)
                .await?;
            if !mask.visible(x, y, size) {
                return Err(ApiError::hidden());
            }
        }
        match &command {
            TokenCommand::Move(p) => {
                if role != "dm"
                    && (visibility != "shared"
                        || if actor_id.is_some() {
                            !owns_actor
                        } else {
                            controller.as_deref() != Some(&user)
                        })
                {
                    return Err(ApiError::forbidden());
                }
                if !p.x.is_finite()
                    || !p.y.is_finite()
                    || p.x < size / 2.0
                    || p.y < size / 2.0
                    || p.x > width as f64 - size / 2.0
                    || p.y > height as f64 - size / 2.0
                {
                    return Err(ApiError::invalid("Keep the entire token inside the scene."));
                }
                if role != "dm" && !mask.visible(p.x, p.y, size) {
                    return Err(ApiError::invalid(
                        "Keep the entire token in revealed fog cells.",
                    ));
                }
                sqlx::query("UPDATE tokens SET x=?,y=? WHERE id=?")
                    .bind(p.x)
                    .bind(p.y)
                    .bind(&token_id)
                    .execute(&mut *tx)
                    .await?;
            }
            TokenCommand::Assign(p) => {
                if actor_id.is_some() {
                    return Err(ApiError::invalid(
                        "Manage control through linked actor permissions.",
                    ));
                }
                if role != "dm" {
                    return Err(ApiError::forbidden());
                }
                if let Some(target) = &p.user_id {
                    let member:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM memberships WHERE campaign_id=? AND user_id=? AND role='player')").bind(campaign).bind(target).fetch_one(&mut *tx).await?;
                    if !member {
                        return Err(ApiError::invalid(
                            "Choose a current player in this campaign.",
                        ));
                    }
                }
                sqlx::query("DELETE FROM token_controllers WHERE token_id=?")
                    .bind(&token_id)
                    .execute(&mut *tx)
                    .await?;
                if let Some(target) = &p.user_id {
                    sqlx::query("INSERT INTO token_controllers(token_id,user_id) VALUES(?,?)")
                        .bind(&token_id)
                        .bind(target)
                        .execute(&mut *tx)
                        .await?;
                }
            }
            TokenCommand::Visibility(p) => {
                if role != "dm" {
                    return Err(ApiError::forbidden());
                }
                sqlx::query("UPDATE tokens SET visibility=? WHERE id=?")
                    .bind(match p.visibility {
                        Visibility::Shared => "shared",
                        Visibility::Dm => "dm",
                    })
                    .bind(&token_id)
                    .execute(&mut *tx)
                    .await?;
            }
            _ => return Err(ApiError::invalid("Unsupported token command.")),
        }
        let token = scenes::projected_scenes(&mut tx, campaign, true, &user)
            .await?
            .into_iter()
            .flat_map(|s| s.tokens)
            .find(|t| t.id == token_id)
            .ok_or_else(ApiError::hidden)?;

        json!({"sceneId":scene_id,"token":token})
    };
    if crate::combat::reconcile(&mut tx, campaign).await? {
        payload = json!({"projection":"snapshot"});
    }
    // Combat caches must be replaced when token movement/control/visibility
    // changes the current combat projection, including fog footprint visibility.
    if let Some(token) = payload["token"]["id"].as_str() {
        let in_combat: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM combatants c JOIN combat_encounters e ON e.id=c.encounter_id WHERE e.campaign_id=? AND c.token_id=?)")
            .bind(campaign).bind(token).fetch_one(&mut *tx).await?;
        if in_combat {
            payload = json!({"projection":"snapshot"});
        }
    }
    if let Some(scene_id) = payload["sceneId"].as_str().map(str::to_owned) {
        let public:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM scenes s JOIN campaigns c ON c.id=s.campaign_id WHERE s.id=? AND s.campaign_id=? AND s.visibility='shared' AND c.active_scene_id=s.id)").bind(&scene_id).bind(campaign).fetch_one(&mut *tx).await?;
        // Private preparation history must never become replayable merely
        // because the same scene/token is published at a later time.
        payload["sceneWasPublic"] = json!(public);
        if payload["token"].is_object() {
            let mask = crate::fog::Mask::load(&mut tx, campaign, &scene_id).await?;
            let t = &payload["token"];
            payload["tokenWasVisible"] = json!(
                public
                    && t["visibility"] == "shared"
                    && mask.visible(
                        t["x"].as_f64().ok_or_else(ApiError::internal)?,
                        t["y"].as_f64().ok_or_else(ApiError::internal)?,
                        t["size"].as_f64().ok_or_else(ApiError::internal)?
                    )
            );
        }
    }
    let revision = revision + 1;
    sqlx::query("UPDATE campaigns SET revision=?,updated_at=? WHERE id=?")
        .bind(revision)
        .bind(security::now())
        .bind(campaign)
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO campaign_events(campaign_id,revision,event_id,payload,created_at) VALUES(?,?,?,?,?)").bind(campaign).bind(revision).bind(uuid::Uuid::new_v4().to_string()).bind(payload.to_string()).bind(security::now()).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO command_receipts(campaign_id,user_id,request_id,fingerprint,revision,created_at) VALUES(?,?,?,?,?,?)").bind(campaign).bind(&user).bind(request).bind(fingerprint).bind(revision).bind(security::now()).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM campaign_events WHERE campaign_id=? AND revision<=?")
        .bind(campaign)
        .bind(revision - 256)
        .execute(&mut *tx)
        .await?;
    // Old accepted commands have an older base revision, so pruning cannot re-execute them.
    sqlx::query(
        "DELETE FROM command_receipts WHERE campaign_id=? AND (created_at<? OR revision<=?)",
    )
    .bind(campaign)
    .bind(security::now() - 7 * 86400)
    .bind(revision - 10_000)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    state.live.notify();
    Ok(
        json!({"kind":"ack","schemaVersion":1,"requestId":request,"revision":revision,"duplicate":false,"serverTime":security::now()}),
    )
}
