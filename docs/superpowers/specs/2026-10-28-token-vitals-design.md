# Token HP, manual status markers and context actions ·0.0.19

Continue TOK-03 under the owner's autonomous implementation/UI direction and remaining47% usage budget. Use the existing Rust/SQLite/live commands and React/Pixi controls, no dependency. Native implementation and one fresh final review; choices here are the builder's bounded implementation decisions.

## Model and authority

Independent tokens may have one HP resource (both hp/maxHp nullable when unset). Linked tokens use the existing actor's hp/maxHp/version; update that same actor atomically so sheet/combat/map stay synchronized. Independent values remain stored while linked and return on unlink. Do not add duplicate linked HP or automation. Bounds: hp0..maxHp, maxHp1..1000000. Clear/unset is permitted only for independent tokens.

Migration0016 appends tokens.vitals_version(default1),hp/max_hp(nullable),hp_visibility(default controllers; controllers/shared),statuses(JSON empty array). Preserve migrations0001..0015. Exactly six optional manual markers: marked,bleeding,poisoned,prone,stunned,concentrating; reject unknown/duplicate/more than6. Markers belong to the placed token and are visible to readers of that token; no automatic game-rule effect. Link/unlink and actor deletion advance token vitals version, preserving stale-draft protection.

Strict command `token.vitals.update {tokenId,expectedVersion,expectedActorId,expectedActorVersion,hp,maxHp,hpVisibility,statuses}`. All fields required, actor identity/version and HP pair explicitly nullable. Require positive safe versions below MAX_SAFE_INTEGER, exact current token version and linked source identity/version, current campaign revision/receipt/membership/archive and visible token. GM or current token controller/linked actor owner may edit; only GM changes map HP sharing. Hidden/foreign targets stay hidden even for a controller. Missing/stale binding or version returns STALE_TOKEN_VITALS with retained-draft guidance; no mutation/nonces/revision on failure.

Projected Token optionally adds statuses(nonempty), health:{hp,maxHp} only when initialized and readable under map-bar policy, and vitals:{version,hp,maxHp,hpVisibility,actorVersion?} only for authorized editors. GMs/controllers see map HP by default; shared bars still require readable linked actor. Never expose a hidden actor identity/version/HP through a visible token. Existing actor/sheet/combat read permissions remain independent; map-bar privacy does not revoke previously available sheet data. Filter token scene/fog/visibility before decorations/controls. Use content-free snapshot events. Whole-host backup schema16 supports canonical10..15 archives and retains exact HP/markers/versions; original15 scene notes survive isolated upgrade.

## UI and rendering

Add a compact Health & status section at the top of the existing token inspector. One explicit Save applies HP/markers, with labeled current/max fields, clear sharing explanation, icon+label marker toggles, error retention and explicit Reload when token/source changes. Unconfigured independent HP starts blank; clearing both removes its bar. Players cannot change sharing. Read-only viewers see only permitted public health and markers. Preserve draft when saves fail; remove editable/private content on lost control. Linked helper identifies sheet synchronization. Do not overwrite unrelated actor fields.

Render a small locally drawn HP bar beneath permitted tokens, adjusting name-label spacing only when a bar exists. Add recognizable bundled SVG/vector status icons above tokens, six maximum, using existing icon language. Decorations move/scale with token/camera, obey fog/privacy, render on change, recover after WebGL context loss and clean up with the token. No per-frame loop/network/dependency.

Right-click a visible token in ordinary select/pan mode or use Shift+F10/ContextMenu on a selected token; selected-token HUD also offers Actions. Open one compact vertical HTML menu: Token controls, readable sheet, and permitted GM appearance/visibility/delete actions. Reuse existing inspector/editor/delete confirmation. Native buttons plus arrow/Home/End/Escape navigation, outside dismissal and viewport clamping; clear stale menu on scene/target loss. No new canvas tool rail.

Reuse existing slate/gold styles,36px action targets and bounded contextual windows. Keep inspector/menu clear of the overlay sidebar on narrow screens; check1440×1000,760×700,390×700 and900×520 with real captures, fully visible actionable controls and keyboard focus.

## Evidence / limits

Protocol and real-host RED→GREEN for default privacy, controllers/ownership, explicit sharing, binding/version conflicts, linked sheet/combat synchronization, unlink/delete, malformed HP/markers, fog/foreign/archive/revocation, receipt dedupe and persistence. Current backup/old15 upgrade and maximum snapshot bounds. Focused component/menu tests and real GM/Alice/Bob rendered bars/markers, context actions, hidden-data absence, conflict/reload, restart/idle/context restoration and responsive UI. One fresh review and complete optimized gate before delivery. Keep179 IDs/partial status, no platform/LAN/P0 promotion. Arbitrary resource bars, custom/automatic conditions, per-status privacy, prototype behavior and advanced token transforms remain later work.
