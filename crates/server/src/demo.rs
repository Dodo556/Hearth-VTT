//! Original deterministic demo data, never a substitute for user-authored content.
use crate::{error::ApiResult, security};
use uuid::Uuid;

pub async fn seed(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    campaign_id: &str,
) -> ApiResult<()> {
    let scene_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO scenes(id,campaign_id,name,width,height,grid_size,background_asset_id,created_at) VALUES (?,?,'The Old Watchtower',1440,960,60,'amber-map',?)")
        .bind(&scene_id).bind(campaign_id).bind(security::now()).execute(&mut **tx).await?;
    sqlx::query("UPDATE scenes SET visibility='shared' WHERE id=?")
        .bind(&scene_id)
        .execute(&mut **tx)
        .await?;
    sqlx::query("UPDATE campaigns SET active_scene_id=? WHERE id=?")
        .bind(&scene_id)
        .bind(campaign_id)
        .execute(&mut **tx)
        .await?;
    for (name, x, y, color, asset, visibility) in [
        (
            "Rowan · Warden",
            570.0,
            690.0,
            "#dbb969",
            "token-warden",
            "shared",
        ),
        (
            "Elara · Scout",
            690.0,
            750.0,
            "#74b4a0",
            "token-scout",
            "shared",
        ),
        (
            "Vault sentinel",
            810.0,
            270.0,
            "#b17b95",
            "vault-sentinel",
            "dm",
        ),
    ] {
        sqlx::query("INSERT INTO tokens(id,scene_id,name,x,y,size,color,asset_id,visibility) VALUES (?,?,?,?,?,52,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(&scene_id).bind(name).bind(x).bind(y).bind(color).bind(asset).bind(visibility).execute(&mut **tx).await?;
    }
    for (title, body, visibility) in [
        (
            "A letter from the watch",
            "Travelers,\n\nThe watchtower has stood empty since the last autumn bell. A warm light returned to its windows three nights ago. Find its keeper, and learn why the bell rings again.\n\n— Captain Maren",
            "shared",
        ),
        (
            "DM · Beneath the keep",
            "The vault sentinel guards the eastern chamber. The iron coffer opens only when the travelers return the missing bell clapper. Keep this note private until discovered.",
            "dm",
        ),
    ] {
        sqlx::query("INSERT INTO journals(id,campaign_id,title,body,visibility,created_at) VALUES (?,?,?,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(campaign_id).bind(title).bind(body).bind(visibility).bind(security::now()).execute(&mut **tx).await?;
    }
    Ok(())
}
