import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, type Page, test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";

const baseURL = "http://127.0.0.1:8794";

async function trackDraws(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as Window & { hearthTestDraws: number };
    state.hearthTestDraws = 0;
    for (const type of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const method of [
        "drawArrays",
        "drawElements",
        "drawArraysInstanced",
        "drawElementsInstanced",
      ]) {
        const prototype = type.prototype as unknown as Record<
          string,
          (...args: unknown[]) => unknown
        >;
        const original = prototype[method];
        if (!original) continue;
        prototype[method] = function (...args: unknown[]) {
          state.hearthTestDraws++;
          return Reflect.apply(original, this, args);
        };
      }
    }
  });
}

const drawCount = (page: Page) =>
  page.evaluate(() => (window as unknown as Window & { hearthTestDraws: number }).hearthTestDraws);

async function expectIdleMap(page: Page) {
  const count = () => drawCount(page);
  await expect.poll(count).toBeGreaterThan(0);
  // Allow pending asset uploads/frames to settle, then observe an unchanged map.
  await page.locator("canvas").screenshot();
  await page.waitForTimeout(200);
  const before = await count();
  await page.waitForTimeout(200);
  expect(await count(), "An unchanged tabletop should stop issuing GPU draw calls").toBe(before);
}

async function scenePoint(page: Page, x: number, y: number) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Map canvas is unavailable");
  const scale = Math.min(box.width / 1440, box.height / 960) * 0.92;
  return {
    x: box.x + (box.width - 1440 * scale) / 2 + x * scale,
    y: box.y + (box.height - 960 * scale) / 2 + y * scale,
  };
}

