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
const output = resolve(process.argv[2] || "Hearth_VTT_0.0.12.png");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
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
  await dm.getByLabel("Drawing shape").selectOption("rectangle");
  await dm.getByLabel("Drawing layer").selectOption("dm");
  await dm.getByLabel("Drawing color").selectOption("#e65b5b");
  await draw([880, 300], [1100, 520]);
  await expect.poll(async () => (await drawings(owner)).length).toBe(2);
  for (const player of playerContexts) assert.equal((await drawings(player)).length, 1);
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
