//! Game-neutral domain and wire types. No rendering or HTTP dependencies.
pub const SCHEMA_VERSION: u32 = 1;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub is_owner: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Campaign {
    pub id: String,
    pub name: String,
    pub description: String,
    pub role: String,
    pub archived: bool,
    pub created_at: i64,
    pub scene_count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Token {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub statuses: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health: Option<TokenHealth>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vitals: Option<TokenVitals>,
    pub actor_id: Option<String>,
    pub id: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub size: f64,
    pub color: String,
    pub asset_id: String,
    pub visibility: String,
    pub controller_user_id: Option<String>,
    pub can_move: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenHealth {
    pub hp: i64,
    pub max_hp: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenVitals {
    pub version: i64,
    pub hp: Option<i64>,
    pub max_hp: Option<i64>,
    pub hp_visibility: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor_version: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<SceneNotes>,
    pub fog: Fog,
    pub id: String,
    pub campaign_id: String,
    pub name: String,
    pub width: i64,
    pub height: i64,
    pub grid_size: i64,
    pub background_asset_id: String,
    pub visibility: String,
    pub active: bool,
    pub tokens: Vec<Token>,
    pub drawings: Vec<Drawing>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_undo_drawing: Option<bool>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct SceneNote {
    pub body: String,
    pub version: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SceneNotes {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dm: Option<SceneNote>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shared: Option<SceneNote>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Drawing {
    pub version: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_fit: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub points: Vec<DrawingPoint>,
    pub id: String,
    pub shape: String,
    pub visibility: String,
    pub color: String,
    pub start_x: f64,
    pub start_y: f64,
    pub end_x: f64,
    pub end_y: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DrawingPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Journal {
    #[serde(rename = "bodyFormat", skip_serializing_if = "Option::is_none")]
    pub body_format: Option<String>,
    #[serde(rename = "recipientIds", skip_serializing_if = "Option::is_none")]
    pub recipient_ids: Option<Vec<String>>,
    #[serde(rename = "assetId", skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    pub version: i64,
    pub id: String,
    pub title: String,
    pub body: String,
    pub visibility: String,
    #[serde(rename = "folderId", skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Fog {
    pub enabled: bool,
    pub columns: usize,
    pub rows: usize,
    pub revealed: String,
}

pub mod commands;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Actor {
    pub id: String,
    pub version: i64,
    pub name: String,
    pub kind: String,
    pub asset_id: String,
    pub biography: String,
    pub hp: i64,
    pub max_hp: i64,
    pub attributes: std::collections::BTreeMap<String, String>,
    pub visibility: String,
    pub can_edit: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dm_notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<ActorGrant>>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActorGrant {
    pub user_id: String,
    pub permission: String,
}

pub mod dice;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Roll {
    pub id: String,
    pub roller_id: String,
    pub roller_name: String,
    pub expression: String,
    pub normalized_expression: String,
    pub visibility: commands::RollVisibility,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recipient_ids: Vec<String>,
    pub created_at: i64,
    pub revision: i64,
    pub total: f64,
    pub dice: Vec<dice::DiceTerm>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub body: String,
    pub visibility: commands::ChatVisibility,
    pub recipient_ids: Vec<String>,
    pub created_at: i64,
    pub revision: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Encounter {
    pub id: String,
    pub scene_id: String,
    pub name: String,
    pub version: i64,
    pub status: String,
    pub round: i64,
    pub active_combatant_id: Option<String>,
    pub combatants: Vec<Combatant>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Combatant {
    pub id: String,
    pub version: i64,
    pub token_id: String,
    pub name: String,
    pub asset_id: String,
    pub initiative: Option<i64>,
    pub can_edit_initiative: bool,
    pub actor_id: Option<String>,
    pub can_edit_hp: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_hp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor_version: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalFolder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub version: i64,
}
