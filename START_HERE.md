# Run and test Hearth VTT · build0.0.16

Yes: you can run and test this build on your own computer. It is a working self-hosted web app, currently distributed as developer source. Both DM and players use browsers; only the host computer needs the tools below. No native player client is installed. Do not open index.html directly: the Rust web server provides accounts, persistence and live synchronization.

## First run on Windows

1. Extract the entire source ZIP to a normal writable folder. Open its `hearth-vtt` folder—the one containing package.json, Cargo.toml and START-HEARTH.cmd.
2. Install [Node.js24 LTS](https://nodejs.org/en/download).
3. Install [Rust using rustup](https://rust-lang.org/tools/install/). Use the standard MSVC toolchain. When requested, install Microsoft's [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **Desktop development with C++**, including MSVC and a Windows10/11 SDK. An existing suitable Visual Studio installation is sufficient. The project pins Rust1.99.1; rustup downloads it on the first build.
4. Open a **new** Command Prompt in that folder and install the pinned package manager once:

   ```cmd
   npm install --global pnpm@11.25.0
   ```

5. Double-click **START-HEARTH.cmd**, or run:

   ```cmd
   pnpm try
   ```

   This checks the required tools, installs locked dependencies, builds the browser bundle, then compiles/starts the host. The first Rust build can take several minutes. Keep the terminal open.
6. When the host reports ready, open **http://127.0.0.1:8787**. Create the owner account and leave the sample-campaign option enabled.

PowerShell users can run `npm.cmd`/`pnpm.cmd` if script execution policy blocks the .ps1 wrappers; changing execution policy is unnecessary. The Windows command wrapper and prerequisites are supplied, but actual Windows execution still needs a Windows smoke test. Linux browser/server behavior has been verified here.

On Linux/macOS, install Node24, pnpm11.25 and Rust via their official installers, plus the OS C/C++ linker/build prerequisites, then use the same `pnpm try` command. macOS execution is not yet verified.

## Test a DM and player on one computer

1. Keep your normal browser window signed in as DM. Open The Amber Keep.
2. Choose **Invite players → Create invitation**. Copy its invitation link.
3. Open that link in an **Incognito/private window or another browser**. Create a new player account. Normal tabs share a login cookie, so use separate browser sessions for separate identities.
4. In the DM's Scene tab, select Rowan and choose the new player under **Controlled by**.
5. In the player window, select that token and drag it, use Token X/Y, or focus the map and press arrow keys. Both views should agree. The private sentinel/journal remain absent from the player view.
6. Try **New scene**: upload a PNG/JPEG/WebP (up to8MiB and4096px/side), enter a scene name and grid size, then Create scene. This is private preparation; the player remains on the previous scene.
7. **Add token**, choose its name/art/size/position and visibility. New tokens default to DM-only; choose Shared with players when appropriate, then assign control.
8. Choose **Show scene to players**. Selecting a different prepared scene locally as DM does not move players. **Take scene private** clears their map. Choose a token in Scene to open its floating inspector with edit/delete controls.
9. Refresh/reconnect the player and check the latest state. Close the DM browser window: the host terminal keeps the session running. Stop the host with **Ctrl+C**, restart with `pnpm try`, and sign in again; committed campaigns, maps and token positions persist.

Characters creates generic sheets with portrait/biography/HP/eight text properties and private DM notes. Grant Observer to read or Owner to edit/move linked shared tokens. Scene → token → Linked actor clears its standalone controller; Open sheet opens the character. Stale sheets and renamed scenes require explicit latest-value reload. Scene rename/delete controls are in the Scene dock.

Saved chat/private whispers, selected dice and generic combat/manual initiative/linked HP are included. Owner browser backup/verification/isolated recovery are available. Advanced dice notation, automatic vision and inventory/system rules remain pending. The finished host will ship without development-tool installs; this source checkpoint is not that portable package yet. This is not a complete playable P0 release.

## Another device on a trusted LAN

Localhost links work only on the host computer. First configure the owner locally, then stop the host. In PowerShell, replace the example address with the host's actual private IPv4 address:

```powershell
$env:HEARTH_ALLOW_LAN = 'true'
$env:HEARTH_BIND = '192.168.1.20:8787'
$env:HEARTH_ORIGINS = 'http://192.168.1.20:8787,http://127.0.0.1:8787'
pnpm.cmd try
```

Open the LAN address in the DM browser before generating invitations. Permit access only on your trusted private network if Windows Firewall asks. Players open the shared LAN invitation URL and install nothing. Physical LAN/firewall operation is not yet verified; this build does not provide secure public internet hosting, HTTPS or port forwarding. LAN HTTP is unencrypted.

## Manual commands and troubleshooting

The launcher runs these same commands:

```sh
pnpm install --frozen-lockfile
pnpm build
cargo run --locked -p hearth-server
```

- `pnpm`/`cargo` not found: finish installation, then open a fresh terminal.
- `link.exe` or SDK missing on Windows: install the C++ workload/SDK above.
- Cannot bind8787: another host may already be running. Stop it, or choose HEARTH_BIND and matching HEARTH_ORIGINS as described in docs/HOSTING.md.
- Data directory in use: stop the other host using that directory; do not delete an in-use lock file.
- Owner setup does not appear: the existing owner/data directory was retained. Sign in; do not delete your campaign store to reset it.
- Artwork failure: reconnect or use Retry artwork. For uploads, reduce size/dimensions and choose actual raster PNG/JPEG/WebP, not renamed SVG/HTML.
- Keep the full configured data folder, including `assets/`, when backing up. See docs/BACKUP_RECOVERY.md. Source updates do not overwrite that folder.

Automated checks for developers are listed in README.md. The quick cumulative build overview is docs/BUILD_OVERVIEW.md.

### Try manual fog

In the DM Scene tab, enable fog, close any floating inspector covering the intended area, choose Reveal area and drag a rectangle. Join in a separate browser/private session to see the covered map and only completely revealed shared tokens. Try Hide area, reconnect the player, then stop/restart the host to check persisted exploration. Use the numeric rectangle form for keyboard access. Reveal all/Disable fog ask for confirmation. The complete background image remains downloadable; do not put confidential text in map artwork.

### Try host dice

Open Dice on the table. Enter `2d6+3` or `(d20+4)/2`, select Public / DM + me / Only me / Blind / Selected participants, then use the scope-specific Roll button. Quick dice use the same selected scope. Check a separate player session: public results reach everyone, DM + me reaches only the roller and DM, Only me excludes other users including the DM, and a player's blind result reaches only the DM. Blind acceptance is not a visible result for that player. History is saved on the host and refreshes after reconnect; the panel shows the latest20 authorized rolls, with1000 retained per campaign.

Up to120 ASCII characters,100 dice total,1000000 sides/constants,12 nested levels and finite arithmetic within±1000000000. Division can produce fractions (the UI rounds to4 decimals and exposes the recorded total on hover). At most10 accepted rolls per10seconds per player/campaign. Selected participants includes only the roller and chosen members; include DM explicitly. Advanced keep/drop, rerolls and exploding dice remain later work. Private scopes protect browser delivery; the trusted host owns the local database.

## Try the new journal authoring

Open Journal → New page. Create a private note, then select it → Edit page → Shared → Save and share page. Two player windows should see it appear. Change it back to DM only and save; it disappears for players. Two DM tabs editing the same page should keep the losing tab's draft and require Reload page. Delete page asks for confirmation. Plain text only; chat and whispers are available in Chat.

## Try chat, whispers and selected rolls

Open Chat in DM/Alice/Bob windows. Send Public from Alice; everyone sees it. Choose Whisper and only Bob, then send: DM must not receive it. In Dice choose Selected participants → Bob and roll; Bob's Chat shows the card, DM's does not. Switch tabs with an unsent private draft and confirm scope/recipient stay selected. Reconnect Bob and review saved history. Rich chat and automated combat rules remain later work; whole-host isolated recovery is available.

## Try the new VTT workspace and combat

Scene tabs and the left tool rail surround the map. Collapse the right sidebar or drag/focus its divider to resize; the camera remains in place. Pan drags the map even over tokens, Select permits token interaction. Bottom quick-dice buttons prepare a formula and preserve its scope; use the explicit Dice Roll button to roll. Chat/Dice/Journal and loaded character/combat drafts survive sidebar changes, but full navigation can discard drafts.

Link tokens to Characters for HP, then open Combat. Prepare a named encounter, add scene tokens, enter manual initiative and Begin combat. Next turn follows descending initiative and wraps rounds. Owners can edit their controlled initiative/linked HP; other players read authorized state. Hidden NPC turns say Awaiting GM without leaking their name/art/HP. End retains the encounter; Clear retains character HP. One encounter/campaign, max32 participants. Pop out the tracker, drag/resize it, then close to dock the same draft. Conditions, automatic initiative rolls and rules automation remain pending.

Shortcuts: Shift+C Chat, Shift+D Dice, Shift+I Combat, Shift+J Journal, Shift+B sidebar; they ignore form fields and open dialogs. The Help button lists current controls. On narrow screens the sidebar overlays the table. Only account/campaign sidebar preferences persist locally; private text/recipient lists do not.

## Try backup and recovery

As host owner, open **Backup & recovery** from the library or table header. Prepare/download, choose the file, Verify backup, then Create recovery copy. A corrupt file must fail without altering your running host. Use the displayed recovered path as HEARTH_DATA_DIR after stopping the host, then restart and sign in with the backup’s account passwords. Test two player sessions again. Old cookies/unused invitations are intentionally invalid in that copy. Keep backups private: they include every participant’s private content. Full instructions and bounds are in docs/BACKUP_RECOVERY.md.

## Ruler and pings

Choose the ruler on the left toolbar and drag across the map. Distance is a straight line measured in grid squares, not a game-specific movement rule. With the canvas focused, Enter starts a measurement, arrow keys adjust its end, and Escape clears it. Choose Ping and click a revealed point on the active shared scene to show a brief marker to connected players. Keyboard users can move the marker with arrows and send it with Enter. Private or inactive scenes cannot be pinged to the group.

## Draw on a map

In a campaign as the GM, select **Draw on map** (pencil) from the left toolbar. Choose the line or rectangle icon from the vertical palette, the shared eye or GM lock layer, then a swatch from the color chip and drag across the map. Hover icons for names. **Undo drawing** removes the most recently added drawing in that scene. For keyboard use, focus the map, press Enter to start, use arrow keys to move the end, then press Enter to finish; Escape cancels. Drawings save with the scene. A shared drawing appears to players only when its entire bounding box is revealed.


## One application, safely updated

The source launcher and the future ready-to-run package build the same Hearth; there is no separate playable edition. For development checks use `pnpm verify`; for an optimized candidate use `pnpm verify:release` after installing the documented toolchains and Playwright browser. Never test a candidate against your only real campaign copy. Before an update, preserve the current application/web assets/configuration and a full data/artwork backup. Rollback restores that compatible pair, not just an older server executable. See docs/CONTINUOUS_DEVELOPMENT.md, docs/RELEASE.md and docs/BACKUP_RECOVERY.md.

## Text labels on the map

As GM choose **Draw on map → Text icon**. Enter up to120 characters over at most four lines, choose Shared or GM only, and drag a box. The preview shows how the local-font text fits. Use a larger box for larger lettering. Boxes are40–1024 scene pixels wide and32–512 high. Enter/arrows/Enter also works; Escape cancels. Undo drawing removes the last saved shape. Text is literal, persists on the host and follows full-box fog filtering. Scene-linked notes are the next increment.
