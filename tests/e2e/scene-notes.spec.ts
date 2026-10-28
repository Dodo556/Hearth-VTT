import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";
import { expectIdleMap, trackDraws } from "./canvasChecks";

const baseURL = "http://127.0.0.1:8801";
const notes = (page: Page) => page.locator('[data-window-id="scene-notes"]');
test("scene notes preserve private drafts and share only the active scene briefing", async ({
  browser,
}) => {
  const data = mkdtempSync(join(tmpdir(), "hearth-scene-notes-"));
  const contexts: BrowserContext[] = [];
  let host: ChildProcess | undefined;
  async function start() {
    host = spawn(testHostExecutable(), [], {
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        HEARTH_BIND: "127.0.0.1:8801",
        HEARTH_ORIGINS: baseURL,
        HEARTH_DATA_DIR: data,
        HEARTH_WEB_DIR: resolve("apps/web/dist"),
      },
    });
    for (let i = 0; i < 150; i++) {
      if (host.exitCode !== null) throw new Error("Scene-note host exited");
      try {
        if ((await fetch(`${baseURL}/api/health`)).ok) return;
      } catch {}
      await delay(100);
    }
    throw new Error("Scene-note host did not start");
  }
  async function stop() {
    if (!host || host.exitCode !== null) return;
    const exited = new Promise<void>((done) => host?.once("exit", () => done()));
    host.kill("SIGINT");
    await Promise.race([exited, delay(5000)]);
    if (host.exitCode === null) {
      host.kill("SIGKILL");
      await exited;
    }
  }
  try {
    await start();
    const owner = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
    contexts.push(owner);
    const dm = await owner.newPage();
    const errors: string[] = [];
    const frames: string[] = [];
    dm.on("pageerror", (e) => errors.push(e.message));
    await trackDraws(dm);
    await dm.goto("/");
    await dm.getByLabel("Username", { exact: false }).fill("scene_notes_dm");
    await dm.getByLabel("Display name").fill("Game Master");
    await dm.getByLabel("Password", { exact: false }).fill("fictional notes password");
    await dm.getByRole("button", { name: "Create my Hearth" }).click();
    await dm.getByRole("link", { name: "Explore the sample" }).click();
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    const campaign = new URL(dm.url()).pathname.split("/").pop();
    const headers = { "X-Hearth-Request": "1", Origin: baseURL };
    const read = async (page: Page) =>
      (await (await page.request.get(`/api/campaigns/${campaign}/scenes`)).json()).scenes;
    const original = (await read(dm))[0];
    const players: Page[] = [];
    for (const name of ["Alice", "Bob"]) {
      const invite = await owner.request.post(`/api/campaigns/${campaign}/invites`, {
        headers,
        data: { expiresInHours: 24 },
      });
      expect(invite.ok()).toBe(true);
      const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
      contexts.push(ctx);
      const join = await ctx.request.post("/api/invites/redeem", {
        headers,
        data: {
          code: (await invite.json()).invite.code,
          username: `scene_notes_${name.toLowerCase()}`,
          displayName: name,
          password: "fictional player password",
        },
      });
      expect(join.ok()).toBe(true);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("websocket", (s) => s.on("framereceived", (f) => frames.push(String(f.payload))));
      await trackDraws(page);
      await page.goto(`/campaign/${campaign}`);
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      players.push(page);
    }
    await dm.locator("#scene-notes-trigger").click();
    await notes(dm).getByRole("button", { name: "Add GM notes", exact: true }).click();
    await notes(dm)
      .getByLabel("GM note text")
      .fill("GM_SCENE_SECRET_18\nThe sentries behind the gate are asleep.");
    await notes(dm).getByLabel("GM note text").press("Control+Enter");
    await expect(notes(dm).locator(".scene-note-body")).toContainText("GM_SCENE_SECRET_18");
    for (const page of players) {
      await page.locator("#scene-notes-trigger").click();
      await expect(notes(page)).toContainText("hasn’t shared a briefing");
      expect(JSON.stringify(await read(page))).not.toContain("GM_SCENE_SECRET_18");
    }
    await notes(dm).getByRole("tab", { name: "Player briefing", exact: true }).click();
    await notes(dm).getByRole("button", { name: "Write player briefing", exact: true }).click();
    const literal = "<script>window.sceneNoteInjected=true</script>\nMeet at the north gate. 🐉";
    await notes(dm).getByLabel("Player briefing text").fill(literal);
    await notes(dm).getByRole("button", { name: "Share player briefing", exact: true }).click();
    for (const page of players) {
      await expect(notes(page).locator(".scene-note-body")).toHaveText(literal);
      expect(await page.evaluate(() => "sceneNoteInjected" in window)).toBe(false);
    }
    await notes(dm).getByRole("button", { name: "Edit player briefing", exact: true }).click();
    await notes(dm).getByLabel("Player briefing text").fill("Draft to keep");
    const other = await browser.newContext({
      baseURL,
      storageState: await owner.storageState(),
      viewport: { width: 1440, height: 1000 },
    });
    contexts.push(other);
    const gm2 = await other.newPage();
    await gm2.goto(`/campaign/${campaign}`);
    await expect(gm2.getByTestId("connection-status")).toHaveText("Live");
    await gm2.locator("#scene-notes-trigger").click();
    await notes(gm2).getByRole("tab", { name: "Player briefing", exact: true }).click();
    await notes(gm2).getByRole("button", { name: "Edit player briefing", exact: true }).click();
    await notes(gm2).getByLabel("Player briefing text").fill("Updated by another GM");
    await notes(gm2).getByRole("button", { name: "Update player briefing", exact: true }).click();
    await expect(notes(dm)).toContainText("changed elsewhere");
    await expect(
      notes(dm).getByRole("button", { name: "Update player briefing", exact: true }),
    ).toBeDisabled();
    await expect(notes(dm).getByLabel("Player briefing text")).toHaveValue("Draft to keep");
    await notes(dm).getByRole("button", { name: "Reload saved note", exact: true }).click();
    await expect(notes(dm).getByLabel("Player briefing text")).toHaveValue("Updated by another GM");
    await notes(dm).getByRole("button", { name: "Cancel", exact: true }).click();
    await other.close();
    contexts.splice(contexts.indexOf(other), 1);
    await notes(dm).getByRole("tab", { name: "GM notes", exact: true }).click();
    await notes(dm).getByRole("button", { name: "Edit GM notes", exact: true }).click();
    await notes(dm).getByLabel("GM note text").fill("Retained GM draft");
    await notes(dm).getByLabel("GM note text").press("Escape");
    await expect(notes(dm)).toHaveCount(0);
    await expect(dm.locator("#scene-notes-trigger")).toBeFocused();
    await dm.locator("#scene-notes-trigger").click();
    await expect(notes(dm).getByLabel("GM note text")).toHaveValue("Retained GM draft");
    await dm.getByRole("button", { name: "New scene", exact: true }).click();
    await dm.getByLabel("Scene name").fill("Unseen vault");
    await dm.getByLabel("Use existing artwork").selectOption("amber-map");
    await dm.getByRole("button", { name: "Create scene", exact: true }).click();
    await expect(notes(dm)).toHaveAccessibleName("Scene notes · Unseen vault");
    await notes(dm).getByRole("tab", { name: "Player briefing", exact: true }).click();
    await notes(dm).getByRole("button", { name: "Write player briefing", exact: true }).click();
    await notes(dm).getByLabel("Player briefing text").fill("NEXT_SCENE_SECRET_18");
    await notes(dm).getByRole("button", { name: "Share player briefing", exact: true }).click();
    for (const page of players)
      expect(JSON.stringify(await read(page))).not.toContain("NEXT_SCENE_SECRET_18");
    await dm.getByRole("button", { name: original.name, exact: true }).click();
    await expect(notes(dm).getByLabel("GM note text")).toHaveValue("Retained GM draft");
    await notes(dm).getByRole("button", { name: "Cancel", exact: true }).click();
    await notes(dm).getByRole("tab", { name: "Player briefing", exact: true }).click();
    await notes(dm).getByRole("button", { name: "Edit player briefing", exact: true }).click();
    await notes(dm).getByLabel("Player briefing text").fill("");
    await notes(dm).getByRole("button", { name: "Clear player briefing", exact: true }).click();
    for (const page of players) await expect(notes(page)).toContainText("hasn’t shared a briefing");
    const briefing = "North gate\nKeep the lantern lit. Wait for both scouts before entering.";
    await notes(dm).getByRole("button", { name: "Write player briefing", exact: true }).click();
    await notes(dm).getByLabel("Player briefing text").fill(briefing);
    await notes(dm).getByRole("button", { name: "Share player briefing", exact: true }).click();
    for (const page of players)
      await expect(notes(page).locator(".scene-note-body")).toHaveText(briefing);
    await dm.getByRole("button", { name: "Take scene private", exact: true }).click();
    for (const page of players) {
      await expect(notes(page)).toHaveCount(0);
      await expect.poll(async () => await read(page)).toEqual([]);
    }
    await dm.getByRole("button", { name: "Show scene to players", exact: true }).click();
    for (const page of players) {
      await expect(page.locator("#scene-notes-trigger")).toHaveAttribute("aria-expanded", "true");
      await expect(notes(page).locator(".scene-note-body")).toHaveText(briefing);
    }
    await stop();
    await start();
    for (const page of [dm, ...players]) {
      await page.reload();
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      await page.locator("#scene-notes-trigger").click();
    }
    await expect(notes(dm).locator(".scene-note-body")).toContainText("GM_SCENE_SECRET_18");
    for (const page of players) {
      await expect(notes(page).locator(".scene-note-body")).toHaveText(briefing);
      await expectIdleMap(page);
    }
    const captures = process.env.HEARTH_NOTES_CAPTURE_DIR;
    async function capture(page: Page, name: string) {
      if (captures) {
        mkdirSync(captures, { recursive: true });
        await page.screenshot({
          path: join(captures, `Hearth_VTT_0.0.18_${name}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    await capture(players[0], "player_notes");
    await notes(dm).getByRole("tab", { name: "Player briefing", exact: true }).click();
    await notes(dm).getByRole("button", { name: "Edit player briefing", exact: true }).click();
    await expect
      .soft(notes(dm).getByRole("button", { name: "Update player briefing", exact: true }))
      .toBeInViewport({ ratio: 1 });
    await capture(dm, "scene_notes");
    for (const viewport of [
      { width: 760, height: 700 },
      { width: 390, height: 700 },
      { width: 900, height: 520 },
    ]) {
      await dm.setViewportSize(viewport);
      if (viewport.width === 900)
        await dm.getByRole("button", { name: "Expand sidebar", exact: true }).click();
      // ResizeObserver clamps local window position after the viewport/CSS resize.
      await expect
        .poll(async () => {
          const box = await notes(dm).boundingBox();
          return box
            ? Math.max(
                -box.x,
                box.x + box.width - viewport.width,
                box.y + box.height - viewport.height,
              )
            : Number.POSITIVE_INFINITY;
        })
        .toBeLessThanOrEqual(0);
      const save = notes(dm).getByRole("button", { name: "Update player briefing", exact: true });
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport({ ratio: 1 });
      await save.click({ trial: true });
      await expect.soft
        .poll(async () => {
          const windowBox = await notes(dm).boundingBox();
          const sidebarBox = await dm
            .getByRole("complementary", { name: "Workspace sidebar" })
            .boundingBox();
          return windowBox && sidebarBox ? windowBox.x + windowBox.width - sidebarBox.x : 9999;
        })
        .toBeLessThanOrEqual(0);
      await expect(notes(dm).getByLabel("Player briefing text")).toHaveValue(briefing);
      await capture(
        dm,
        viewport.width === 760
          ? "scene_notes_narrow"
          : viewport.width === 390
            ? "scene_notes_constrained"
            : "scene_notes_short",
      );
      if (viewport.width === 390) {
        await dm.getByRole("button", { name: "Expand sidebar", exact: true }).click();
        await expect(notes(dm)).toHaveCount(0);
        await dm
          .getByRole("complementary", { name: "Workspace sidebar" })
          .getByRole("button", { name: "Scene notes", exact: true })
          .click();
        await expect(notes(dm).getByLabel("Player briefing text")).toHaveValue(briefing);
        await save.scrollIntoViewIfNeeded();
        await save.click({ trial: true });
      }
    }
    expect(frames.join(" ")).not.toContain("GM_SCENE_SECRET_18");
    expect(frames.join(" ")).not.toContain("NEXT_SCENE_SECRET_18");
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    await stop();
    rmSync(data, { recursive: true, force: true });
  }
});
