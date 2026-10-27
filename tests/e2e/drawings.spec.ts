import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, type Page, test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";

const baseURL = "http://127.0.0.1:8795";
async function point(page: Page, x: number, y: number, zoom = 1) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Map canvas unavailable");
  const scale = Math.min(box.width / 1440, box.height / 960) * 0.92 * zoom;
  return {
    x: box.x + (box.width - 1440 * scale) / 2 + x * scale,
    y: box.y + (box.height - 960 * scale) / 2 + y * scale,
  };
}
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await point(page, ...from),
    b = await point(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}
async function stop(host: ChildProcess) {
  if (host.exitCode !== null) return;
  const exited = new Promise<void>((done) => host.once("exit", () => done()));
  host.kill("SIGINT");
  await Promise.race([exited, delay(5000)]);
  if (host.exitCode === null) {
    host.kill("SIGKILL");
    await exited;
  }
}

test("GM drawings synchronize, remain private, undo and survive a host restart", async ({
  browser,
}) => {
  const data = mkdtempSync(join(tmpdir(), "hearth-drawings-"));
  const contexts = [];
  let host: ChildProcess | undefined;
  const start = async () => {
    host = spawn(testHostExecutable(), [], {
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        HEARTH_BIND: "127.0.0.1:8795",
        HEARTH_ORIGINS: baseURL,
        HEARTH_DATA_DIR: data,
        HEARTH_WEB_DIR: resolve("apps/web/dist"),
      },
    });
    for (let i = 0; i < 150; i++) {
      if (host.exitCode !== null) throw new Error("Drawing host exited during startup");
      try {
        if ((await fetch(`${baseURL}/api/health`)).ok) return;
      } catch {
        /* wait */
      }
      await delay(100);
    }
    throw new Error("Drawing host did not start");
  };
  try {
    await start();
    const owner = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
    contexts.push(owner);
    const dm = await owner.newPage();
    const errors: string[] = [];
    dm.on("pageerror", (error) => errors.push(error.message));
    await dm.goto("/");
    await dm.getByLabel("Username", { exact: false }).fill("drawing_dm");
    await dm.getByLabel("Display name").fill("Game Master");
    await dm.getByLabel("Password", { exact: false }).fill("fictional drawing test password");
    await dm.getByRole("button", { name: "Create my Hearth" }).click();
    await dm.getByRole("link", { name: "Explore the sample" }).click();
    await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    const campaign = new URL(dm.url()).pathname.split("/").pop();
    const headers = { "X-Hearth-Request": "1", Origin: baseURL };
    const players: Page[] = [];
    const frames: string[] = [];
    for (const name of ["Alice", "Bob"]) {
      const invite = await owner.request.post(`/api/campaigns/${campaign}/invites`, {
        headers,
        data: { expiresInHours: 24 },
      });
      expect(invite.ok()).toBe(true);
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 1440, height: 1000 },
      });
      contexts.push(context);
      const joined = await context.request.post("/api/invites/redeem", {
        headers,
        data: {
          code: (await invite.json()).invite.code,
          username: `drawing_${name.toLowerCase()}`,
          displayName: name,
          password: "fictional player password",
        },
      });
      expect(joined.ok()).toBe(true);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("websocket", (socket) =>
        socket.on("framereceived", (frame) => frames.push(String(frame.payload))),
      );
      await page.goto(`/campaign/${campaign}`);
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      players.push(page);
    }
    const read = async (page: Page) =>
      (await (await page.request.get(`/api/campaigns/${campaign}/scenes`)).json()).scenes[0]
        .drawings;
    await dm.getByRole("button", { name: "Draw on map" }).click();
    await expect(dm.getByLabel("Drawing shape")).toBeVisible();
    await drag(dm, [570, 420], [750, 660]);
    await expect.poll(async () => (await read(dm)).length).toBe(1);
    await expect.poll(async () => (await read(players[0])).length).toBe(1);
    await dm.getByLabel("Drawing shape").selectOption("rectangle");
    await dm.getByLabel("Drawing layer").selectOption("dm");
    await dm.getByLabel("Drawing color").selectOption("#e65b5b");
    await drag(dm, [850, 300], [1100, 520]);
    await expect.poll(async () => (await read(dm)).length).toBe(2);
    const drawings = await read(dm);
    const secret = drawings.find((item: { visibility: string }) => item.visibility === "dm");
    expect(secret.shape).toBe("rectangle");
    for (const page of players) expect(await read(page)).toHaveLength(1);
    expect(frames.join(" ")).not.toContain(secret.id);
    await dm.getByRole("button", { name: "Undo drawing" }).click();
    await expect.poll(async () => (await read(dm)).length).toBe(1);
    await expect(dm.getByRole("button", { name: "Undo drawing" })).toBeEnabled();
    await dm.locator("canvas").focus();
    await dm.keyboard.press("Enter");
    await dm.keyboard.press("ArrowRight");
    await dm.keyboard.press("ArrowDown");
    await dm.keyboard.press("Enter");
    await expect.poll(async () => (await read(dm)).length).toBe(2);
    if (!host) throw new Error("Drawing host unavailable");
    await stop(host);
    await start();
    await dm.reload();
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    for (const page of players) {
      await page.reload();
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    }
    expect(await read(dm)).toHaveLength(2);
    for (const page of players) expect(await read(page)).toHaveLength(1);
    // Closed freehand strokes are real saved geometry, not raster overlays.
    await dm.getByRole("button", { name: "Draw on map" }).click();
    await dm.getByLabel("Drawing shape").selectOption("freehand");
    await dm.getByLabel("Drawing layer").selectOption("shared");
    await dm.getByLabel("Drawing color").selectOption("#72b7e2");
    const beforeStroke = await players[0].locator("canvas").screenshot();
    const curve = [
      [300, 300],
      [500, 300],
      [500, 440],
      [300, 300],
    ] as const;
    await dm.getByRole("button", { name: "Zoom in", exact: true }).click();
    const first = await point(dm, curve[0][0], curve[0][1], 1.2);
    await dm.mouse.move(first.x, first.y);
    await dm.mouse.down();
    for (const coordinate of curve.slice(1)) {
      const p = await point(dm, coordinate[0], coordinate[1], 1.2);
      await dm.mouse.move(p.x, p.y, { steps: 10 });
    }
    await dm.mouse.up();
    await expect.poll(async () => (await read(dm)).length).toBe(3);
    const stroke = (await read(dm))[2];
    expect(stroke.shape).toBe("freehand");
    expect(stroke.points.length).toBeGreaterThan(3);
    expect(stroke.points[0].x).toBeCloseTo(300, 0);
    expect(stroke.points.at(-1)).toEqual(stroke.points[0]);
    for (const player of players)
      await expect.poll(async () => (await read(player)).length).toBe(2);
    await expect
      .poll(async () => !(await players[0].locator("canvas").screenshot()).equals(beforeStroke))
      .toBe(true);
    // Escape must cancel without an extra saved drawing before the next accepted command.
    const cancelStart = await point(dm, 400, 120);
    await dm.mouse.move(cancelStart.x, cancelStart.y);
    await dm.mouse.down();
    await dm.mouse.move(cancelStart.x + 70, cancelStart.y + 50, { steps: 5 });
    await dm.keyboard.press("Escape");
    await dm.mouse.up();
    const canvas = dm.locator("canvas");
    const beginDraft = async () => {
      await canvas.evaluate((el) =>
        el.addEventListener(
          "pointerdown",
          (e) => el.setAttribute("data-test-pointer", String((e as PointerEvent).pointerId)),
          { once: true },
        ),
      );
      await dm.mouse.move(cancelStart.x, cancelStart.y);
      await dm.mouse.down();
      await dm.mouse.move(cancelStart.x + 50, cancelStart.y + 40, { steps: 4 });
      return Number(await canvas.getAttribute("data-test-pointer"));
    };
    const canceledId = await beginDraft();
    await canvas.dispatchEvent("pointercancel", { pointerId: canceledId });
    await dm.mouse.up();
    const lostId = await beginDraft();
    await canvas.evaluate((el, id) => (el as HTMLCanvasElement).releasePointerCapture(id), lostId);
    await dm.mouse.move(cancelStart.x + 55, cancelStart.y + 45);
    await dm.mouse.up();
    await beginDraft();
    await canvas.dispatchEvent("pointerdown", {
      pointerId: 9999,
      button: 0,
      clientX: cancelStart.x,
      clientY: cancelStart.y,
    });
    await canvas.dispatchEvent("pointerup", {
      pointerId: 9999,
      button: 0,
      clientX: cancelStart.x + 80,
      clientY: cancelStart.y + 80,
    });
    await dm.keyboard.press("Escape");
    await dm.mouse.up();
    await beginDraft();
    await dm.getByLabel("Drawing color").selectOption("#9ad59b");
    await dm.mouse.up();
    await beginDraft();
    await owner.setOffline(true);
    await expect(dm.getByTestId("connection-status")).not.toHaveText("Live");
    await dm.mouse.up();
    await owner.setOffline(false);
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    await beginDraft();
    await dm.goto("/");
    await dm.mouse.up();
    await dm.goto(`/campaign/${campaign}`);
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    await dm.getByRole("button", { name: "Draw on map" }).click();
    await dm.getByLabel("Drawing shape").selectOption("freehand");
    await dm.getByLabel("Drawing layer").selectOption("dm");
    await dm.locator("canvas").focus();
    await dm.keyboard.press("Enter");
    await dm.keyboard.press("ArrowRight");
    await dm.keyboard.press("ArrowDown");
    await dm.keyboard.press("ArrowLeft");
    await dm.keyboard.press("Enter");
    await expect.poll(async () => (await read(dm)).length).toBe(4);
    const privateStroke = (await read(dm))[3];
    expect(privateStroke.shape).toBe("freehand");
    expect(privateStroke.points.length).toBe(4);
    for (const player of players) expect(await read(player)).toHaveLength(2);
    expect(frames.join(" ")).not.toContain(privateStroke.id);
    await stop(host);
    await start();
    await dm.reload();
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    expect((await read(dm))[2].points).toEqual(stroke.points);
    for (const player of players) {
      await player.reload();
      await expect(player.getByTestId("connection-status")).toHaveText("Live");
      await expect(player.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      expect((await read(player))[1].points).toEqual(stroke.points);
    }
    await dm.getByRole("button", { name: "Draw on map" }).click();
    await dm.getByRole("button", { name: "Undo drawing" }).click();
    await expect.poll(async () => (await read(dm)).length).toBe(3);
    await dm.getByRole("button", { name: "Undo drawing" }).click();
    await expect.poll(async () => (await read(players[0])).length).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    if (host) await stop(host);
    rmSync(data, { recursive: true, force: true });
  }
});
