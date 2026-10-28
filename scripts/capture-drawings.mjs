// Capture real drawing controls using an isolated host and fictional accounts.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect as baseExpect, chromium } from "@playwright/test";
import { testHostExecutable } from "./test-runtime.mjs";

const expect = baseExpect.configure({ timeout: 20000 });
const baseURL = "http://127.0.0.1:8792";
const data = mkdtempSync(join(tmpdir(), "hearth-drawing-preview-"));
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const output = resolve(process.argv[2] || `Hearth_VTT_${version}.png`);
const host = spawn(testHostExecutable(), [], {
  stdio: ["ignore", "ignore", "inherit"],
  env: {
    ...process.env,
    HEARTH_BIND: "127.0.0.1:8792",
    HEARTH_ORIGINS: baseURL,
    HEARTH_DATA_DIR: data,
    HEARTH_WEB_DIR: resolve("apps/web/dist"),
  },
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (host.exitCode !== null) throw new Error("Preview host exited before startup");
    try {
      if ((await fetch(`${baseURL}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* wait */
    }
    await delay(100);
  }
  assert(ready, "Preview host did not start");
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
  dm.setDefaultTimeout(30000);
  const errors = [];
  dm.on("pageerror", (error) => errors.push(error.message));
  await dm.goto("/");
  await dm.getByLabel("Username", { exact: false }).fill("preview_dm");
  await dm.getByLabel("Display name").fill("Game Master");
  await dm.getByLabel("Password", { exact: false }).fill("fictional preview password");
  await dm.getByRole("button", { name: "Create my Hearth", exact: true }).click();
  await dm.getByRole("link", { name: "Explore the sample" }).click();
  await expect(dm.getByTestId("connection-status")).toHaveText("Live");
  await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
  const campaign = new URL(dm.url()).pathname.split("/").pop();
  const headers = { "X-Hearth-Request": "1", Origin: baseURL };
  const playerContexts = [];
  for (const name of ["Alice", "Bob"]) {
    const invite = await owner.request.post(`/api/campaigns/${campaign}/invites`, {
      headers,
      data: { expiresInHours: 24 },
    });
    assert(invite.ok());
    const player = await browser.newContext({ baseURL });
    playerContexts.push(player);
    const joined = await player.request.post("/api/invites/redeem", {
      headers,
      data: {
        code: (await invite.json()).invite.code,
        username: `preview_${name.toLowerCase()}`,
        displayName: name,
        password: "fictional player password",
      },
    });
    assert(joined.ok());
  }
  await dm
    .getByLabel("Message text", { exact: true })
    .fill("The lanterns flicker as you enter the Amber Vault. What do you do?");
  await dm.getByRole("button", { name: "Send to everyone", exact: true }).click();
  await expect(dm.getByTestId("chat-message")).toHaveCount(1);
  async function mapPoint(x, y) {
    const box = await dm.locator("canvas").boundingBox();
    assert(box);
    const scale = Math.min(box.width / 1440, box.height / 960) * 0.92;
    return {
      x: box.x + (box.width - 1440 * scale) / 2 + x * scale,
      y: box.y + (box.height - 960 * scale) / 2 + y * scale,
    };
  }
  async function draw(from, to) {
    const a = await mapPoint(...from),
      b = await mapPoint(...to);
    const controls = await dm.locator(".drawing-controls").boundingBox();
    assert(
      !controls ||
        a.x < controls.x ||
        a.x > controls.x + controls.width ||
        a.y < controls.y ||
        a.y > controls.y + controls.height,
      "Capture gesture starts underneath the drawing controls",
    );
    await dm.mouse.move(a.x, a.y);
    await dm.mouse.down();
    await dm.mouse.move(b.x, b.y, { steps: 8 });
    await dm.mouse.up();
  }
  const drawings = async (context) =>
    (await (await context.request.get(`/api/campaigns/${campaign}/scenes`)).json()).scenes[0]
      .drawings;
  await dm.getByRole("button", { name: "Draw on map" }).click();
  await draw([570, 420], [750, 660]);
  await expect.poll(async () => (await drawings(owner)).length).toBe(1);
  await dm.getByRole("button", { name: "Draw rectangle", exact: true }).click();
  await dm.getByRole("button", { name: "GM-only drawings", exact: true }).click();
  await dm.getByRole("button", { name: "Drawing color", exact: true }).click();
  await dm.getByRole("button", { name: "Red drawing color", exact: true }).click();
  await draw([880, 300], [1100, 520]);
  await expect.poll(async () => (await drawings(owner)).length).toBe(2);
  await dm.getByRole("button", { name: "Draw freehand", exact: true }).click();
  await dm.getByRole("button", { name: "Shared drawings", exact: true }).click();
  await dm.getByRole("button", { name: "Drawing color", exact: true }).click();
  await dm.getByRole("button", { name: "Blue drawing color", exact: true }).click();
  const start = await mapPoint(500, 650);
  await dm.mouse.move(start.x, start.y);
  await dm.mouse.down();
  for (const p of [
    [730, 650],
    [790, 740],
    [720, 820],
    [560, 800],
    [500, 650],
  ]) {
    const point = await mapPoint(...p);
    await dm.mouse.move(point.x, point.y, { steps: 8 });
  }
  await dm.mouse.up();
  await expect.poll(async () => (await drawings(owner)).length).toBe(3);
  for (const player of playerContexts) assert.equal((await drawings(player)).length, 2);
  if (process.argv[4])
    await dm.screenshot({ path: resolve(process.argv[4]), fullPage: true, animations: "disabled" });
  await dm.getByRole("button", { name: "Draw text", exact: true }).click();
  await draw([820, 190], [1260, 310]);
  await dm.getByLabel("Drawing text", { exact: true }).fill("North gate\nKeep the lantern lit");
  await dm.getByLabel("Text font size").fill("32");
  if (process.argv[6])
    await dm.screenshot({ path: resolve(process.argv[6]), fullPage: true, animations: "disabled" });
  await dm.getByRole("button", { name: "Save text", exact: true }).click();
  await expect.poll(async () => (await drawings(owner)).length).toBe(4);
  for (const player of playerContexts) assert.equal((await drawings(player)).length, 3);
  await dm.evaluate(() => document.fonts.ready);
  await expect(dm.getByText("Alice", { exact: true }).first()).toBeVisible();
  assert.deepEqual(errors, []);
  await dm.screenshot({ path: output, fullPage: true, animations: "disabled" });
  console.log(`Captured Hearth VTT ${version}: ${output}`);
  if (process.argv[3]) {
    await dm.setViewportSize({ width: 760, height: 700 });
    await expect(dm.getByRole("button", { name: "Draw on map" })).toBeInViewport();
    const controls = await dm.locator(".drawing-controls").boundingBox();
    const sidebar = await dm
      .getByRole("complementary", { name: "Workspace sidebar" })
      .boundingBox();
    assert(
      controls && sidebar && controls.x + controls.width <= sidebar.x,
      "Narrow drawing controls overlap the sidebar",
    );
    await dm.screenshot({ path: resolve(process.argv[3]), fullPage: true, animations: "disabled" });
    console.log("Captured narrow drawing controls.");
    if (process.argv[5]) {
      await dm.getByRole("button", { name: "Close drawing controls", exact: true }).click();
      await dm.setViewportSize({ width: 390, height: 700 });
      await dm.getByRole("button", { name: "Draw on map", exact: true }).click();
      await dm.getByRole("button", { name: "Fit scene", exact: true }).click();
      await dm.screenshot({
        path: resolve(process.argv[5]),
        fullPage: true,
        animations: "disabled",
      });
    }
    assert.deepEqual(errors, []);
  }
} finally {
  await browser?.close();
  if (host.exitCode === null) {
    const exited = new Promise((done) => host.once("exit", done));
    host.kill("SIGINT");
    await Promise.race([exited, delay(5000)]);
    if (host.exitCode === null) {
      host.kill("SIGKILL");
      await exited;
    }
  }
  rmSync(data, { recursive: true, force: true });
}
