# Host operation

Install the prerequisites in [START_HERE](../START_HERE.md), then run `pnpm try` (or START-HEARTH.cmd on Windows). The launcher installs frozen dependencies, builds the web bundle and starts the Rust host. Manual equivalent: `pnpm install --frozen-lockfile`, `pnpm build`, `cargo run --locked -p hearth-server`. Open `http://127.0.0.1:8787` in the DM's browser. Players use their browsers and individual invitation links. This is a web app with a DM-controlled headless server; no Windows/macOS desktop interface is planned. The Rust web-server process must remain running; Ctrl+C performs graceful HTTP shutdown and closes the SQLite pool. Closing the DM browser tab does not stop the service. The current source build still requires the developer toolchain; prebuilt server distribution and the full browser host dashboard are future work. The source launcher has been exercised on Linux; Windows/macOS execution is not yet verified.

| Variable           | Default / behavior                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `HEARTH_BIND`      | `127.0.0.1:8787`; explicit socket address                                                                         |
| `HEARTH_DATA_DIR`  | OS user-local application data directory via ProjectDirs; contains hearth.db, host.lock, assets/, backups/, logs/ |
| `HEARTH_WEB_DIR`   | `web/` beside the binary when present, otherwise source-tree `apps/web/dist`                                      |
| `HEARTH_ORIGINS`   | exact comma-separated HTTP origins for localhost/127.0.0.1 on ports 8787/5173                                     |
| `HEARTH_ALLOW_LAN` | false; must equal `true` to bind a private network interface                                                      |

For another machine on a trusted LAN, first create the owner through loopback. Stop the host, then configure a specific private interface and its exact browser origin. Example PowerShell (replace the private address with your actual address):

```powershell
$env:HEARTH_ALLOW_LAN = 'true'
$env:HEARTH_BIND = '192.168.1.20:8787'
$env:HEARTH_ORIGINS = 'http://192.168.1.20:8787,http://127.0.0.1:8787'
cargo run --locked -p hearth-server
```

Open the LAN address in the DM browser before generating an invitation so the copied URL uses that address. Each link is single-use and approves one new account. Existing-account invite redemption is not implemented. On Windows, permit only the appropriate private-network firewall rule; this app does not alter the firewall/router automatically. Physical LAN and Windows firewall operation still require manual verification.

Wildcard/public binds are refused. Public internet hosting, reverse proxy trust, HTTPS/WSS, VPN-specific diagnostics, CGNAT help and TURN are planned and must be verified before exposing a remote host. No remote-access guarantee is made. The current HTTP cookie is not Secure because this stage explicitly supports only loopback/trusted LAN HTTP.

If startup says the data directory is in use, stop the other host; do not delete the lock file while it is running. If the port is occupied, choose a different `HEARTH_BIND` and update `HEARTH_ORIGINS`. If requests return FORBIDDEN, the browser's exact scheme/host/port is not configured. If the UI cannot reach the API during development, start both processes with `pnpm dev`.

Final distribution must require no Node/pnpm/Rust/Visual Studio/database installation. Portable ready-to-run headless server packaging is required, but not delivered/verified in this source checkpoint. All DM/player interaction remains browser-only.
