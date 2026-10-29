import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";
import { trackDraws } from "./canvasChecks";

test("journal image handouts stay private until reveal and revoke future image access on hide", async ({
  browser,
}) => {
  const reservation = createServer();
  await new Promise<void>((done, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", done);
  });
  const bind = `127.0.0.1:${(reservation.address() as AddressInfo).port}`;
  await new Promise<void>((done, reject) => reservation.close((e) => (e ? reject(e) : done())));
  const baseURL = `http://${bind}`;
  const data = mkdtempSync(join(tmpdir(), "hearth-journal-folders-"));
  const contexts: BrowserContext[] = [];
  let host: ChildProcess | undefined;
  async function start() {
    host = spawn(testHostExecutable(), [], {
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        HEARTH_BIND: bind,
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
    const external: string[] = [];
    const frames: string[] = [];
    const playerFrames: string[][] = [];
    dm.on("pageerror", (e) => errors.push(e.message));
    dm.on("request", (r) => {
      if (r.url().includes("outside.invalid")) external.push(r.url());
    });
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
      page.on("request", (r) => {
        if (r.url().includes("outside.invalid")) external.push(r.url());
      });
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
    await dm.getByLabel("Text format", { exact: true }).selectOption("markdown");
    const rich =
      "# Encrypted dispatch\nSELECTED PRIVATE LITERAL CLUE\n\n- [x] Cleared\n- [ ] Follow the trail\n\n<img src=https://outside.invalid/x onerror=window.hearthRich=1>\n[trap](javascript:window.hearthRich=1) ![beacon](https://outside.invalid/x)";
    await dm.getByLabel("Page text", { exact: true }).fill(rich);
    await dm.getByLabel("Page text", { exact: true }).evaluate((e: HTMLTextAreaElement) => {
      const at = e.value.indexOf("SELECTED PRIVATE LITERAL CLUE");
      e.setSelectionRange(at, at + "SELECTED PRIVATE LITERAL CLUE".length);
    });
    await dm.getByRole("button", { name: "Bold", exact: true }).click();
    await expect(dm.getByLabel("Page text", { exact: true })).toHaveValue(
      rich.replace("SELECTED PRIVATE LITERAL CLUE", "**SELECTED PRIVATE LITERAL CLUE**"),
    );
    await capture(dm, "formatted-source");
    await dm.getByRole("button", { name: "Preview formatting", exact: true }).click();
    const preview = dm.getByRole("region", { name: "Journal preview" });
    await expect(preview.getByRole("heading", { name: "Encrypted dispatch" })).toBeVisible();
    await expect(preview.locator("strong")).toHaveText("SELECTED PRIVATE LITERAL CLUE");
    await expect(preview.locator("script,img,a,iframe")).toHaveCount(0);
    await capture(dm, "formatted-preview");
    for (const viewport of [
      { width: 760, height: 700 },
      { width: 390, height: 700 },
      { width: 900, height: 520 },
    ]) {
      await dm.setViewportSize(viewport);
      const save = dm.getByRole("button", { name: "Save selected page", exact: true });
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport({ ratio: 1 });
      await save.click({ trial: true });
      const box = await dm.locator(".journal-text-editor").boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
      await capture(dm, `formatted-editor-${viewport.width}`);
    }
    await dm.setViewportSize({ width: 1440, height: 1000 });
    await dm.getByRole("button", { name: "Save selected page", exact: true }).click();
    await expect(dm.getByLabel("Page title", { exact: true })).toHaveCount(0);
    expect(playerFrames[1].every((f) => !f.includes("SELECTED PRIVATE LITERAL CLUE"))).toBe(true);
    await expect(players[0].getByRole("heading", { name: "Encrypted dispatch" })).toBeVisible();
    await expect(players[0].locator(".journal-rich strong")).toHaveText(
      "SELECTED PRIVATE LITERAL CLUE",
    );
    await expect(
      players[0].locator(".journal-rich script,.journal-rich img,.journal-rich a"),
    ).toHaveCount(0);
    const sourceBeforeCopy = (await read(dm)).journals.find(
      (j: { id: string }) => j.id === saved.id,
    );
    for (const p of players)
      await expect(p.getByRole("button", { name: "Use as template", exact: true })).toHaveCount(0);
    await dm.getByRole("button", { name: "Use as template", exact: true }).click();
    const reuse = dm.getByRole("dialog", { name: "Use page as template", exact: true });
    await reuse.getByLabel("Copy title", { exact: true }).fill("Amber mission copy");
    await capture(dm, "reuse-desktop");
    for (const viewport of [
      { width: 760, height: 700 },
      { width: 390, height: 700 },
      { width: 900, height: 520 },
    ]) {
      await dm.setViewportSize(viewport);
      const action = reuse.getByRole("button", { name: "Create private copy", exact: true });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport({ ratio: 1 });
      await action.click({ trial: true });
      const box = await reuse.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
      await capture(dm, `reuse-${viewport.width}`);
    }
    await dm.setViewportSize({ width: 1440, height: 1000 });
    await reuse.getByRole("button", { name: "Create private copy", exact: true }).click();
    await expect(reuse).toHaveCount(0);
    await expect(
      dm.getByRole("heading", { name: "Amber mission copy", exact: true }),
    ).toBeVisible();
    const copied = (await read(dm)).journals.find(
      (j: { title: string }) => j.title === "Amber mission copy",
    );
    expect(copied).toMatchObject({
      body: sourceBeforeCopy.body,
      bodyFormat: "markdown",
      assetId: art,
      visibility: "dm",
      version: 1,
    });
    expect(copied.recipientIds).toBeUndefined();
    expect(copied.folderId).toBeUndefined();
    expect((await read(dm)).journals.find((j: { id: string }) => j.id === saved.id)).toEqual(
      sourceBeforeCopy,
    );
    for (const p of players) {
      expect(JSON.stringify(await read(p))).not.toContain(copied.id);
      expect(
        (await p.request.get(`/api/campaigns/${campaign}/journals/${copied.id}`)).status(),
      ).toBe(404);
    }
    expect(playerFrames.every((messages) => messages.every((f) => !f.includes(copied.id)))).toBe(
      true,
    );
    await dm.getByRole("button", { name: "Edit page", exact: true }).click();
    await dm.getByLabel("Page text", { exact: true }).fill("PRIVATE COPY CLUE");
    await dm.getByRole("button", { name: "Save private page", exact: true }).click();
    await expect(
      dm.getByRole("heading", { name: "Amber mission copy", exact: true }),
    ).toBeVisible();
    await dm.getByRole("button", { name: "The amber seal", exact: true }).click();
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
    expect(
      (await read(dm)).journals.find((p: { id: string }) => p.id === saved.id).bodyFormat,
    ).toBe("markdown");
    await expect(players[1].getByRole("heading", { name: "Encrypted dispatch" })).toBeVisible();
    expect((await read(dm)).journals.find((j: { id: string }) => j.id === copied.id)).toMatchObject(
      {
        body: "PRIVATE COPY CLUE",
        bodyFormat: "markdown",
        assetId: art,
        visibility: "dm",
        version: 2,
      },
    );
    for (const p of players) expect(JSON.stringify(await read(p))).not.toContain(copied.id);
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
    // Independent copied-page grants survive removal of the original page's image.
    await dm.getByRole("button", { name: "Amber mission copy", exact: true }).click();
    await dm.getByRole("button", { name: "Reveal to players", exact: true }).click();
    await players[0].getByRole("button", { name: "Amber mission copy", exact: true }).click();
    await expect(
      players[0].getByRole("img", { name: "Amber mission copy", exact: true }),
    ).toBeVisible();
    expect((await players[0].request.get(imageURL)).ok()).toBe(true);
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 760, height: 700 },
      { width: 390, height: 700 },
      { width: 900, height: 520 },
    ]) {
      await dm.setViewportSize(viewport);
      const actions = dm.locator(".journal-page > .dialog-actions > button");
      await expect(actions).toHaveCount(6);
      await actions.last().scrollIntoViewIfNeeded();
      const panel = await dm
        .getByRole("complementary", { name: "Workspace sidebar" })
        .boundingBox();
      for (const action of await actions.all()) {
        await expect(action).toBeInViewport({ ratio: 1 });
        const box = await action.boundingBox();
        expect(panel && box && box.x >= panel.x && box.x + box.width <= panel.x + panel.width).toBe(
          true,
        );
      }
      await capture(dm, `reused-actions-${viewport.width}`);
    }
    await dm.setViewportSize({ width: 1440, height: 1000 });
    await capture(dm, "reused-page");
    await dm.getByRole("button", { name: "Hide from players", exact: true }).click();
    await expect(
      players[0].getByRole("button", { name: "Amber mission copy", exact: true }),
    ).toHaveCount(0);
    expect((await players[0].request.get(imageURL)).status()).toBe(404);
    expect(external).toEqual([]);
    for (const p of [dm, ...players])
      expect(await p.evaluate(() => "hearthRich" in window)).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    await stop();
    rmSync(data, { recursive: true, force: true });
  }
});
