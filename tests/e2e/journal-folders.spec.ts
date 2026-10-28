import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";
import { expectIdleMap, trackDraws } from "./canvasChecks";

const baseURL = "http://127.0.0.1:8803";

test("journal folders organize private preparation without leaking metadata or losing shared pages", async ({
  browser,
}) => {
  const data = mkdtempSync(join(tmpdir(), "hearth-journal-folders-"));
  const contexts: BrowserContext[] = [];
  let host: ChildProcess | undefined;
  async function start() {
    host = spawn(testHostExecutable(), [], {
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        HEARTH_BIND: "127.0.0.1:8803",
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
    await dm.getByLabel("Username", { exact: false }).fill("folders_dm");
    await dm.getByLabel("Display name").fill("Game Master");
    await dm.getByLabel("Password", { exact: false }).fill("fictional folder password");
    await dm.getByRole("button", { name: "Create my Hearth" }).click();
    await dm.getByRole("link", { name: "Explore the sample" }).click();
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    const path = new URL(dm.url()).pathname;
    const campaign = path.split("/").pop();
    const headers = { "X-Hearth-Request": "1", Origin: baseURL };
    const players: Page[] = [];
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
      const join = await context.request.post("/api/invites/redeem", {
        headers,
        data: {
          code: (await invite.json()).invite.code,
          username: `folder_${name.toLowerCase()}`,
          displayName: name,
          password: "fictional player password",
        },
      });
      expect(join.ok()).toBe(true);
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("websocket", (s) => s.on("framereceived", (f) => frames.push(String(f.payload))));
      await trackDraws(page);
      await page.goto(path);
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      await page.getByRole("tab", { name: "Journal", exact: true }).click();
      players.push(page);
    }
    await dm.getByRole("tab", { name: "Journal", exact: true }).click();
    const dialog = (p: Page) => p.getByRole("dialog");
    const read = async (p: Page) =>
      await (await p.request.get(`/api/campaigns/${campaign}/journals`)).json();
    const folderSecret = "GM_FOLDER_SECRET_20";
    await dm.getByRole("button", { name: "New folder", exact: true }).click();
    await dialog(dm).getByLabel("Folder name").fill(folderSecret);
    await dialog(dm).getByRole("button", { name: "Create folder", exact: true }).click();
    await expect(dialog(dm)).toHaveCount(0);
    await dm.getByRole("button", { name: "New folder", exact: true }).click();
    await dialog(dm).getByLabel("Folder name").fill("Clue archive");
    await dialog(dm).getByLabel("Parent folder").selectOption({ label: folderSecret });
    await dialog(dm).getByRole("button", { name: "Create folder", exact: true }).click();
    await expect(dialog(dm)).toHaveCount(0);
    const initial = await read(dm);
    const folderIds = initial.folders.map((f: { id: string }) => f.id);
    for (const p of players) {
      expect((await read(p)).folders).toBeUndefined();
      await expect(p.getByRole("button", { name: "New folder", exact: true })).toHaveCount(0);
    }
    await dm.getByRole("button", { name: "New page", exact: true }).click();
    await dm.getByLabel("Page title", { exact: true }).fill("Gate dispatch");
    await dm
      .getByLabel("Page text", { exact: true })
      .fill("Meet at coordinates20. <b>Literal text</b>");
    await dm.getByLabel("Page folder").selectOption({ label: `${folderSecret} / Clue archive` });
    await dm.getByRole("button", { name: "Create private page", exact: true }).click();
    await expect(dm.getByRole("heading", { name: "Gate dispatch", exact: true })).toBeVisible();
    for (const p of players) {
      expect(JSON.stringify(await read(p))).not.toContain("coordinates20");
    }
    await dm.getByLabel("Search pages").fill("coordinates20");
    await expect(dm.getByRole("button", { name: "Gate dispatch", exact: true })).toBeVisible();
    await dm.getByLabel("Search pages").fill("NoSuchPage20");
    await expect(dm.getByText("No matching pages.", { exact: true })).toBeVisible();
    await dm.getByLabel("Search pages").fill("");
    await dm.getByRole("button", { name: "Gate dispatch", exact: true }).click();
    await dm.getByRole("button", { name: "Edit page", exact: true }).click();
    await dm.getByLabel("Page visibility").selectOption("shared");
    await dm.getByRole("button", { name: "Save and share page", exact: true }).click();
    await expect(dm.getByLabel("Page title", { exact: true })).toHaveCount(0);
    await expect(dm.getByRole("navigation", { name: "Journal directory" })).toContainText(
      "Clue archive",
    );
    await capture(dm, "journal_nested_directory");
    for (const p of players) {
      await p.getByRole("button", { name: "Gate dispatch", exact: true }).click();
      await expect(p.getByRole("heading", { name: "Gate dispatch", exact: true })).toBeVisible();
      expect(
        (await read(p)).journals.every((j: { folderId?: string }) => j.folderId === undefined),
      ).toBe(true);
      await expect(p.getByRole("button", { name: "Move page", exact: true })).toHaveCount(0);
    }
    const other = await owner.newPage();
    other.on("pageerror", (e) => errors.push(e.message));
    await other.goto(path);
    await expect(other.getByTestId("connection-status")).toHaveText("Live");
    await other.getByRole("button", { name: "Gate dispatch", exact: true }).click();
    await other.getByRole("button", { name: "Edit page", exact: true }).click();
    await other.getByLabel("Page text", { exact: true }).fill("Retain this concurrent draft");
    await dm.getByRole("button", { name: "Move page", exact: true }).click();
    await dialog(dm).getByLabel("Destination folder").selectOption({ label: folderSecret });
    await dialog(dm).getByRole("button", { name: "Move page", exact: true }).click();
    await expect(dialog(dm)).toHaveCount(0);
    await expect(
      other.getByRole("button", { name: "Save and share page", exact: true }),
    ).toBeDisabled();
    await expect(other.getByLabel("Page text", { exact: true })).toHaveValue(
      "Retain this concurrent draft",
    );
    await other.getByRole("button", { name: "Reload page", exact: true }).click();
    await expect(other.getByLabel("Page text", { exact: true })).toHaveValue(
      "Meet at coordinates20. <b>Literal text</b>",
    );
    await other.getByRole("button", { name: "Cancel", exact: true }).click();
    await other.getByRole("button", { name: `Manage folder ${folderSecret}`, exact: true }).click();
    await dialog(other).getByLabel("Folder name").fill("Local stale folder name");
    await dm.getByRole("button", { name: `Manage folder ${folderSecret}`, exact: true }).click();
    await dialog(dm).getByLabel("Folder name").fill("Renamed preparation");
    await dialog(dm).getByRole("button", { name: "Save folder", exact: true }).click();
    await expect(dialog(dm)).toHaveCount(0);
    await expect(
      dialog(other).getByRole("button", { name: "Save folder", exact: true }),
    ).toBeDisabled();
    await expect(dialog(other).getByLabel("Folder name")).toHaveValue("Local stale folder name");
    await dialog(other).getByRole("button", { name: "Reload organization", exact: true }).click();
    await expect(dialog(other).getByLabel("Folder name")).toHaveValue("Renamed preparation");
    await dialog(other).getByRole("button", { name: "Cancel", exact: true }).click();
    await other.close();
    await dm
      .getByRole("button", { name: "Manage folder Renamed preparation", exact: true })
      .click();
    await dialog(dm).getByRole("button", { name: "Delete folder", exact: true }).click();
    await expect(dialog(dm)).toContainText("No pages will be deleted");
    await dialog(dm).getByRole("button", { name: "Confirm folder deletion", exact: true }).click();
    await expect(dialog(dm)).toHaveCount(0);
    const after = await read(dm);
    expect(after.folders).toHaveLength(1);
    expect(after.folders[0].parentId).toBeNull();
    const page = after.journals.find((j: { title: string }) => j.title === "Gate dispatch");
    expect(page.body).toBe("Meet at coordinates20. <b>Literal text</b>");
    expect(page.folderId).toBeUndefined();
    expect(page.version).toBe(4);
    await stop();
    await start();
    for (const p of [dm, ...players]) {
      await p.reload();
      await expect(p.getByTestId("connection-status")).toHaveText("Live");
      await expect(p.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      await p.getByRole("button", { name: "Gate dispatch", exact: true }).click();
      await expect(p.getByRole("heading", { name: "Gate dispatch", exact: true })).toBeVisible();
    }
    expect((await read(dm)).folders).toHaveLength(1);
    for (const p of players) {
      expect((await read(p)).folders).toBeUndefined();
      await expectIdleMap(p);
    }
    async function capture(p: Page, name: string) {
      const dir = process.env.HEARTH_FOLDERS_CAPTURE_DIR;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        await p.screenshot({ path: join(dir, `Hearth_VTT_0.0.20_${name}.png`), fullPage: true });
      }
    }
    await capture(dm, "journal_directory");
    await capture(players[0], "journal_player");
    await dm.getByRole("button", { name: "Manage folder Clue archive", exact: true }).click();
    await capture(dm, "journal_folder_editor");
    for (const viewport of [
      { width: 760, height: 700 },
      { width: 390, height: 700 },
      { width: 900, height: 520 },
    ]) {
      await dm.setViewportSize(viewport);
      const save = dialog(dm).getByRole("button", { name: "Save folder", exact: true });
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport({ ratio: 1 });
      await save.click({ trial: true });
      const box = await dialog(dm).boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
      await capture(dm, `journal_editor_${viewport.width}`);
    }
    await dialog(dm).getByRole("button", { name: "Cancel", exact: true }).click();
    expect(frames.join(" ")).not.toContain(folderSecret);
    for (const id of folderIds) expect(frames.join(" ")).not.toContain(id);
    expect(errors).toEqual([]);
  } finally {
    try {
      for (const context of contexts) await context.close();
    } finally {
      await stop();
      rmSync(data, { recursive: true, force: true });
    }
  }
});
