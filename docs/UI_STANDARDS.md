# Hearth workspace UI standard

Owner direction,2026-10-28: use familiar VTT controls and reuse them as features grow. Read this before changing any workspace tool, palette, panel or form. Apply it to the surface being changed; do not repeatedly redesign the whole application.

## Stable regions

- Top: campaign/session identity and scene navigation.
- Left: vertical canvas tools. Contextual tools open a second slim vertical palette beside that rail.
- Right: collapsible/resizable directories, chat, sheets and trackers. These are panels, not canvas tools.
- Bottom: quick dice/actions and concise connection/save feedback. Keep map instructions above this dock and leave a clear lane for the lower-right camera controls.
- A contextual editor is a compact panel beside its palette, shown only when that tool needs input. Do not grow a horizontal form across the map when adding a field.

## Tools and visual language

Use `workspace/ToolButton.tsx` and the existing Lucide icon family. Use icons for shapes and common canvas actions, native tooltips for discoverability, and explicit accessible names for every button. Shape names belong in those names/tooltips, not in a select menu. Avoid drawing unsupported/placeholder tool icons. Text entry, destructive confirmation and complex properties retain readable labels.

Tool buttons use36×36px targets and18px icons; palette padding6px, spacing4px and restrained dividers. The main rail and drawing palette share hover, disabled and selected styling. Selected tools use the warm accent plus an inset marker and `aria-pressed`; color selection also uses an outline. Show a visible Shared/GM-only caption so privacy does not rely on icon recognition or color. Clicking the main Draw on map button again or the close action closes the secondary palette. Picking a shape keeps drawing mode active. Escape in an editor returns to the canvas; Escape on the canvas cancels its gesture.

Reuse the existing slate surface/text/accent CSS variables. Use restrained borders and one panel shadow; no feature-specific colors for ordinary controls. Keep panel labels12px, secondary help11px and headings compact. Gold marks selection, not destructive actions. Buttons and inputs have a visible keyboard focus outline. Native buttons support Tab and Enter/Space; do not replace them with clickable divs. The4 drawing swatches and native custom-color control live in a small picker opened from the current-color chip.

## Size and overflow

Drawing palette width50px; text style inspector maximum224px. The editable text box is positioned directly on the map in scene coordinates, using explicit font size at the current camera scale. Editors shrink within available map space, leaving a gap before the sidebar. Keep editor fields inside the panel and allow vertical scrolling on short windows. Tool rails scroll independently when they cannot fit; actions must remain reachable above the bottom dock. Do not shrink targets to fit more tools.

At640px or less, or when the chosen sidebar width leaves less than320px for the map editor, opening drawing controls collapses the sidebar; opening a sidebar panel closes drawing controls. Resizing into that condition also collapses the sidebar. Drafts remain in the existing React feature state. Above that width the palette/editor and sidebar can coexist. A larger editing surface is still preferable for GM authoring; do not claim a complete touch/mobile audit from narrow screenshots.

## Adding the next tool

1. Put canvas modes in the existing tool system and use ToolButton. Put record editing in an existing sidebar or contextual inspector.
2. Reuse spacing, colors, selected/focus states and the close/Escape/draft behavior above. Keep grouping consistent: tool, visibility, style, undo.
3. Preserve host authorization, saves, cancellation and canvas lifecycle; UI icons do not change permissions or persistence.
4. Run the affected real workflow, then the required integrated gate. Check1440×1000 desktop,760×700 narrow,390×700 constrained and900×520 short-height layouts for tool/editor/sidebar collisions and reachable actions. Keep useful geometry assertions rather than brittle exact screenshot snapshots.
5. Capture and inspect the real app with fictional data, including a tool without a form and a tool with its editor. Record evidence and update BUILD_OVERVIEW. A green test suite alone is not visual approval.

These are defaults for future work. Change the standard deliberately when a real workflow needs it, then update this document and the shared control. Avoid parallel one-off toolbar designs.

## Direct text and object erasing

