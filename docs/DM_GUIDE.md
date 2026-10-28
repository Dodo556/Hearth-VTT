# DM quick start

1. Follow START_HERE.md: install host prerequisites, extract the source and run `pnpm try` or START-HEARTH.cmd. Create your owner account; keep the original sample checkbox checked to explore immediately. Both DM and players use browsers; keep the host terminal running.
2. Create/open/search campaigns. Settings allow rename, description and archive/unarchive. Campaign cloning/deletion/import are not implemented. Scene rename/delete are in the Scene dock; a stale name requires explicit reload, and deletion asks for confirmation, clears an active player table and removes its tokens while retaining art.
3. In the table, pan by dragging the background; wheel/+/- zoom and Fit scene are local. Move a selected token by drag/grid snap, arrow keys on the focused canvas, or numeric Token X/Y. Scene → token → Controlled by assigns one current player. DM retains control. Visibility changes apply immediately.
4. New scene accepts a named private draft with an uploaded PNG/JPEG/WebP (8MiB input,4096px/side) or existing art and a square grid size20–256px. Uploads are canonicalized and protected. Prepared scene changes only your local selection. Show scene to players explicitly activates it; Take scene private clears the active player view. Limits are8 scenes,100 tokens,32 uploaded assets/100MiB per campaign.
5. Add token chooses name/art/size/position/visibility; new tokens default DM-only. Choose shared visibility to show them and assign player control separately. Edit token changes name/art/size; Delete token asks for confirmation. Characters creates generic sheets with portraits, biography, HP/eight custom properties and DM-only notes. Grant Observer to read or Owner to edit/move linked shared tokens. Scene → Linked actor clears standalone control; Open sheet jumps to the sheet. Actor deletion unlinks tokens. Concurrent sheet edits require explicit reload; inventory/system rules remain future work; shared manual fog is available. Uploaded art can be reused within its campaign.
6. Journals remain shared/private sample plain-text pages. Private tokens/journals/art never reach players. The background download warning describes a separate limit: authorized players can inspect the full active background image; protected background confidentiality is not implemented.
7. Invite players creates one new-account link valid for24 hours and one redemption. Use a separate browser session to test a player on the same computer. Generate one link per player. For other devices, use a configured private LAN browser address before creating links; localhost works only on your own computer.
8. People lists identities and supports access revocation. Live views clear on reauthorization; subsequent requests are denied. Previously downloaded bytes cannot be recalled. Existing-account invitation/rejoin and owner recovery remain pending.
9. Stop with Ctrl+C; restart and sign in to retained campaigns/maps/tokens. Follow BACKUP_RECOVERY for full-directory offline copies, including assets/. Automatic pre-upgrade snapshots cover only the database. No full restore wizard exists yet.

## Shared manual fog (0.0.5)

Open Scene, then Enable fog to cover a newly fogged map. Choose Reveal area or Hide area and drag one rectangle, or enter its zero-based column/row/width/height and use the rectangle buttons. Select restores token selection/movement; Pan moves the camera even when dragging a token; middle-drag still pans while painting. Cover all resets exploration. Reveal all and Disable fog require confirmation because they expose every otherwise shared token when the scene is active. Disabling preserves the stored mask for later re-enabling.

Players need every cell touched by a token's whole footprint revealed. A partly covered token disappears from their list and canvas, including owned tokens; players cannot move into covered cells. DM preparation remains visible through a translucent overlay. Fog changes keep the local camera. Private tokens stay private even in revealed areas. Private encounter actor sheets should remain private; explicit actor sharing/ownership grants independently allow their sheet and portrait. Manual shared-party exploration persists after restart; walls, vision radii and individual exploration are future work.

Background artwork remains downloadable in full. The overlay does not make secret areas inside the original image confidential. Re-hiding cannot erase previously received information.

## Host dice (0.0.6)

Use Dice for formulas such as `2d6+3` and `(d20+4)/2`, or quick standard dice using the selected scope. Public results reach everyone; DM + me reaches the roller and current DM; Only me excludes other users (including other DMs); Blind reaches current DMs, with no player-roller result. Results include normalized formula, individual faces, subtotal, total, scope, roller and time. The server records AST and original expression for audit, and accepted request retries return receipts without rolling twice. No editable/revealable roll history or proof against a malicious physical host yet. Chat/whispers and selected recipients are now available as described below.

## Journal authoring (0.0.7)

In Journal choose New page, enter a title/text and Create private page. Select a saved page → Edit page to revise it. Choose Shared and Save and share page to publish to all current players; choose DM only and Save private page to conceal it. Previously delivered knowledge cannot be removed from another person's memory or saved copy. Plain text preserves line breaks and displays markup literally. Limit16 pages; titles80 and text1000 characters (browser emoji limits may be stricter).

