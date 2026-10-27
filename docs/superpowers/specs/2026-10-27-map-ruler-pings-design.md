# Ruler and shared map pings

## Goal

Give DM and players two immediate tabletop tools in the existing browser workspace: measure a line on the current scene and draw attention to a shared location. This is one incremental part of MAP-05, not the full drawing/layer or scene-note feature set.

## Design and tradeoffs

The ruler is local and measures a straight Euclidean line in scene grid squares, with one decimal place; a square has no assumed feet/meters. Drag on the map or use Enter and arrow keys on the focused canvas. Keep the last measurement until Escape, scene change, or replacement, and render it in world coordinates so pan/zoom do not alter the value. Future configurable units, diagonal rules and waypoints remain separate work.

Pings are transient WebSocket messages, not durable campaign changes. A click on a shared active scene sends a bounded point; the host authorizes the current session and campaign, checks scene bounds, current shared/active status, archived state and revealed fog cell, and assigns the sender identity. The host rechecks the recipient and current visibility before delivery. Limit ping frequency per connection and keep the broadcast queue and client visuals bounded; do not persist or replay pings on reconnect. UI shows only the current scene's brief ring, with a clear explanation when a private, inactive or fog-covered location cannot be pinged. This intentionally does not share a ping from a DM's private preparation scene.

Reuse the existing Pixi world and workspace toolbar, preserve selection/fog/pan behavior, cleanup timers and pointer state, and do not add dependencies or change the database. A host/browser pair from this development build must be refreshed together because the strict live protocol gains a ping frame.

## Acceptance

- World-coordinate geometry, edge clamping and keyboard actions are verified independently of render scale.
- Live real-socket tests cover two players, owner, private/inactive scene, malformed/out-of-bounds and hidden-fog locations, unchanged revision, and current authorization.
- Browser checks exercise real canvas pointer/keyboard, zoom/pan and shared ping rendering while confirming a ruler does not move a token and a private scene does not produce player pings.
- Existing full suites, matched web/server build and actual fictional screenshot run before delivery. No P0, LAN, current-browser or installation-free hosting claim is implied.
