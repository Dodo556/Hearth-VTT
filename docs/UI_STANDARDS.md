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

Reuse the existing slate surface/text/accent CSS variables. Use restrained borders and one panel shadow; no feature-specific colors for ordinary controls. Keep panel labels12px, secondary help11px and headings compact. Gold marks selection, not destructive actions. Buttons and inputs have a visible keyboard focus outline. Native buttons support Tab and Enter/Space; do not replace them with clickable divs. The4 existing drawing colors are swatches in a small picker, opened from the current-color chip.

## Size and overflow

Drawing palette width50px; text editor maximum224px. Editors shrink within available map space, leaving a gap before the sidebar. Keep editor fields inside the panel and allow vertical scrolling on short windows. Tool rails scroll independently when they cannot fit; actions must remain reachable above the bottom dock. Do not shrink targets to fit more tools.

At640px or less, or when the chosen sidebar width leaves less than320px for the map editor, opening drawing controls collapses the sidebar; opening a sidebar panel closes drawing controls. Resizing into that condition also collapses the sidebar. Drafts remain in the existing React feature state. Above that width the palette/editor and sidebar can coexist. A larger editing surface is still preferable for GM authoring; do not claim a complete touch/mobile audit from narrow screenshots.

## Adding the next tool

1. Put canvas modes in the existing tool system and use ToolButton. Put record editing in an existing sidebar or contextual inspector.
2. Reuse spacing, colors, selected/focus states and the close/Escape/draft behavior above. Keep grouping consistent: tool, visibility, style, undo.
3. Preserve host authorization, saves, cancellation and canvas lifecycle; UI icons do not change permissions or persistence.
4. Run the affected real workflow, then the required integrated gate. Check1440×1000 desktop,760×700 narrow,390×700 constrained and900×520 short-height layouts for tool/editor/sidebar collisions and reachable actions. Keep useful geometry assertions rather than brittle exact screenshot snapshots.
5. Capture and inspect the real app with fictional data, including a tool without a form and a tool with its editor. Record evidence and update BUILD_OVERVIEW. A green test suite alone is not visual approval.

These are defaults for future work. Change the standard deliberately when a real workflow needs it, then update this document and the shared control. Avoid parallel one-off toolbar designs.
