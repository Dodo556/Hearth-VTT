# VTT workspace and generic combat · 0.0.9

The user's correction is architectural: the current stacked dashboard bars, oversized forms, crowded navigation and inline inspectors are unsuitable for a growing VTT. Retain the working browser/host/domain systems, replace the table's interaction shell. Do not merely recolor the old layout or add nonfunctional tool icons. Continue T015 with real persisted combat. No new dependency, native app, public deployment, proprietary UI/code/art or unsupported release claim.

## Research and chosen approach

Official Roll20 Toolbar Overview (https://help.roll20.net/hc/en-us/articles/360039674753-Toolbar-Overview) and Foundry GM tutorial (https://foundryvtt.com/article/tutorial/) describe scene navigation, canvas tools and document sidebars; Foundry Combat Encounters (https://foundryvtt.com/article/combat/) documents a separate tracker/poppable document. These establish familiar interaction categories, not a source to copy branding or code.

A CSS-only reskin would preserve the current navigation/form problems. A general-purpose docking framework would add unnecessary dependencies and scope. Choose a small dedicated workspace shell with typed panel/tool slots, a reusable nonmodal window and a campaign/user-scoped preferences hook. Existing feature components and server commands remain independent consumers. New mapping/rules/media features can register in those slots later.

## Layout and interactions

- Compact40px campaign bar;44px scene navigation with individual prepared-scene tabs and explicit player-active indicator. Keep the accessible Prepared scene selector in Scene settings for keyboard/large lists. DM scene selection never publishes automatically.
- Map occupies the workspace between bars, with floating left tool rail (Select, Pan, reveal/hide fog, add token, scene settings, Dice, Combat, Help). Only implemented actions are present. Pan prevents token selection/movement while panning.
- Right sidebar320–520px, pointer/keyboard resizable, collapsible, icon tabs with accessible labels and active title. Typed registry: Chat, Combat, Dice, Journal, Characters, Scene, People (People DM-only). No horizontally overflowing label strip. Small screens use overlay sidebar rather than crush the canvas.
- Chat is the default panel. Its history flexes to available height with composer pinned below; remove decorative headings and giant cards from table panels. Keep private scope/drafts/recipient IDs mounted through tab/collapse/popout navigation. Compact neutral graphite theme, restrained amber accent, legible12–13px UI; typography/spacing tokens and scoped table CSS, not ad hoc per-screen restyling.
- Reusable draggable/keyboard-movable nonmodal WorkspaceWindow for token inspector and optional combat popout. Native modal Dialog remains for full document forms, with shared compact styling. Keep windows inside viewport; closing one does not delete state. No focus traps for nonmodal windows.
- Token selection does not force Chat away; contextual HUD opens the token inspector, edits/art and linked sheet. Selecting a token from Scene directory can open its inspector immediately. Expose one TokenInspector instance to avoid duplicate forms.
- Bottom quick-dice strip prepares a formula and opens Dice, retaining its existing visibility; it never silently rolls publicly. Member strip shows campaign membership, not fake online presence. Thin connection/map-art-disclosure footer remains visible.
- Save only sidebar width/open/active-panel preferences in localStorage keyed by user+campaign. Catch unavailable/corrupt storage and clamp values. Never persist private document content/recipients/sessions there. Canvas instance/camera survives panel resize/collapse and data updates.
- Keyboard shortcuts Shift+C Chat, Shift+D Dice, Shift+I Combat, Shift+J Journal, Shift+B sidebar; ignore form fields/contenteditable/open modal. Escape closes the focused nonmodal inspector. Help lists actual controls. Keep regular Tab navigation.

## Generic combat scope

The separate combat contract defines exact wire/storage behavior. DM prepares one scene-bound encounter, adds tokens, manually sets initiative, starts/advances/ends/clears; linked owners may edit their own initiative and HP. Real actor HP remains the sole source of truth. No automatic rules/damage/dice-for-initiative, conditions or player end-turn authority this increment. Hidden combatants/actor fields are projected before delivery; no hidden placeholders/counts.

## Verification/delivery

Real DM/Alice/Bob checks for old features, combat persistence/ACL/version/hidden-fog behavior, responsive workspace, sidebar keyboard/pointer resize, popout bounds, draft/privacy preservation and camera identity. Preserve179 feature IDs; broad UX/CMB IDs stay IN_PROGRESS. Capture actual0.0.9 screenshots with fictional demo accounts and populated combat, not generated mockups. Run browser acceptance without competing screenshot browsers, then capture. Ready-to-run host distribution/full restore/P0 encounter/LAN gates remain pending.