Another tab's edit keeps your draft and disables saving; Reload page explicitly replaces it. A removed page keeps the draft for copying until Cancel. Dock-tab switches preserve drafts; full navigation/reload can discard them. Delete page opens a named confirmation and checks the captured version again. Offline, pending and archived tables cannot mutate journals.

## Chat and whispers (0.0.8)

Open Chat for saved text and roll cards. Public reaches all current campaign members. Whisper chooses1–8 other participants; the sender is included automatically, and DM access requires explicit selection. The directory lists members, not online status. A departed recipient remains selected with a warning until removed; privacy never widens automatically. Public and private drafts retain scope/recipients across dock tabs; full reload starts an explicitly labeled Public composer. Host errors keep the text. Recent history displays20 messages plus20 rolls; up to1000 of each are saved.

Dice → Selected participants uses the same explicit selection and can exclude the DM. Existing public/DM+me/only-me/blind scopes remain. Text and roll cards are plain/literal; no rich markup, slash commands or moderation UI yet.

When participants share a display name, selectors and conversation labels add a stable short account ID that expands until distinct. Use that label to identify the intended account. It does not expose login usernames.

## Workspace and generic combat (0.0.9)

Use scene tabs for local preparation; Show scene to players remains explicit. Select/Pan/fog/add-token/Scene/Dice/Combat/Help tools are on the left. Select a token on the map, then use its contextual inspector button; choosing a token in Scene opens that floating inspector directly. Drag a window by its title, use arrow keys on its move handle, resize at its corner and close with X/Escape. Open Combat and use Pop out combat tracker; closing docks the same form with drafts intact. Sidebar collapse/resize retains the canvas/camera and private composers. Layout preferences are scoped to campaign/account; form text is not persisted.

In Combat, prepare a named encounter for the selected scene, add its tokens and enter manual initiative. Begin combat starts round1; Next turn follows descending initiative with stable tie order and increments the round on wrap. Initiative edits keep the current token anchored. End combat asks for confirmation and retains the encounter; Clear encounter removes it while retaining actor HP. Only one encounter/campaign, max32 tokens; clear before creating another. No automatic initiative rolls/conditions/rules yet.

DM can edit all initiative and linked HP; current controllers/actor owners can edit their permitted fields. HP uses the linked character record and its version. Changed-elsewhere drafts remain for copying and require explicit field reload. Players see only currently visible tokens in the active shared scene, with readable actor fields; covered/private current turns display Awaiting GM. Take scene private removes the player tracker. Scene deletion removes the encounter; token deletion removes its entry and reconciles the turn. No hidden placeholders or counts are sent; round/activity metadata can still change.

## Freehand map markings

Choose Draw on map, then the Freehand icon, the shared or GM-only layer and a color. Drag a stroke and release to save it. A closed loop is allowed. Enter starts a keyboard stroke, arrows add points and Enter finishes; Escape cancels. Changing tools/settings/scenes, losing the connection or canceling/losing pointer capture discards unfinished work. Undo drawing reverses the latest drawing creation, edit or erasure in this scene.

Strokes use scene coordinates across pan/zoom, up to128 saved points and64 total shapes per scene. Long strokes may be simplified; a notice explains this. Shared drawings are sent only when their complete bounding rectangle is revealed, so a curve may stay hidden despite its own path looking revealed. GM-only geometry is never delivered to players. The eraser removes whole strokes; cutting only part of a stroke remains later work.

## On-map text editing

Choose Draw on map → Text. Click for a default box, or drag its bounds, then type directly on the battlefield. Click an existing label with Text selected to edit it. Use the move handle or resize corner; focused handles accept arrows (Shift moves farther). Choose font size8–96 scene pixels and a swatch or custom color. Text wraps and clips at the box edge; enlarge the box if text is hidden. Existing older labels keep their fitted appearance until edited.

Save text or Ctrl/Command+Enter commits to the host. Escape/Cancel discards the active edit; a failed save retains the draft/error. Offline saving is disabled. Other clients keep the last saved label until the edit is accepted. If another GM changed it, cancel and select it again to load that version. Changing scene/tool cancels the active editor; full navigation/reload can discard drafts.

Limits:1–120 Unicode scalars, up to four lines,40–1024×32–512 scene-pixel boxes. Markup is literal. Shared labels follow full-box fog filtering; GM-only content never reaches players. This is a label editor; scene-linked notes remain separate work.

## Eraser and undo

Choose the eraser icon, hover to identify the target, then click to remove a whole line, rectangle, freehand stroke or text label. The top rendered object wins where objects overlap. With the canvas focused, arrows select an object and Enter erases it. Middle-drag still pans.