test("ruler remains accurate over zoom and pings reach the other players", async ({ browser }) => {
  const data = mkdtempSync(join(tmpdir(), "hearth-map-tools-"));
  const host = spawn(testHostExecutable(), [], {
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      HEARTH_BIND: "127.0.0.1:8794",
      HEARTH_ORIGINS: baseURL,
      HEARTH_DATA_DIR: data,
      HEARTH_WEB_DIR: resolve("apps/web/dist"),
    },
  });
  const contexts = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (host.exitCode !== null) throw new Error("Map test host exited before it was ready");
      try {
        if ((await fetch(`${baseURL}/api/health`)).ok) {
          ready = true;
          break;
        }
      } catch {
        /* wait for local host */
      }
      await delay(100);
    }
    expect(ready).toBe(true);
    const owner = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
    contexts.push(owner);
    const dm = await owner.newPage();
    await trackDraws(dm);
    const errors: string[] = [];
    dm.on("pageerror", (error) => errors.push(error.message));
    await dm.goto("/");
    await dm.getByLabel("Username", { exact: false }).fill("map_dm");
    await dm.getByLabel("Display name").fill("Game Master");
    await dm.getByLabel("Password", { exact: false }).fill("fictional map test password");
    await dm.getByRole("button", { name: "Create my Hearth" }).click();
    await dm.getByRole("link", { name: "Explore the sample" }).click();
    await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    await expectIdleMap(dm);
    const beforeContextLoss = await dm.locator("canvas").screenshot();
    const drawsAtRestore = await dm.evaluate(
      () =>
        new Promise<number>((resolveRestored, reject) => {
          const canvas = document.querySelector("canvas");
          const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
          const extension = gl?.getExtension("WEBGL_lose_context");
          if (!canvas || !extension) throw new Error("Context-loss extension is unavailable");
          const timeout = setTimeout(() => reject(new Error("Context was not restored")), 5000);
          canvas.addEventListener(
            "webglcontextrestored",
            () => {
              clearTimeout(timeout);
              resolveRestored(
                (window as unknown as Window & { hearthTestDraws: number }).hearthTestDraws,
              );
            },
            { once: true },
          );
          canvas.addEventListener(
            "webglcontextlost",
            () => setTimeout(() => extension.restoreContext(), 0),
            { once: true },
          );
          extension.loseContext();
        }),
    );
    await expect.poll(() => drawCount(dm)).toBeGreaterThan(drawsAtRestore);
    expect(await dm.locator("canvas").screenshot()).toEqual(beforeContextLoss);
    await expectIdleMap(dm);
    const campaign = new URL(dm.url()).pathname.split("/").pop();
    const headers = { "X-Hearth-Request": "1", Origin: baseURL };
    const players: Page[] = [];
    const bobFrames: string[] = [];
    for (const name of ["Alice", "Bob"]) {
      const invited = await owner.request.post(`/api/campaigns/${campaign}/invites`, {
        headers,
        data: { expiresInHours: 24 },
      });
      expect(invited.ok()).toBe(true);
      const code = (await invited.json()).invite.code;
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 1440, height: 1000 },
      });
      contexts.push(context);
      const joined = await context.request.post("/api/invites/redeem", {
        headers,
        data: {
          code,
          username: `map_${name.toLowerCase()}`,
          displayName: name,
          password: "fictional player password",
        },
      });
      expect(joined.ok()).toBe(true);
      const page = await context.newPage();
      await trackDraws(page);
      page.on("pageerror", (error) => errors.push(error.message));
      if (name === "Bob")
        page.on("websocket", (socket) =>
          socket.on("framereceived", (frame) => bobFrames.push(String(frame.payload))),
        );
      await page.goto(`/campaign/${campaign}`);
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expectIdleMap(page);
      players.push(page);
    }
    const [alice, bob] = players;
    const before = (await (await owner.request.get(`/api/campaigns/${campaign}/scenes`)).json())
      .scenes[0];
    const token = before.tokens.find((item: { name: string }) => item.name.startsWith("Rowan"));
    const beforeRuler = await dm.locator("canvas").screenshot();
    await dm.getByRole("button", { name: "Measure distance" }).click();
    await expect(
      dm.getByText("Ruler: drag to measure · Enter and arrows to adjust · Esc clears"),
    ).toBeVisible({ timeout: 1000 });
    const start = await scenePoint(dm, token.x, token.y);
    const end = await scenePoint(dm, token.x + 180, token.y);
    await dm.mouse.move(start.x, start.y);
    await dm.mouse.down();
    await dm.mouse.move(end.x, end.y, { steps: 6 });
    await dm.mouse.up();
    await expect(dm.getByTestId("ruler-distance")).toHaveText("3 squares");
    await expect(dm.getByTestId("ruler-distance")).toBeVisible();
    const measured = await dm.locator("canvas").screenshot();
    expect(measured).not.toEqual(beforeRuler);
    await dm.getByRole("button", { name: "Zoom in", exact: true }).click();
    expect(await dm.locator("canvas").screenshot()).not.toEqual(measured);
    await expect(dm.getByTestId("ruler-distance")).toHaveText("3 squares");
    const after = (await (await owner.request.get(`/api/campaigns/${campaign}/scenes`)).json())
      .scenes[0];
    expect(after.tokens.find((item: { id: string }) => item.id === token.id).x).toBe(token.x);
    await dm.locator("canvas").focus();
    await dm.keyboard.press("Escape");
    await expect(dm.getByTestId("ruler-distance")).toHaveCount(0);
    await dm.keyboard.press("Enter");
    await dm.keyboard.press("ArrowRight");
    await dm.keyboard.press("ArrowRight");
    await expect(dm.getByTestId("ruler-distance")).toHaveText("2 squares");

    const aliceBefore = await alice.locator("canvas").screenshot();
    await alice.getByRole("button", { name: "Measure distance" }).click();
    await alice.locator("canvas").focus();
    await alice.keyboard.press("Enter");
    await alice.keyboard.press("ArrowRight");
    await alice.keyboard.press("ArrowRight");
    await expect(alice.getByTestId("ruler-distance")).toHaveText("2 squares");
    expect(await alice.locator("canvas").screenshot()).not.toEqual(aliceBefore);
    await alice.keyboard.press("Escape");
    const bobBeforePing = await drawCount(bob);
    await alice.getByRole("button", { name: "Ping map" }).click();
    const where = await scenePoint(alice, 720, 420);
    await alice.mouse.click(where.x, where.y);
    await expect(dm.getByText("Ping on map", { exact: true })).toBeVisible();
    await expect(bob.getByText("Ping on map", { exact: true })).toBeVisible();
    await expect.poll(() => drawCount(bob)).toBeGreaterThan(bobBeforePing);
    const notice = await dm.getByText("Ping on map", { exact: true }).boundingBox();
    const sceneControl = await dm.getByRole("button", { name: "Take scene private" }).boundingBox();
    expect(notice && sceneControl).toBeTruthy();
    if (!notice || !sceneControl) throw new Error("Map controls are unavailable");
    const overlaps =
      notice.x < sceneControl.x + sceneControl.width &&
      notice.x + notice.width > sceneControl.x &&
      notice.y < sceneControl.y + sceneControl.height &&
      notice.y + notice.height > sceneControl.y;
    expect(overlaps).toBe(false);
    await expect
      .poll(
        () =>
          bobFrames.map((raw) => JSON.parse(raw)).filter((frame) => frame.kind === "ping").length,
      )
      .toBe(1);
    await dm.getByRole("button", { name: "Ping map" }).click();
    await dm.locator("canvas").focus();
    await dm.keyboard.press("ArrowRight");
    await dm.keyboard.press("Enter");
    await expect
      .poll(
        () =>
          bobFrames.map((raw) => JSON.parse(raw)).filter((frame) => frame.kind === "ping").length,
      )
      .toBe(2);
    await dm.waitForTimeout(600);
    await dm.locator("canvas").dispatchEvent("keydown", { key: "Enter", repeat: true });
    await dm.waitForTimeout(200);
    expect(
      bobFrames.map((raw) => JSON.parse(raw)).filter((frame) => frame.kind === "ping"),
    ).toHaveLength(2);
    await dm.keyboard.press("Enter");
    await expect
      .poll(
        () =>
          bobFrames.map((raw) => JSON.parse(raw)).filter((frame) => frame.kind === "ping").length,
      )
      .toBe(3);

    await expect(bob.getByText("Ping on map", { exact: true })).toHaveCount(0);
    await expectIdleMap(bob);
    await dm.getByRole("button", { name: "New scene", exact: true }).click();
    await dm.getByLabel("Scene name").fill("Private map preparation");
    await dm.getByLabel("Use existing artwork").selectOption("amber-map");
    await dm.getByRole("button", { name: "Create scene", exact: true }).click();
    await expect(dm.getByRole("button", { name: "Private map preparation" })).toBeVisible();
    await expect(dm.getByRole("button", { name: "Ping map" })).toBeDisabled();
    expect(bobFrames.join(" ")).not.toContain("Private map preparation");
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    if (host.exitCode === null) {
      const exited = new Promise<void>((resolveExit) => host.once("exit", () => resolveExit()));
      host.kill("SIGINT");
      await Promise.race([exited, delay(5000)]);
      if (host.exitCode === null) {
        host.kill("SIGKILL");
        await exited;
      }
    }
    rmSync(data, { recursive: true, force: true });
  }
});
