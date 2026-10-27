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

Choose Draw on map, then Shape → Freehand, the shared or GM-only layer and a color. Drag a stroke and release to save it. A closed loop is allowed. Enter starts a keyboard stroke, arrows add points and Enter finishes; Escape cancels. Changing tools/settings/scenes, losing the connection or canceling/losing pointer capture discards unfinished work. Undo drawing removes the last saved shape in this scene.

Strokes use scene coordinates across pan/zoom, up to128 saved points and64 total shapes per scene. Long strokes may be simplified; a notice explains this. Shared drawings are sent only when their complete bounding rectangle is revealed, so a curve may stay hidden despite its own path looking revealed. GM-only geometry is never delivered to players. Text and individual stroke editing/erasing remain later work.
