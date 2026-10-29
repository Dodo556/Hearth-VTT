import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";
import { trackDraws } from "./canvasChecks";

const baseURL = "http://127.0.0.1:8804";

test("journal image handouts stay private until reveal and revoke future image access on hide", async ({
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
        HEARTH_BIND: "127.0.0.1:8804",
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
    const playerFrames: string[][] = [];
    dm.on("pageerror", (e) => errors.push(e.message));
    await trackDraws(dm);
    await dm.goto("/");
    await dm.getByLabel("Username", { exact: false }).fill("handouts_dm");
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
          username: `handout_${name.toLowerCase()}`,
          displayName: name,
          password: "fictional player password",
        },
      });
      expect(join.ok()).toBe(true);
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      const received: string[] = [];
      playerFrames.push(received);
      page.on("websocket", (s) =>
        s.on("framereceived", (f) => {
          frames.push(String(f.payload));
          received.push(String(f.payload));
        }),
      );
      await trackDraws(page);
      await page.goto(path);
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      await page.getByRole("tab", { name: "Journal", exact: true }).click();
      players.push(page);
    }
    await dm.getByRole("tab", { name: "Journal", exact: true }).click();
    await dm.getByRole("button", { name: "New page", exact: true }).click();
    await dm.getByLabel("Page title", { exact: true }).fill("The amber seal");
    await dm
      .getByLabel("Page text", { exact: true })
      .fill("A fictional clue for the eastern gate.");
    await dm
      .getByLabel("Handout image", { exact: true })
      .setInputFiles("content/examples/amber-keep/warden.png");
    await expect(dm.getByRole("img", { name: "Handout preview" })).toBeVisible();
    await dm.getByRole("button", { name: "Create private page", exact: true }).click();
    await expect(dm.getByRole("heading", { name: "The amber seal" })).toBeVisible();
    const read = async (p: Page) =>
      (await p.request.get(`/api/campaigns/${campaign}/journals`)).json();
    const saved = (await read(dm)).journals.find(
      (j: { title: string }) => j.title === "The amber seal",
    );
    const art = saved.assetId;
    expect(art).toBeTruthy();
    const imageURL = `/api/campaigns/${campaign}/assets/${art}`;
    for (const p of players) {
      expect(JSON.stringify(await read(p))).not.toContain(art);
      expect((await p.request.get(imageURL)).status()).toBe(404);
    }
    expect(frames.every((f) => !f.includes(art) && !f.includes(saved.id))).toBe(true);
    await dm.getByRole("button", { name: "Reveal to players", exact: true }).click();
    for (const p of players) {
      await p.getByRole("button", { name: "The amber seal", exact: true }).click();
      const image = p.getByRole("img", { name: "The amber seal", exact: true });
      await expect(image).toBeVisible();
      await expect
        .poll(() => image.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth === 160))
        .toBe(true);
      const response = await p.request.get(imageURL);
      expect(response.ok()).toBe(true);
      expect(response.headers()["cache-control"]).toContain("no-store");
      await expect(p.getByRole("button", { name: "Hide from players", exact: true })).toHaveCount(
        0,
      );
    }
    await stop();
    await start();
    for (const p of [dm, ...players]) {
      await p.reload();
      await expect(p.getByTestId("connection-status")).toHaveText("Live");
      await p.getByRole("button", { name: "The amber seal", exact: true }).click();
      await expect(p.getByRole("img", { name: "The amber seal", exact: true })).toBeVisible();
    }
    const capture = async (p: Page, name: string) => {
      const dir = process.env.HEARTH_HANDOUT_CAPTURE_DIR;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        await p.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
      }
    };
    await capture(dm, "handout-gm");
    await capture(players[0], "handout-player");
    for (const viewport of [
      { width: 760, height: 700 },
      { width: 390, height: 700 },
      { width: 900, height: 520 },
    ]) {
      await dm.setViewportSize(viewport);
      const hide = dm.getByRole("button", { name: "Hide from players", exact: true });
      await hide.scrollIntoViewIfNeeded();
      await expect(hide).toBeInViewport({ ratio: 1 });
      await hide.click({ trial: true });
      const image = await dm
        .getByRole("img", { name: "The amber seal", exact: true })
        .boundingBox();
      expect(image && image.x >= 0 && image.x + image.width <= viewport.width).toBe(true);
      await capture(dm, `handout-${viewport.width}`);
    }
    await dm.setViewportSize({ width: 1440, height: 1000 });
    await dm.getByRole("button", { name: "Hide from players", exact: true }).click();
    for (const p of players) {
      await expect(p.getByRole("img", { name: "The amber seal", exact: true })).toHaveCount(0);
      expect((await p.request.get(imageURL)).status()).toBe(404);
      await p.reload();
      await expect(p.getByTestId("connection-status")).toHaveText("Live");
      expect(JSON.stringify(await read(p))).not.toContain(art);
    }
    playerFrames[1].length = 0;
    const share = () => dm.getByRole("dialog", { name: "Share page", exact: true });
    await dm.getByRole("button", { name: "Share page", exact: true }).click();
    await share().getByLabel("Share with").selectOption("selected");
    await expect(share().getByRole("button", { name: "Save sharing", exact: true })).toBeDisabled();
    await share().getByRole("checkbox", { name: "Alice", exact: true }).check();
    await capture(dm, "sharing-desktop");
    for (const viewport of [
      { width: 760, height: 700 },
      { width: 390, height: 700 },
      { width: 900, height: 520 },
    ]) {
      await dm.setViewportSize(viewport);
      const save = share().getByRole("button", { name: "Save sharing", exact: true });
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport({ ratio: 1 });
      await save.click({ trial: true });
      const box = await share().boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
      await capture(dm, `sharing-${viewport.width}`);
    }
    await dm.setViewportSize({ width: 1440, height: 1000 });
    await share().getByRole("button", { name: "Save sharing", exact: true }).click();
    await expect(share()).toHaveCount(0);
    await players[0].getByRole("button", { name: "The amber seal", exact: true }).click();
    await expect(
      players[0].getByRole("img", { name: "The amber seal", exact: true }),
    ).toBeVisible();
    expect((await players[1].request.get(imageURL)).status()).toBe(404);
    expect(playerFrames[1].every((f) => !f.includes(saved.id) && !f.includes(art))).toBe(true);
    expect(
      (await read(players[0])).journals.find((j: { id: string }) => j.id === saved.id).recipientIds,
    ).toBeUndefined();
    await dm.getByRole("button", { name: "Edit page", exact: true }).click();
    await expect(dm.getByLabel("Page visibility")).toHaveValue("selected");
    await expect(dm.getByRole("checkbox", { name: "Alice", exact: true })).toBeChecked();
    await dm.getByLabel("Page text", { exact: true }).fill("SELECTED PRIVATE LITERAL CLUE");
    await dm.getByRole("button", { name: "Save selected page", exact: true }).click();
    await expect(dm.getByLabel("Page title", { exact: true })).toHaveCount(0);
    expect(playerFrames[1].every((f) => !f.includes("SELECTED PRIVATE LITERAL CLUE"))).toBe(true);
    const other = await owner.newPage();
    await other.goto(path);
    await expect(other.getByTestId("connection-status")).toHaveText("Live");
    await other.getByRole("button", { name: "The amber seal", exact: true }).click();
    await other.getByRole("button", { name: "Share page", exact: true }).click();
    await dm.getByRole("button", { name: "Share page", exact: true }).click();
    await share().getByRole("checkbox", { name: "Alice", exact: true }).uncheck();
    await share().getByRole("checkbox", { name: "Bob", exact: true }).check();
    await share().getByRole("button", { name: "Save sharing", exact: true }).click();
    await expect(share()).toHaveCount(0);
    await expect(other.getByRole("button", { name: "Save sharing", exact: true })).toBeDisabled();
    await other.getByRole("button", { name: "Reload sharing", exact: true }).click();
    await expect(other.getByRole("checkbox", { name: "Bob", exact: true })).toBeChecked();
    await other.close();
    await expect(players[0].getByRole("img", { name: "The amber seal", exact: true })).toHaveCount(
      0,
    );
    expect((await players[0].request.get(imageURL)).status()).toBe(404);
    await players[1].getByRole("button", { name: "The amber seal", exact: true }).click();
    await expect(
      players[1].getByRole("img", { name: "The amber seal", exact: true }),
    ).toBeVisible();
    await capture(players[1], "selected-player");
    await stop();
    await start();
    for (const p of [dm, ...players]) {
      await p.reload();
      await expect(p.getByTestId("connection-status")).toHaveText("Live");
    }
    expect((await players[0].request.get(imageURL)).status()).toBe(404);
    await players[1].getByRole("button", { name: "The amber seal", exact: true }).click();
    await expect(
      players[1].getByRole("img", { name: "The amber seal", exact: true }),
    ).toBeVisible();
    const people = (await (await dm.request.get(`/api/campaigns/${campaign}/participants`)).json())
      .participants;
    const bob = people.find((p: { displayName: string }) => p.displayName === "Bob");
    expect(
      (
        await dm.request.post(`/api/campaigns/${campaign}/members/${bob.id}/revoke`, {
          headers,
          data: {},
        })
      ).ok(),
    ).toBe(true);
    expect((await players[1].request.get(imageURL)).ok()).toBe(false);
    await dm.getByRole("button", { name: "The amber seal", exact: true }).click();
    await dm.getByRole("button", { name: "Edit page", exact: true }).click();
    await dm.getByLabel("Handout image", { exact: true }).setInputFiles({
      name: "invalid.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
    await expect(dm.getByRole("alert")).toContainText("PNG, JPEG or WebP");
    await expect(dm.getByLabel("Page title", { exact: true })).toHaveValue("The amber seal");
    await dm.getByRole("button", { name: "Remove image", exact: true }).click();
    await dm.getByRole("button", { name: "Save private page", exact: true }).click();
    expect(
      (await read(dm)).journals.find((j: { id: string }) => j.id === saved.id).assetId,
    ).toBeUndefined();
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    await stop();
    rmSync(data, { recursive: true, force: true });
  }
});