Text starts with click/drag placement, then native typing in the scene-positioned box. Keep style/Save/Cancel in the compact inspector. Place36px move/resize handles just outside the text box so they do not obscure its characters; use pointer capture and arrow/Shift-arrow support. Save is explicit (Ctrl/Command+Enter); Escape/Cancel ends an active edit. Keep failed drafts and disable mutation while pending/offline. New explicit-size text clips at its bounds rather than silently shrinking. Preserve legacy fit until edited. Camera changes must keep editor/handles aligned.

Use the eraser icon for whole-object removal and show its target before click; keyboard arrows/Enter provide equivalent targeting. Undo stays available after the last object is erased. Preserve middle-drag camera motion in every tool. Do not add partial-stroke/redo controls until their host behavior exists.

## Scene-context records

Scene notes open through the named notebook beside scene navigation or the Scene panel; use the existing WorkspaceWindow instead of a new canvas mode or horizontal form. Scope tabs clearly label GM notes/private preparation and Player briefing. Use read mode first, labeled editing, a Unicode counter, explicit Save/Share/Update/Clear actions and retained failed/stale drafts with explicit reload. Retain each scene/scope draft across window close and local scene preparation; never write private bodies into layout preferences. Reuse window clamp/scroll/resize and focus return to the scene action. Keep mutation states and visible scope help consistent with journals.

For scene notes, the sidebar and note window take turns at800px or below, matching the existing overlay-sidebar breakpoint, or when the chosen sidebar width leaves less than320px. Resizing into that range keeps the note editor visible; explicitly opening the sidebar closes the note window while preserving drafts. The default540px window exposes Save without scrolling on a normal desktop; short screens scroll within the window. Check full button visibility and actual sidebar occlusion, not only viewport coordinates.

## Token records and context actions

Use the existing token WorkspaceWindow with Health & status and Position & permissions sections. Keep labeled HP fields, explicit Save/Reset/Reload and icon+label manual markers; GM-only sharing is clear text. Default selection can retain position controls, while the context menu opens health controls. Use a compact vertical native-button menu with icons, clear destructive wording and the existing delete confirmation. Support right-click, selected-token Actions and Shift+F10/ContextMenu; arrows/Home/End navigate and Escape returns canvas focus. Clamp menus inside the actual map stage above its footer and before the sidebar; overflow scrolls within the menu.

Token inspector/sidebar use the same800px/insufficient-map-space exclusion as scene notes, including resize. Both inspector sections remain mounted while switching; stale/failed drafts require explicit reload. Lost edit authority unmounts private controls. Do not promise unsaved token drafts survive window close/selection. Decorations use bounded local vector icons and owned Pixi graphics, follow camera/token transforms and render only on change.

## Content directories

Journal search and New page/New folder are sidebar record actions, grouped using the shared text buttons. Named icon actions retain36px targets. Indent folder contents, use native disclosure buttons with aria-expanded and named icon actions, and show meaningful empty/no-match states. Search uses only authorized pages and expands paths. GM-only folder organization never implies sharing; players retain a flat shared list. Use the existing bounded dialog for folder create/manage/page move, full-path parent choices, explicit save/confirmation and stale reload. Deleted or newly ineligible destinations remain explicit selectable-state messages so a draft can move to Top level without losing input. Keep actions fully reachable at narrow/short sizes. Rich media and further directories should extend this pattern.

## Journal image handouts

Extend the Journal sidebar with one optional raster image, a labeled native upload input, bounded preview, Remove image and explicit Reveal to players/Hide from players actions. Reuse record buttons and scope labels. Upload/replace keeps the draft private; save privately before reveal. Preserve failed/stale drafts, disable changes while saving/uploading/offline, and show image loading/failure/Retry states. Offer the authenticated full image for detailed reading. Keep the privacy disclosure visible: hide stops future access and cannot recall delivered images or independent grants. Images fit the panel; actions remain reachable through its existing scroll area at desktop/narrow/constrained/short sizes.
