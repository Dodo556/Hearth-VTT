# ADR-0002 · Browser-only DM and player experience

Date: 2026-10-22. Status: accepted by explicit user instruction. Supersedes desktop-shell/installer portions of ADR-0001 and the original master specification.

The product is a self-hosted web application. The DM starts one headless server on their computer or a server they control, opens the DM dashboard/table in a browser, and shares individual invitation links. Players open those links in ordinary browsers and install nothing. All campaign preparation, play, account management and hosting controls presented to users belong in the web interface.

Keep Rust/Axum/SQLite for the authoritative hosting server and React/TypeScript/Pixi for the shared browser client. This is already the implemented runtime architecture. A server process remains necessary for persistent authoritative state and connections; browser-only product interaction does not mean a static page or a browser tab hosting the backend. Closing or unfocusing the DM tab must not terminate the server.

Remove the future Tauri/Electron/native desktop shell, system tray, app-store and Windows/macOS application installer work. Developer source-build prerequisites are not product UI requirements. Host distribution should become a straightforward server bundle/container and documented start workflow; pick and verify the concrete packaging in a later hosting slice. Do not introduce a second backend or cloud service to satisfy this correction.

Prioritize a clear browser dashboard, correct local/LAN/configured remote URL, straightforward invitation/join UI, connection states and reconnection. Smooth interaction depends on GPU canvas rendering, efficient server-authorized deltas and local camera state. Do not delay those tasks for desktop packaging.

All gameplay, permissions, privacy, persistence and security requirements remain. Retain all 179 feature IDs; reinterpret host-distribution IDs as web-server/browser delivery where their original wording assumed a native app. Internet reachability still requires tested HTTPS/WSS and a suitable network strategy; this correction does not make the current LAN development host internet-ready.