Undo drawing or Ctrl/Command+Z on the canvas reverses the latest scene drawing creation, edit or erasure, including another GM's latest action. Up to128 changes per scene are retained across restart. Undo remains available when no drawings remain. There is no redo or partial-stroke rubber yet.

## Vertical drawing palette

Drawing modes live beside the left tool rail. Hover icons for names; Tab and Enter/Space select tools. Eye/lock choose shared/GM-only with a visible caption. The color chip opens swatches and a custom picker. Text has a compact style/Save/Cancel inspector beside its on-map editor. Close or Escape on the canvas exits drawing mode once any active gesture is canceled. Short rails scroll; on small screens the sidebar and drawing editor take turns.

## Scene notes and player briefings ·0.0.18

Open the notebook beside scene navigation, or Scene → Scene notes. The compact window moves/resizes like the token inspector and stays bound to the prepared scene. GM notes starts private; only GMs receive that text. Player briefing is separate, read-only for players and available only while that scene is on their table. Notes describe the whole scene and are independent of cell fog; they are not location pins.

Choose Add/Edit, type plain text (up to1000 Unicode characters, line breaks/tabs allowed), then Save GM notes or Share/Update player briefing. Clearing a saved briefing offers Clear player briefing and removes it from current player views; it cannot retract earlier knowledge. Ctrl/Command+Enter saves. Close/Escape, tabs and scene switches retain independent local drafts while the table remains mounted; full navigation/reload can discard them. No note text is saved to layout preferences.

Changed-elsewhere text keeps your draft and blocks stale saves. Reload saved note explicitly replaces that draft; Cancel returns to the current saved text. GM notes and player briefings have separate versions. Offline/archive/pending disables mutation; existing drafts stay readable/editable except while a save is pending. Host errors retain the draft. Scene deletion cascades its notes; players lose the notes view when the scene is concealed. Configurable map pins, journal links, rich text and note undo/history remain later work.

## Token health, manual markers and actions ·0.0.19

Right-click a visible token in the normal map mode, use the selected token's HUD Actions button, or focus the map with a selected token and press Shift+F10/ContextMenu. Token controls opens the existing inspector's Health & status section. The menu also offers a readable character sheet and GM appearance/visibility/delete actions; deletion still needs confirmation. Arrow keys/Home/End navigate, Escape returns to the map, outside click dismisses.

Enter Current HP and Maximum HP, toggle markers, then Save health & status. HP is an integer from0 to maximum; maximum1–1000000. Independent tokens start unset; blank both fields to remove the bar. Linked tokens use the sheet's HP and version, so sheet/combat/map stay synchronized; unlinking restores the independent values stored before linking. A marker-only save leaves the sheet version unchanged. Map bars default to GM/controllers. Only the GM changes sharing; a shared bar still requires access to a linked private sheet. Sheet/combat read permissions remain separate from bar visibility.

Marked, Bleeding, Poisoned, Prone, Stunned and Concentrating are manual token-owned markers visible to anyone who sees that token. They apply no rules. The small map bar and local vector badges follow movement/zoom/fog. Current controllers/actor owners can edit; losing authority removes private editable content. Failed/stale saves retain local input; Reload health & status explicitly replaces it with current values. Reset changes returns to saved values. Closing/selecting a different token can discard unsaved controls. Position & permissions contains the previous movement/control/link fields. Arbitrary resource bars, custom/automatic conditions and advanced transforms remain future work.

## Journal folders and search ·0.0.20

Open Journal. New folder creates a private GM folder; choose Parent folder for nesting. Use its arrow to collapse/expand and its named sliders button to rename, move or delete. Maximum16 folders/campaign, four folder levels, names1–60 Unicode characters. Invalid/deeper/circular parents are excluded from normal choices and rejected by the host. New page can choose a folder; Move page changes an existing page's placement without changing its text or sharing. Pages can also stay at Top level.

Delete folder requires confirmation. Its direct pages and child folders move to its saved parent; no page is deleted. Move/delete advances affected versions, so a concurrently open page/folder draft must explicitly reload. Stale/failed drafts stay in the form; Reload organization replaces them with current values. A removed destination is explicitly shown and can be changed to Top level. Cancel discards that form draft. Parent choices show their full path; folder actions are GM-only.

Search pages filters already authorized title/body text case-insensitively, with matching paths expanded and a no-match message. Players retain a flat list of currently shared pages, search included. Folder names/IDs/versions/counts never enter player REST/live projections, and organizing a page never shares it. Original text/visibility/stale-save behavior remains. Images/rich text, selective player grants, shared folder presentation and reusable templates remain later work.
