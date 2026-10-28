import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, type Page, test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";
import { expectContextRecovery, expectIdleMap, trackDraws } from "./canvasChecks";

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
    await trackDraws(dm);
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
      await trackDraws(page);
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
    await expect
      .poll(async () => (await dm.locator(".drawing-controls").boundingBox())?.width)
      .toBeLessThanOrEqual(56);
    const palette = await dm.locator(".drawing-controls").boundingBox();
    if (!palette) throw new Error("Drawing palette unavailable");
    expect(palette.height).toBeGreaterThan(palette.width * 4);
    await drag(dm, [570, 420], [750, 660]);
    await expect.poll(async () => (await read(dm)).length).toBe(1);
    await expect.poll(async () => (await read(players[0])).length).toBe(1);
    await dm.getByRole("button", { name: "Draw rectangle", exact: true }).click();
    await dm.getByRole("button", { name: "GM-only drawings", exact: true }).click();
    await dm.getByRole("button", { name: "Drawing color", exact: true }).click();
    await dm.getByRole("button", { name: "Red drawing color", exact: true }).click();
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
    await dm.getByRole("button", { name: "Draw freehand", exact: true }).click();
    await dm.getByRole("button", { name: "Shared drawings", exact: true }).click();
    await dm.getByRole("button", { name: "Drawing color", exact: true }).click();
    await dm.getByRole("button", { name: "Blue drawing color", exact: true }).click();
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
    await dm.getByRole("button", { name: "Drawing color", exact: true }).focus();
    await dm.keyboard.press("Space");
    await dm.getByRole("button", { name: "Green drawing color", exact: true }).focus();
    await dm.keyboard.press("Space");
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
    await dm.getByRole("button", { name: "Draw freehand", exact: true }).click();
    await dm.getByRole("button", { name: "GM-only drawings", exact: true }).click();
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
    // Text follows the same authoritative layers and is rendered as literal pixels.
    await expect(dm.getByRole("button", { name: "Undo drawing" })).toBeEnabled();
    await dm.getByRole("button", { name: "Draw text", exact: true }).click();
    await dm.getByRole("button", { name: "Shared drawings", exact: true }).click();
    await dm.getByLabel("Text font size").fill("32");
    // Compare tabletop pixels; the HTML camera readout is outside the renderer.
    const labelPixels = () =>
      players[0].locator("canvas").screenshot({ style: ".canvas-status { visibility: hidden; }" });
    const beforeLabel = await labelPixels();
    const outsideStart = await point(players[0], 500, 390);
    const outsideEnd = await point(players[0], 940, 445);
    const outsideClip = {
      x: outsideStart.x,
      y: outsideStart.y,
      width: outsideEnd.x - outsideStart.x,
      height: outsideEnd.y - outsideStart.y,
    };
    const outsideBefore = await players[0].screenshot({ clip: outsideClip });
    await dm.getByRole("button", { name: "Zoom in", exact: true }).click();
    const textStart = await point(dm, 500, 260, 1.2);
    const textEnd = await point(dm, 940, 380, 1.2);
    await dm.mouse.move(textStart.x, textStart.y);
    await dm.mouse.down();
    await dm.mouse.move(textEnd.x, textEnd.y, { steps: 8 });
    await dm.mouse.up();
    await dm.getByLabel("Drawing text", { exact: true }).fill("<b>North gate</b> 🐉\nKeep left");
    await dm.getByRole("button", { name: "Save text", exact: true }).click();
    await expect.poll(async () => (await read(dm)).length).toBe(3);
    let label = (await read(dm))[2];
    expect(label).toMatchObject({
      shape: "text",
      visibility: "shared",
      text: "<b>North gate</b> 🐉\nKeep left",
      fontSize: 32,
    });
    expect(label.startX).toBeCloseTo(500, 0);
    expect(label.endY).toBeCloseTo(380, 0);
    for (const player of players)
      await expect.poll(async () => (await read(player)).length).toBe(2);
    await expect.poll(async () => !(await labelPixels()).equals(beforeLabel)).toBe(true);
    expect((await players[0].screenshot({ clip: outsideClip })).equals(outsideBefore)).toBe(true);
    expect(await dm.locator("b", { hasText: "North gate" }).count()).toBe(0);
    await expectIdleMap(players[0]);
    await expectContextRecovery(players[0]);
    // Select a saved label, edit directly, resize/move and save its explicit style.
    const labelPoint = await point(dm, 520, 280, 1.2);
    await dm.mouse.click(labelPoint.x, labelPoint.y);
    await expect(dm.getByLabel("Drawing text", { exact: true })).toHaveValue(label.text);
    await dm.getByLabel("Drawing text", { exact: true }).fill("Edited gate");
    await dm.getByLabel("Text font size").fill("48");
    await dm.getByRole("button", { name: "Drawing color", exact: true }).click();
    await dm.getByLabel("Custom drawing color").fill("#abcdef");
    await dm.getByRole("button", { name: "Drawing color", exact: true }).press("Escape");
    const resize = await dm
      .getByRole("button", { name: "Resize text box", exact: true })
      .boundingBox();
    if (!resize) throw new Error("Resize handle unavailable");
    await dm.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
    await dm.mouse.down();
    await dm.mouse.move(resize.x + resize.width / 2 + 24, resize.y + resize.height / 2 + 18, {
      steps: 4,
    });
    await dm.mouse.up();
    await dm.getByRole("button", { name: "Move text box", exact: true }).press("ArrowRight");
    await dm.getByRole("button", { name: "Save text", exact: true }).click();
    await expect.poll(async () => (await read(dm))[2].version).toBe(2);
    const edited = (await read(dm))[2];
    expect(edited.text).toBe("Edited gate");
    expect(edited.fontSize).toBe(48);
    expect(edited.color).toBe("#abcdef");
    expect(edited.endX).toBeGreaterThan(label.endX);
    expect(edited.endY).toBeGreaterThan(label.endY);
    await dm.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect.poll(async () => (await read(dm))[2].version).toBe(3);
    label = (await read(dm))[2];
    expect(label.text).toBe("<b>North gate</b> 🐉\nKeep left");
    expect(label.fontSize).toBe(32);
    // Style changes cancel an unfinished placement; Escape cancels typed text without a save.
    await expect(dm.getByRole("button", { name: "Undo drawing" })).toBeEnabled();
    await dm.locator("canvas").focus();
    await dm.keyboard.press("Enter");
    await dm.keyboard.press("ArrowRight");
    await dm.keyboard.press("ArrowDown");
    await dm.getByLabel("Text font size").fill("24");
    await dm.locator("canvas").focus();
    await dm.keyboard.press("Enter");
    await dm.keyboard.press("Enter");
    await dm.getByLabel("Drawing text", { exact: true }).fill("Canceled draft");
    await dm.getByLabel("Drawing text", { exact: true }).press("Escape");
    await dm.getByRole("button", { name: "GM-only drawings", exact: true }).click();
    await dm.locator("canvas").focus();
    await dm.keyboard.press("Enter");
    await dm.keyboard.press("ArrowRight");
    await dm.keyboard.press("ArrowDown");
    await dm.keyboard.press("Enter");
    await dm.getByLabel("Drawing text", { exact: true }).fill("SECRET TEXT MARKER 🐉");
    await dm.getByLabel("Drawing text", { exact: true }).press("Control+Enter");
    await expect.poll(async () => (await read(dm)).length).toBe(4);
    const privateLabel = (await read(dm))[3];
    expect(privateLabel.text).toBe("SECRET TEXT MARKER 🐉");
    for (const player of players) expect(await read(player)).toHaveLength(2);
    expect(frames.join(" ")).not.toContain("SECRET TEXT MARKER");
    expect(frames.join(" ")).not.toContain(privateLabel.id);
    await stop(host);
    await start();
    await dm.reload();
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    expect((await read(dm))[2]).toEqual(label);
    expect((await read(dm))[3]).toEqual(privateLabel);
    for (const player of players) {
      await player.reload();
      await expect(player.getByTestId("connection-status")).toHaveText("Live");
      await expect(player.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      expect((await read(player))[1]).toEqual(label);
    }
    await dm.getByRole("button", { name: "Draw on map" }).click();
    await dm.getByRole("button", { name: "Undo drawing" }).click();
    await expect.poll(async () => (await read(dm)).length).toBe(3);
    await dm.getByRole("button", { name: "Undo drawing" }).click();
    await expect.poll(async () => (await read(players[0])).length).toBe(1);
    await expect.poll(async () => (await labelPixels()).equals(beforeLabel)).toBe(true);
    await expectIdleMap(players[0]);
    // Object eraser removes strokes and Undo restores them, including keyboard targeting.
    await expect(dm.getByRole("button", { name: "Undo drawing", exact: true })).toBeEnabled();
    await dm.getByRole("button", { name: "Erase drawing", exact: true }).click();
    const linePoint = await point(dm, 600, 460);
    await dm.mouse.click(linePoint.x, linePoint.y);
    await expect.poll(async () => (await read(players[0])).length).toBe(0);
    await dm.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect.poll(async () => (await read(players[0])).length).toBe(1);
    const panStart = await point(dm, 1200, 300);
    await dm.mouse.move(panStart.x, panStart.y);
    await dm.mouse.down({ button: "middle" });
    await dm.mouse.move(panStart.x + 40, panStart.y + 20, { steps: 5 });
    await dm.mouse.up({ button: "middle" });
    await dm.getByRole("button", { name: "Draw text", exact: true }).click();
    await dm.mouse.click(panStart.x, panStart.y);
    await dm.getByRole("textbox", { name: "Drawing text", exact: true }).fill("Pan check");
    await dm.getByRole("button", { name: "Save text", exact: true }).click();
    await expect
      .poll(
        async () => (await read(dm)).find((d: { text?: string }) => d.text === "Pan check")?.startX,
      )
      .toBeLessThan(1190);
    await dm.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect.poll(async () => (await read(dm)).length).toBe(1);
    await dm.getByRole("button", { name: "Erase drawing", exact: true }).click();
    await dm.getByRole("button", { name: "Fit scene", exact: true }).click();
    await dm.locator("canvas").focus();
    await dm.keyboard.press("ArrowRight");
    await dm.keyboard.press("Enter");
    await expect.poll(async () => (await read(players[0])).length).toBe(0);
    await expect(dm.getByRole("button", { name: "Undo drawing", exact: true })).toBeEnabled();
    await dm.locator("canvas").press("Control+z");
    await expect.poll(async () => (await read(players[0])).length).toBe(1);
    await dm.getByRole("button", { name: "Draw freehand", exact: true }).click();
    await dm.getByRole("button", { name: "Shared drawings", exact: true }).click();
    await drag(dm, [400, 300], [500, 400]);
    await expect.poll(async () => (await read(dm)).length).toBe(3);
    const erasedStroke = (await read(dm))[2];
    await dm.getByRole("button", { name: "Erase drawing", exact: true }).click();
    const strokePoint = await point(dm, 450, 350);
    await dm.mouse.click(strokePoint.x, strokePoint.y);
    await expect.poll(async () => (await read(dm)).length).toBe(2);
    await dm.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect.poll(async () => (await read(dm)).length).toBe(3);
    expect((await read(dm))[2].points).toEqual(erasedStroke.points);
    await dm.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect.poll(async () => (await read(dm)).length).toBe(2);
    // Palette controls stay separate from the canvas, editor and right dock.
    await dm.getByRole("button", { name: "Draw text", exact: true }).click();
    await dm.locator("canvas").focus();
    await dm.keyboard.press("Enter");
    await dm.keyboard.press("Enter");
    await dm.getByLabel("Drawing text", { exact: true }).fill("Layout draft");
    await dm.getByLabel("Drawing text", { exact: true }).press("Escape");
    await dm.locator("canvas").press("Escape");
    await expect(dm.getByRole("group", { name: "Drawing controls", exact: true })).toHaveCount(0);
    await expect(dm.locator("canvas")).toBeFocused();
    for (const viewport of [
      { width: 760, height: 700 },
      { width: 900, height: 520 },
      { width: 390, height: 700 },
    ]) {
      await dm.setViewportSize(viewport);
      await dm.getByRole("button", { name: "Draw on map", exact: true }).click();
      await dm.locator("canvas").focus();
      await dm.keyboard.press("Enter");
      await dm.keyboard.press("Enter");
      await expect(dm.getByLabel("Drawing text", { exact: true })).toHaveValue("Layout draft");
      await expect(dm.getByLabel("Text font size")).toHaveValue("24");
      await dm.getByLabel("Drawing text", { exact: true }).press("Escape");
      const tools = await dm.locator(".drawing-controls").boundingBox();
      const editor = await dm.locator(".drawing-text-options").boundingBox();
      const dock = await dm.getByRole("complementary", { name: "Workspace sidebar" }).boundingBox();
      if (!tools || !editor || !dock) throw new Error("Palette/editor/dock missing");
      expect(tools.width).toBeLessThanOrEqual(56);
      expect(tools.x + tools.width).toBeLessThan(editor.x);
      expect(editor.x + editor.width).toBeLessThanOrEqual(dock.x);
      const hint = await dm.locator(".map-tool-hint").boundingBox();
      const camera = await dm.locator(".canvas-controls").boundingBox();
      if (!hint || !camera) throw new Error("Map guidance/camera controls missing");
      expect(hint.x + hint.width).toBeLessThanOrEqual(camera.x);
      const undo = dm.getByRole("button", { name: "Undo drawing", exact: true });
      await undo.scrollIntoViewIfNeeded();
      await expect(undo).toBeInViewport();
      const undoBox = await undo.boundingBox();
      if (!undoBox) throw new Error("Undo missing");
      expect(undoBox.y + undoBox.height).toBeLessThan(viewport.height - 96);
      await dm.getByRole("button", { name: "Close drawing controls", exact: true }).click();
    }
    await dm.getByRole("button", { name: "Draw on map", exact: true }).click();
    await dm.getByRole("tab", { name: "Chat", exact: true }).click();
    await expect(dm.getByRole("group", { name: "Drawing controls", exact: true })).toHaveCount(0);
    await expect(dm.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
    // A supported wide sidebar must not squeeze the text/color editor underneath it.
    await dm.setViewportSize({ width: 900, height: 700 });
    await dm.getByRole("separator", { name: "Sidebar width" }).press("End");
    await dm.setViewportSize({ width: 641, height: 700 });
    await dm.getByRole("button", { name: "Draw on map", exact: true }).click();
    await expect(dm.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
    await dm.locator("canvas").focus();
    await dm.keyboard.press("Enter");
    await dm.keyboard.press("Enter");
    await expect(dm.getByLabel("Drawing text", { exact: true })).toHaveValue("Layout draft");
    await dm.getByLabel("Drawing text", { exact: true }).press("Escape");
    await dm.getByRole("button", { name: "Drawing color", exact: true }).click();
    const picker = await dm.locator(".drawing-color-options").boundingBox();
    const rightDock = await dm
      .getByRole("complementary", { name: "Workspace sidebar" })
      .boundingBox();
    if (!picker || !rightDock) throw new Error("Color picker/dock unavailable");
    expect(picker.width).toBeGreaterThan(150);
    expect(picker.x + picker.width).toBeLessThanOrEqual(rightDock.x);
    await dm.getByRole("button", { name: "Drawing color", exact: true }).press("Escape");
    await dm.getByRole("button", { name: "Close drawing controls", exact: true }).click();
    await dm.setViewportSize({ width: 900, height: 700 });
    await dm.getByRole("tab", { name: "Chat", exact: true }).click();
    await dm.getByRole("button", { name: "Draw on map", exact: true }).click();
    await dm.setViewportSize({ width: 700, height: 700 });
    await expect(dm.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    if (host) await stop(host);
    rmSync(data, { recursive: true, force: true });
  }
});
