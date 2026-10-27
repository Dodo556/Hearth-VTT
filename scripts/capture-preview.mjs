// Capture the actual app with fictional demo accounts in an isolated temporary store.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";
import { testHostExecutable } from "./test-runtime.mjs";

const baseURL = "http://127.0.0.1:8792";
const data = mkdtempSync(join(tmpdir(), "hearth-preview-"));
const output = resolve(process.argv[2] || "Hearth_VTT_Preview.png");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const child = spawn(testHostExecutable(), [], {
  stdio: ["ignore", "ignore", "inherit"],
  env: {
    ...process.env,
    HEARTH_BIND: "127.0.0.1:8792",
    HEARTH_ORIGINS: baseURL,
    HEARTH_DATA_DIR: data,
    HEARTH_WEB_DIR: resolve("apps/web/dist"),
  },
});
let spawnError;
child.on("error", (error) => {
  spawnError = error;
});
let browser;
try {
  let ready = false;
  for (let n = 0; n < 150; n++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error("Preview host exited before it was ready.");
    try {
      const health = await (await fetch(`${baseURL}/api/health`)).json();
      assert.equal(health.version, version);
      ready = true;
      break;
    } catch {
      await delay(100);
    }
  }
  assert(ready, "Preview host did not become ready.");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.HEARTH_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.HEARTH_CHROMIUM_EXECUTABLE }
      : {}),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const owner = await browser.newContext({
    baseURL,
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  const dm = await owner.newPage();
  const errors = [];
  dm.on("pageerror", (error) => errors.push(error.message));
  await dm.goto("/");
  await dm.getByLabel("Username", { exact: false }).fill("preview_dm");
  await dm.getByLabel("Display name").fill("Game Master");
  await dm.getByLabel("Password", { exact: false }).fill("fictional preview password");
  await dm.getByRole("button", { name: "Create my Hearth", exact: true }).click();
  await dm.getByRole("link", { name: "Explore the sample" }).click();
  await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
  await expect(dm.getByTestId("connection-status")).toHaveText("Live");
  const campaign = new URL(dm.url()).pathname.split("/").pop();
  const headers = { "X-Hearth-Request": "1", Origin: baseURL };
  const players = [];
  for (const name of ["Alice", "Bob"]) {
    const invitation = await owner.request.post(`/api/campaigns/${campaign}/invites`, {
      headers,
      data: { expiresInHours: 24 },
    });
    assert(invitation.ok());
    const invite = await invitation.json();
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
    const joined = await context.request.post("/api/invites/redeem", {
      headers,
      data: {
        code: invite.invite.code,
        username: `preview_${name.toLowerCase()}`,
        displayName: name,
        password: "fictional player password",
      },
    });
    assert(joined.ok());
    const page = await context.newPage();
    await page.goto(`/campaign/${campaign}`);
    await expect(page.getByTestId("connection-status")).toHaveText("Live");
    await page.getByRole("tab", { name: "Chat", exact: true }).click();
    players.push(page);
  }
  // Populate a real scene/actor/encounter through the same authorized WS commands.
  const uploaded = await owner.request.post(`/api/campaigns/${campaign}/assets`, {
    headers: { ...headers, "Content-Type": "image/png" },
    data: readFileSync("content/examples/amber-keep/map.png"),
  });
  assert(uploaded.ok());
  const uploadedArt = (await uploaded.json()).asset.id;
  await dm.evaluate(
    async ({ campaign, uploadedArt }) => {
      const url = new URL(`/api/campaigns/${campaign}/ws`, location.href);
      url.protocol = "ws:";
      const socket = new WebSocket(url, "hearth.v1");
      let revision = 0,
        pending = null;
      let readyResolve, readyReject;
      const ready = new Promise((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
      });
      socket.onopen = () =>
        socket.send(JSON.stringify({ kind: "hello", schemaVersion: 1, lastRevision: null }));
      socket.onmessage = (event) => {
        const frame = JSON.parse(event.data);
        if (frame.kind === "snapshot") {
          revision = Math.max(revision, frame.revision);
          readyResolve();
        }
        if (frame.kind === "ack" && pending?.id === frame.requestId) {
          revision = frame.revision;
          pending.resolve();
          pending = null;
        }
        if (frame.kind === "error") {
          const error = new Error(frame.error.message);
          if (pending) {
            pending.reject(error);
            pending = null;
          } else readyReject(error);
        }
      };
      socket.onerror = () => readyReject(new Error("Preview command connection failed"));
      const command = (action) =>
        new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          pending = { id, resolve, reject };
          socket.send(
            JSON.stringify({
              kind: "command",
              schemaVersion: 1,
              requestId: id,
              baseRevision: revision,
              command: action,
            }),
          );
        });
      const read = async (path) => {
        const response = await fetch(`/api/campaigns/${campaign}/${path}`);
        if (!response.ok) throw new Error("Preview read failed");
        return response.json();
      };
      try {
        await ready;
        const scenes = (await read("scenes")).scenes,
          scene = scenes.find((s) => s.active);
        const roster = (await read("participants")).participants;
        for (const token of scene.tokens) {
          const actorId = crypto.randomUUID(),
            npc = token.visibility === "dm";
          await command({
            type: "actor.create",
            payload: {
              actorId,
              name: token.name,
              kind: npc ? "npc" : "character",
              assetId: token.assetId,
              biography: npc
                ? "Keeper of the lost watchtower bell."
                : "An adventurer of the Amber Keep.",
              dmNotes: "Fictional preview character.",
              hp: npc ? 24 : token.name.startsWith("Rowan") ? 15 : 12,
              maxHp: npc ? 24 : token.name.startsWith("Rowan") ? 18 : 14,
              attributes: { Awareness: npc ? "12" : "14" },
            },
          });
          if (!npc) {
            await command({ type: "actor.visibility", payload: { actorId, visibility: "shared" } });
            const player = roster.find(
              (p) => p.displayName === (token.name.startsWith("Rowan") ? "Alice" : "Bob"),
            );
            await command({
              type: "actor.permission",
              payload: { actorId, userId: player.id, permission: "owner" },
            });
          }
          await command({ type: "token.link", payload: { tokenId: token.id, actorId } });
        }
        await command({
          type: "scene.create",
          payload: {
            sceneId: crypto.randomUUID(),
            name: "The Bell Crypt",
            assetId: uploadedArt,
            gridSize: 60,
          },
        });
        await command({
          type: "combat.create",
          payload: {
            clientEncounterId: crypto.randomUUID(),
            sceneId: scene.id,
            name: "Watchtower ambush",
          },
        });
        for (const token of scene.tokens) {
          const encounter = (await read("combat")).encounter;
          await command({
            type: "combat.add",
            payload: {
              encounterId: encounter.id,
              expectedVersion: encounter.version,
              clientCombatantId: crypto.randomUUID(),
              tokenId: token.id,
            },
          });
        }
        const encounter = (await read("combat")).encounter;
        for (const entry of encounter.combatants)
          await command({
            type: "combat.initiative",
            payload: {
              combatantId: entry.id,
              expectedVersion: entry.version,
              initiative: entry.name.startsWith("Rowan")
                ? 18
                : entry.name.startsWith("Elara")
                  ? 14
                  : 11,
            },
          });
        const prepared = (await read("combat")).encounter;
        await command({
          type: "combat.start",
          payload: { encounterId: prepared.id, expectedVersion: prepared.version },
        });
      } finally {
        socket.close();
      }
    },
    { campaign, uploadedArt },
  );
  await dm.getByRole("tab", { name: "Chat", exact: true }).click();
  async function say(page, text) {
    await page.getByLabel("Message text", { exact: true }).fill(text);
    await page.getByRole("button", { name: "Send to everyone", exact: true }).click();
    await expect(page.getByTestId("chat-message").filter({ hasText: text })).toBeVisible();
  }
  await say(dm, "The lanterns flicker as you enter the Amber Vault. What do you do?");
  await say(players[0], "I check the passage to the east.");
  await say(players[1], "I'll stay by the doorway and keep watch.");
  await players[0].getByRole("tab", { name: "Dice", exact: true }).click();
  await players[0].getByLabel("Dice expression", { exact: true }).fill("1d20+4");
  await players[0].getByRole("button", { name: "Roll publicly", exact: true }).click();
  await expect(dm.getByTestId("chat-roll-card")).toHaveCount(1);
  await dm.getByLabel("Message visibility", { exact: true }).selectOption("whisper");
  await dm.getByRole("checkbox", { name: "Alice", exact: true }).check();
  await dm
    .getByLabel("Message text", { exact: true })
    .fill("You notice fresh marks in the dust by the sealed door.");
  await dm.getByRole("button", { name: "Send whisper", exact: true }).click();
  await expect(dm.getByTestId("chat-message").filter({ hasText: "fresh marks" })).toBeVisible();
  await dm.getByLabel("Message visibility", { exact: true }).selectOption("public");
  const latest = dm.getByRole("button", { name: "Jump to latest", exact: true });
  if (await latest.isVisible()) await latest.click();
  await dm.getByRole("tab", { name: "Combat", exact: true }).click();
  await expect(dm.getByTestId("combatant")).toHaveCount(3);
  await dm.getByRole("button", { name: "Pop out combat tracker", exact: true }).click();
  const handle = dm.getByRole("button", { name: "Move Combat tracker", exact: true });
  const box = await handle.boundingBox();
  assert(box);
  await dm.mouse.move(box.x + 100, box.y + 15);
  await dm.mouse.down();
  await dm.mouse.move(box.x + 100 - 365, box.y + 15, { steps: 12 });
  await dm.mouse.up();
  await dm.getByRole("tab", { name: "Chat", exact: true }).click();
  await dm.getByRole("button", { name: "Close Combat tracker", exact: true }).click();
  // Exercise the actual ruler and an independently connected player's ping.
  async function mapPoint(page, x, y) {
    const box = await page.locator("canvas").boundingBox();
    assert(box, "Preview map must have a canvas");
    const scale = Math.min(box.width / 1440, box.height / 960) * 0.92;
    return {
      x: box.x + (box.width - 1440 * scale) / 2 + x * scale,
      y: box.y + (box.height - 960 * scale) / 2 + y * scale,
    };
  }
  await dm.getByRole("button", { name: "Measure distance", exact: true }).click();
  const start = await mapPoint(dm, 570, 420);
  const end = await mapPoint(dm, 750, 660);
  await dm.mouse.move(start.x, start.y);
  await dm.mouse.down();
  await dm.mouse.move(end.x, end.y, { steps: 10 });
  await dm.mouse.up();
  await expect(dm.getByTestId("ruler-distance")).toHaveText("5 squares");
  await dm.evaluate(() => document.fonts.ready);
  await players[0].getByRole("button", { name: "Ping map", exact: true }).click();
  const ping = await mapPoint(players[0], 890, 430);
  await players[0].mouse.click(ping.x, ping.y);
  await expect(dm.getByText("Ping on map", { exact: true })).toBeVisible();
  await dm.waitForTimeout(200);
  assert.deepEqual(errors, []);
  await dm.screenshot({ path: output, fullPage: true, animations: "disabled" });
  console.log(`Captured Hearth VTT ${version}: ${output}`);
  if (process.argv[4]) {
    const player = players[0];
    await expect(player.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    await player.getByRole("button", { name: "Measure distance", exact: true }).click();
    const from = await mapPoint(player, 570, 420);
    const to = await mapPoint(player, 750, 660);
    await player.mouse.move(from.x, from.y);
    await player.mouse.down();
    await player.mouse.move(to.x, to.y, { steps: 10 });
    await player.mouse.up();
    await expect(player.getByTestId("ruler-distance")).toHaveText("5 squares");
    await player.screenshot({
      path: resolve(process.argv[4]),
      fullPage: true,
      animations: "disabled",
    });
    console.log("Captured independently connected player tabletop.");
  }
  if (process.argv[3]) {
    await dm.setViewportSize({ width: 760, height: 700 });
    await expect(
      dm.getByRole("button", { name: "Measure distance", exact: true }),
    ).toBeInViewport();
    await expect(dm.getByRole("button", { name: "Ping map", exact: true })).toBeInViewport();
    await expect(dm.getByTestId("ruler-distance")).toHaveText("5 squares");
    const hint = await dm.locator(".map-tool-hint").boundingBox();
    const sidebar = await dm
      .getByRole("complementary", { name: "Workspace sidebar" })
      .boundingBox();
    assert(
      hint && sidebar && hint.x + hint.width <= sidebar.x,
      "Narrow tool guidance must remain unobscured",
    );
    await dm.screenshot({ path: resolve(process.argv[3]), fullPage: true, animations: "disabled" });
    console.log("Captured narrow map tools with reachable controls.");
    assert.deepEqual(errors, []);
  }
} finally {
  await browser?.close();
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill("SIGINT");
  await Promise.race([exited, delay(5000)]);
  if (child.exitCode === null && !spawnError) {
    child.kill("SIGKILL");
    await exited;
  }
  rmSync(data, { recursive: true, force: true });
}
