use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ClientFrame {
    Hello {
        schema_version: u32,
        last_revision: Option<i64>,
    },
    Command {
        schema_version: u32,
        request_id: String,
        base_revision: i64,
        command: TokenCommand,
    },
    Ping {
        schema_version: u32,
        scene_id: String,
        x: f64,
        y: f64,
    },
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", deny_unknown_fields)]
pub enum TokenCommand {
    #[serde(rename = "token.vitals.update")]
    TokenVitalsUpdate(UpdateTokenVitals),
    #[serde(rename = "scene.notes.update")]
    SceneNotesUpdate(UpdateSceneNote),
    #[serde(rename = "drawing.create")]
    DrawingCreate(CreateDrawing),
    #[serde(rename = "drawing.delete")]
    DrawingDelete(DrawingRef),
    #[serde(rename = "drawing.updateText")]
    DrawingUpdateText(UpdateDrawingText),
    #[serde(rename = "drawing.undo")]
    DrawingUndo(SceneRef),
    #[serde(rename = "combat.create")]
    CombatCreate(CreateCombat),
    #[serde(rename = "combat.add")]
    CombatAdd(AddCombatant),
    #[serde(rename = "combat.remove")]
    CombatRemove(CombatantRef),
    #[serde(rename = "combat.initiative")]
    CombatInitiative(CombatInitiative),
    #[serde(rename = "combat.start")]
    CombatStart(EncounterRef),
    #[serde(rename = "combat.next")]
    CombatNext(EncounterRef),
    #[serde(rename = "combat.end")]
    CombatEnd(EncounterRef),
    #[serde(rename = "combat.clear")]
    CombatClear(EncounterRef),
    #[serde(rename = "combat.hp")]
    CombatHp(CombatHp),
    #[serde(rename = "chat.send")]
    Chat(SendMessage),
    #[serde(rename = "journal.create")]
    JournalCreate(CreateJournal),
    #[serde(rename = "journal.copy")]
    JournalCopy(CopyJournal),
    #[serde(rename = "journal.update")]
    JournalUpdate(UpdateJournal),
    #[serde(rename = "journal.delete")]
    JournalDelete(JournalRef),
    #[serde(rename = "journal.folder.create")]
    JournalFolderCreate(CreateJournalFolder),
    #[serde(rename = "journal.folder.update")]
    JournalFolderUpdate(UpdateJournalFolder),
    #[serde(rename = "journal.folder.delete")]
    JournalFolderDelete(JournalFolderRef),
    #[serde(rename = "journal.move")]
    JournalMove(MoveJournal),
    #[serde(rename = "dice.roll")]
    Roll(RollDice),
    #[serde(rename = "fog.configure")]
    FogConfigure(ConfigureFog),
    #[serde(rename = "fog.paint")]
    FogPaint(PaintFog),
    #[serde(rename = "fog.reset")]
    FogReset(ResetFog),
    #[serde(rename = "actor.create")]
    ActorCreate(CreateActor),
    #[serde(rename = "actor.update")]
    ActorUpdate(UpdateActor),
    #[serde(rename = "actor.delete")]
    ActorDelete(ActorRef),
    #[serde(rename = "actor.permission")]
    ActorPermission(ActorPermission),
    #[serde(rename = "actor.visibility")]
    ActorVisibility(ActorVisibility),
    #[serde(rename = "token.link")]
    Link(LinkToken),
    #[serde(rename = "scene.rename")]
    SceneRename(RenameScene),
    #[serde(rename = "scene.delete")]
    SceneDelete(SceneRef),
    #[serde(rename = "scene.create")]
    SceneCreate(CreateScene),
    #[serde(rename = "scene.activate")]
    SceneActivate(SceneRef),
    #[serde(rename = "scene.conceal")]
    SceneConceal(SceneRef),
    #[serde(rename = "token.create")]
    Create(CreateToken),
    #[serde(rename = "token.update")]
    Update(UpdateToken),
    #[serde(rename = "token.delete")]
    Delete(TokenRef),
    #[serde(rename = "token.move")]
    Move(MoveToken),
    #[serde(rename = "token.assign")]
    Assign(AssignToken),
    #[serde(rename = "token.visibility")]
    Visibility(TokenVisibility),
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MoveToken {
    pub token_id: String,
    pub x: f64,
    pub y: f64,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssignToken {
    pub token_id: String,
    pub user_id: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TokenVisibility {
    pub token_id: String,
    pub visibility: Visibility,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Visibility {
    Shared,
    Dm,
}
impl TokenCommand {
    pub fn token_id(&self) -> &str {
        match self {
            Self::TokenVitalsUpdate(p) => &p.token_id,
            Self::SceneNotesUpdate(p) => &p.scene_id,
            Self::DrawingCreate(p) => &p.scene_id,
            Self::DrawingUndo(p) => &p.scene_id,
            Self::DrawingDelete(p) => &p.scene_id,
            Self::DrawingUpdateText(p) => &p.scene_id,
            Self::CombatCreate(p) => &p.client_encounter_id,
            Self::CombatAdd(p) => &p.client_combatant_id,
            Self::CombatRemove(p) => &p.combatant_id,
            Self::CombatInitiative(p) => &p.combatant_id,
            Self::CombatStart(p) => &p.encounter_id,
            Self::CombatNext(p) => &p.encounter_id,
            Self::CombatEnd(p) => &p.encounter_id,
            Self::CombatClear(p) => &p.encounter_id,
            Self::CombatHp(p) => &p.combatant_id,
            Self::JournalCreate(p) => &p.journal_id,
            Self::JournalCopy(p) => &p.journal_id,
            Self::JournalUpdate(p) => &p.journal_id,
            Self::JournalDelete(p) => &p.journal_id,
            Self::JournalFolderCreate(p) => &p.folder_id,
            Self::JournalFolderUpdate(p) => &p.folder_id,
            Self::JournalFolderDelete(p) => &p.folder_id,
            Self::JournalMove(p) => &p.journal_id,
            Self::Chat(p) => &p.client_message_id,
            Self::Roll(p) => &p.client_roll_id,
            Self::FogConfigure(p) => &p.scene_id,
            Self::FogPaint(p) => &p.scene_id,
            Self::FogReset(p) => &p.scene_id,
            Self::ActorCreate(p) => &p.actor_id,
            Self::ActorUpdate(p) => &p.actor_id,
            Self::ActorDelete(p) => &p.actor_id,
            Self::ActorPermission(p) => &p.actor_id,
            Self::ActorVisibility(p) => &p.actor_id,
            Self::Link(p) => &p.token_id,
            Self::SceneRename(p) => &p.scene_id,
            Self::SceneDelete(p) => &p.scene_id,
            Self::SceneCreate(p) => &p.scene_id,
            Self::SceneActivate(p) | Self::SceneConceal(p) => &p.scene_id,
            Self::Create(p) => &p.token_id,
            Self::Update(p) => &p.token_id,
            Self::Delete(p) => &p.token_id,
            Self::Move(p) => &p.token_id,
            Self::Assign(p) => &p.token_id,
            Self::Visibility(p) => &p.token_id,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateDrawing {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_size: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub points: Vec<crate::DrawingPoint>,
    pub scene_id: String,
    pub client_drawing_id: String,
    pub shape: String,
    pub visibility: Visibility,
    pub color: String,
    pub start_x: f64,
    pub start_y: f64,
    pub end_x: f64,
    pub end_y: f64,
}
impl TokenCommand {
    pub fn is_drawing(&self) -> bool {
        matches!(
            self,
            Self::DrawingCreate(_)
                | Self::DrawingUndo(_)
                | Self::DrawingDelete(_)
                | Self::DrawingUpdateText(_)
        )
    }
}

impl TokenCommand {
    pub fn is_fog(&self) -> bool {
        matches!(
            self,
            Self::FogConfigure(_) | Self::FogPaint(_) | Self::FogReset(_)
        )
    }
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConfigureFog {
    pub scene_id: String,
    pub enabled: bool,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PaintFog {
    pub scene_id: String,
    pub column: i64,
    pub row: i64,
    pub width: i64,
    pub height: i64,
    pub mode: FogMode,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResetFog {
    pub scene_id: String,
    pub mode: FogMode,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FogMode {
    Reveal,
    Hide,
}

impl TokenCommand {
    pub fn is_authoring(&self) -> bool {
        matches!(
            self,
            Self::SceneRename(_)
                | Self::SceneDelete(_)
                | Self::SceneCreate(_)
                | Self::SceneActivate(_)
                | Self::SceneConceal(_)
                | Self::Create(_)
                | Self::Update(_)
                | Self::Delete(_)
        )
    }
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateScene {
    pub scene_id: String,
    pub name: String,
    pub asset_id: String,
    pub grid_size: i64,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SceneRef {
    pub scene_id: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateToken {
    pub token_id: String,
    pub scene_id: String,
    pub name: String,
    pub asset_id: String,
    pub size: f64,
    pub x: f64,
    pub y: f64,
    pub visibility: Visibility,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateToken {
    pub token_id: String,
    pub name: String,
    pub asset_id: String,
    pub size: f64,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TokenRef {
    pub token_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateActor {
    pub actor_id: String,
    pub name: String,
    pub kind: String,
    pub asset_id: String,
    pub biography: String,
    pub dm_notes: String,
    pub hp: i64,
    pub max_hp: i64,
    pub attributes: std::collections::BTreeMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateActor {
    pub actor_id: String,
    pub expected_version: i64,
    pub name: String,
    pub biography: String,
    pub hp: i64,
    pub max_hp: i64,
    pub attributes: std::collections::BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dm_notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActorRef {
    pub actor_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActorPermission {
    pub actor_id: String,
    pub user_id: String,
    pub permission: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActorVisibility {
    pub actor_id: String,
    pub visibility: Visibility,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LinkToken {
    pub token_id: String,
    pub actor_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RenameScene {
    pub scene_id: String,
    pub expected_name: String,
    pub name: String,
}
impl TokenCommand {
    pub fn is_actor(&self) -> bool {
        matches!(
            self,
            Self::ActorCreate(_)
                | Self::ActorUpdate(_)
                | Self::ActorDelete(_)
                | Self::ActorPermission(_)
                | Self::ActorVisibility(_)
                | Self::Link(_)
        )
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RollDice {
    pub client_roll_id: String,
    pub expression: String,
    pub visibility: RollVisibility,
    #[serde(default)]
    pub recipient_ids: Vec<String>,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RollVisibility {
    Public,
    Gm,
    #[serde(rename = "self")]
    SelfOnly,
    Blind,
    Selected,
}
impl RollVisibility {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Public => "public",
            Self::Gm => "gm",
            Self::SelfOnly => "self",
            Self::Blind => "blind",
            Self::Selected => "selected",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateJournal {
    #[serde(
        default,
        deserialize_with = "journal_body_format",
        skip_serializing_if = "Option::is_none"
    )]
    pub body_format: Option<JournalBodyFormat>,
    pub asset_id: Option<String>,
    pub journal_id: String,
    pub title: String,
    pub body: String,
    pub folder_id: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CopyJournal {
    pub source_journal_id: String,
    pub expected_version: i64,
    pub journal_id: String,
    pub title: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateJournal {
    #[serde(
        default,
        deserialize_with = "journal_body_format",
        skip_serializing_if = "Option::is_none"
    )]
    pub body_format: Option<JournalBodyFormat>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recipient_ids: Vec<String>,
    // An omitted field preserves images for text-only clients; null explicitly removes.
    #[serde(
        default,
        deserialize_with = "journal_image_change",
        skip_serializing_if = "Option::is_none"
    )]
    pub asset_id: Option<Option<String>>,
    pub journal_id: String,
    pub expected_version: i64,
    pub title: String,
    pub body: String,
    pub visibility: JournalVisibility,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JournalRef {
    pub journal_id: String,
    pub expected_version: i64,
}
impl TokenCommand {
    pub fn is_journal(&self) -> bool {
        matches!(
            self,
            Self::JournalCreate(_)
                | Self::JournalCopy(_)
                | Self::JournalUpdate(_)
                | Self::JournalDelete(_)
                | Self::JournalFolderCreate(_)
                | Self::JournalFolderUpdate(_)
                | Self::JournalFolderDelete(_)
                | Self::JournalMove(_)
        )
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SendMessage {
    pub client_message_id: String,
    pub body: String,
    pub visibility: ChatVisibility,
    #[serde(default)]
    pub recipient_ids: Vec<String>,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatVisibility {
    Public,
    Whisper,
}
impl ChatVisibility {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Public => "public",
            Self::Whisper => "whisper",
        }
    }
}

impl TokenCommand {
    pub fn is_combat(&self) -> bool {
        matches!(
            self,
            Self::CombatCreate(_)
                | Self::CombatAdd(_)
                | Self::CombatRemove(_)
                | Self::CombatInitiative(_)
                | Self::CombatStart(_)
                | Self::CombatNext(_)
                | Self::CombatEnd(_)
                | Self::CombatClear(_)
                | Self::CombatHp(_)
        )
    }
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateCombat {
    pub client_encounter_id: String,
    pub scene_id: String,
    pub name: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AddCombatant {
    pub encounter_id: String,
    pub expected_version: i64,
    pub client_combatant_id: String,
    pub token_id: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CombatantRef {
    pub combatant_id: String,
    pub expected_version: i64,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EncounterRef {
    pub encounter_id: String,
    pub expected_version: i64,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CombatInitiative {
    pub combatant_id: String,
    pub expected_version: i64,
    #[serde(deserialize_with = "required_nullable_initiative")]
    pub initiative: Option<i64>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CombatHp {
    pub combatant_id: String,
    pub expected_actor_id: String,
    pub expected_actor_version: i64,
    pub hp: i64,
}

fn required_nullable_initiative<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<i64>, D::Error> {
    Option::<i64>::deserialize(deserializer)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrawingRef {
    pub scene_id: String,
    pub drawing_id: String,
    pub expected_version: i64,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateDrawingText {
    pub scene_id: String,
    pub drawing_id: String,
    pub expected_version: i64,
    pub text: String,
    pub visibility: Visibility,
    pub color: String,
    pub font_size: i64,
    pub start_x: f64,
    pub start_y: f64,
    pub end_x: f64,
    pub end_y: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateSceneNote {
    pub scene_id: String,
    pub visibility: Visibility,
    pub body: String,
    pub expected_version: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateTokenVitals {
    pub token_id: String,
    pub expected_version: i64,
    #[serde(deserialize_with = "required_nullable")]
    pub expected_actor_id: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    pub expected_actor_version: Option<i64>,
    #[serde(deserialize_with = "required_nullable")]
    pub hp: Option<i64>,
    #[serde(deserialize_with = "required_nullable")]
    pub max_hp: Option<i64>,
    pub hp_visibility: String,
    pub statuses: Vec<String>,
}
fn required_nullable<'de, D: serde::Deserializer<'de>, T: serde::Deserialize<'de>>(
    d: D,
) -> Result<Option<T>, D::Error> {
    Option::<T>::deserialize(d)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateJournalFolder {
    pub folder_id: String,
    pub name: String,
    #[serde(deserialize_with = "required_nullable")]
    pub parent_id: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateJournalFolder {
    pub folder_id: String,
    pub expected_version: i64,
    pub name: String,
    #[serde(deserialize_with = "required_nullable")]
    pub parent_id: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JournalFolderRef {
    pub folder_id: String,
    pub expected_version: i64,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MoveJournal {
    pub journal_id: String,
    pub expected_version: i64,
    #[serde(deserialize_with = "required_nullable")]
    pub folder_id: Option<String>,
}

fn journal_image_change<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<Option<String>>, D::Error> {
    Option::<String>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JournalVisibility {
    Dm,
    Shared,
    Selected,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JournalBodyFormat {
    Plain,
    Markdown,
}
impl JournalBodyFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Plain => "plain",
            Self::Markdown => "markdown",
        }
    }
}

fn journal_body_format<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<JournalBodyFormat>, D::Error> {
    JournalBodyFormat::deserialize(deserializer).map(Some)
}
