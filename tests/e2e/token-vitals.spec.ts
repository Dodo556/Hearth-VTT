import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import type { Scene, Token } from "../../packages/protocol/src/index";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";
import { expectContextRecovery, expectIdleMap, trackDraws } from "./canvasChecks";

const baseURL = "http://127.0.0.1:8802";
const inspector = (page: Page) => page.locator('[data-window-id="token-inspector"]');
async function point(page: Page, x: number, y: number, zoom = 1) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Canvas missing");
  const scale = Math.min(box.width / 1440, box.height / 960) * 0.92 * zoom;
  return {
    x: box.x + (box.width - 1440 * scale) / 2 + x * scale,
    y: box.y + (box.height - 960 * scale) / 2 + y * scale,
  };
}
async function commands(page: Page, campaign: string, commands: unknown[]) {
  await page.evaluate(
    async ({ campaign, commands }) => {
      const url = new URL(`/api/campaigns/${campaign}/ws`, location.href);
      url.protocol = "ws:";
      const ws = new WebSocket(url, "hearth.v1");
      let revision = 0;
      let pending: { id: string; resolve: () => void; reject: (e: Error) => void } | null = null;
      let readyResolve: () => void = () => {},
        readyReject: (e: Error) => void = () => {};
      const ready = new Promise<void>((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
      });
      ws.onopen = () =>
        ws.send(JSON.stringify({ kind: "hello", schemaVersion: 1, lastRevision: null }));
      ws.onmessage = (e) => {
        const f = JSON.parse(e.data);
        if (f.kind === "snapshot") {
          revision = f.revision;
          readyResolve();
        }
        if (f.kind === "ack" && pending && pending.id === f.requestId) {
          revision = f.revision;
          pending.resolve();
          pending = null;
        }
        if (f.kind === "error") {
          const error = new Error(f.error.message);
          if (pending) {
            pending.reject(error);
            pending = null;
          } else readyReject(error);
        }
      };
      ws.onerror = () => readyReject(new Error("Fixture connection failed"));
      try {
        await ready;
        for (const command of commands) {
          await new Promise<void>((resolve, reject) => {
            const id = crypto.randomUUID();
            pending = { id, resolve, reject };
            ws.send(
              JSON.stringify({
                kind: "command",
                schemaVersion: 1,
                requestId: id,
                baseRevision: revision,
                command,
              }),
            );
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } finally {
        ws.close();
      }
    },
    { campaign, commands },
  );
}
test("token HP and manual markers stay private, synchronize linked sheets and expose safe context actions", async ({
  browser,
}) => {
  const data = mkdtempSync(join(tmpdir(), "hearth-token-vitals-"));
  const contexts: BrowserContext[] = [];
  let host: ChildProcess | undefined;
  async function start() {
    host = spawn(testHostExecutable(), [], {
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        HEARTH_BIND: "127.0.0.1:8802",
        HEARTH_ORIGINS: baseURL,
        HEARTH_DATA_DIR: data,
        HEARTH_WEB_DIR: resolve("apps/web/dist"),
      },
    });
    for (let i = 0; i < 150; i++) {
      if (host.exitCode !== null) throw new Error("Vitals host exited");
      try {
        if ((await fetch(`${baseURL}/api/health`)).ok) return;
      } catch {}
      await delay(100);
    }
    throw new Error("Vitals host not ready");
  }
  async function stop() {
    if (!host || host.exitCode !== null) return;
    const done = new Promise<void>((resolve) => host?.once("exit", () => resolve()));
    host.kill("SIGINT");
    await Promise.race([done, delay(5000)]);
    if (host.exitCode === null) {
      host.kill("SIGKILL");
      await done;
    }
  }
  try {
    await start();
    const owner = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
    contexts.push(owner);
    const dm = await owner.newPage();
    const errors: string[] = [];
    const bobFrames: string[] = [];
    dm.on("pageerror", (e) => errors.push(e.message));
    await trackDraws(dm);
    await dm.goto("/");
    await dm.getByLabel("Username", { exact: false }).fill("vitals_dm");
    await dm.getByLabel("Display name").fill("Game Master");
    await dm.getByLabel("Password", { exact: false }).fill("fictional vitals password");
    await dm.getByRole("button", { name: "Create my Hearth" }).click();
    await dm.getByRole("link", { name: "Explore the sample" }).click();
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    const campaign = new URL(dm.url()).pathname.split("/").pop();
    if (!campaign) throw new Error("Campaign missing");
    const headers = { "X-Hearth-Request": "1", Origin: baseURL };
    const ids: Record<string, string> = {};
    const players: Page[] = [];
    const read = async (page: Page): Promise<Scene[]> =>
      (await (await page.request.get(`/api/campaigns/${campaign}/scenes`)).json()).scenes;
    const initial = (await read(dm))[0];
    const found = initial.tokens.find((t) => t.name.startsWith("Rowan"));
    if (!found) throw new Error("Token missing");
    const rowan: Token = found;
    const token = async (page: Page): Promise<Token> => {
      const t = (await read(page)).flatMap((s) => s.tokens).find((t) => t.id === rowan.id);
      if (!t) throw new Error("Visible token missing");
      return t;
    };
    async function menu(page: Page, x = rowan.x, y = rowan.y) {
      const p = await point(page, x, y);
      await page.mouse.click(p.x, p.y, { button: "right" });
      await expect(page.getByRole("menu")).toBeVisible();
    }
    async function controls(page: Page) {
      await menu(page);
      await page.getByRole("menuitem", { name: "Token controls", exact: true }).click();
      await expect(inspector(page)).toBeVisible();
    }
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
          username: `vitals_${name.toLowerCase()}`,
          displayName: name,
          password: "fictional player password",
        },
      });
      expect(joined.ok()).toBe(true);
      ids[name] = (await joined.json()).user.id;
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await trackDraws(page);
      if (name === "Bob")
        page.on("websocket", (s) =>
          s.on("framereceived", (f) => bobFrames.push(String(f.payload))),
        );
      await page.goto(`/campaign/${campaign}`);
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      await expectIdleMap(page);
      players.push(page);
    }
    const [alice, bob] = players;
    await commands(dm, campaign, [
      { type: "token.assign", payload: { tokenId: rowan.id, userId: ids.Alice } },
    ]);
    // Compare the complete battlefield, independently of HTML camera/tool chrome.
    const pixels = async () => {
      const a = await point(bob, 0, 0),
        b = await point(bob, initial.width, initial.height);
      return bob.screenshot({
        clip: { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y },
        style:
          ".workspace-window, .selected-token-hud, .token-context-menu, .workspace-tools, .workspace-scenes, .workspace-bottom, .canvas-controls, .canvas-status {visibility:hidden!important}",
      });
    };
    const clean = await pixels();
    await controls(dm);
    await inspector(dm).getByLabel("Current HP", { exact: true }).fill("12");
    await inspector(dm).getByLabel("Maximum HP", { exact: true }).fill("20");
    await inspector(dm).getByRole("button", { name: "Save health & status", exact: true }).click();
    await expect.poll(async () => (await token(alice)).health?.hp).toBe(12);
    expect((await token(bob)).health).toBeUndefined();
    expect((await token(bob)).vitals).toBeUndefined();
    await expect.poll(async () => (await pixels()).equals(clean)).toBe(true);
    await commands(dm, campaign, [
      { type: "token.move", payload: { tokenId: rowan.id, x: rowan.x, y: rowan.y } },
    ]);
    const tokenFrames = bobFrames
      .map((raw) => JSON.parse(raw))
      .flatMap((f) =>
        f.kind === "snapshot"
          ? f.scenes.flatMap((s: Scene) => s.tokens)
          : f.payload?.token
            ? [f.payload.token]
            : [],
      )
      .filter((t: Token) => t.id === rowan.id);
    expect(tokenFrames.every((t: Token) => t.health === undefined && t.vitals === undefined)).toBe(
      true,
    );
    await inspector(dm).getByRole("button", { name: "Marked", exact: true }).click();
    await inspector(dm).getByRole("button", { name: "Poisoned", exact: true }).click();
    await inspector(dm).getByRole("button", { name: "Save health & status", exact: true }).click();
    await expect.poll(async () => (await token(bob)).statuses).toEqual(["marked", "poisoned"]);
    await expect.poll(async () => !(await pixels()).equals(clean)).toBe(true);
    await expect(bob.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    await expectIdleMap(bob);
    await inspector(dm).getByLabel("Map HP visibility").selectOption("shared");
    await inspector(dm).getByRole("button", { name: "Save health & status", exact: true }).click();
    await expect.poll(async () => (await token(bob)).health?.hp).toBe(12);
    await menu(bob);
    await expect(bob.getByRole("menuitem")).toHaveCount(1);
    await bob.getByRole("menuitem", { name: "Token controls", exact: true }).click();
    await expect(inspector(bob).locator(".token-vitals")).toContainText("12 / 20 HP");
    await expect(inspector(bob).getByRole("spinbutton")).toHaveCount(0);
    const aPoint = await point(alice, rowan.x, rowan.y);
    await alice.mouse.click(aPoint.x, aPoint.y);
    await alice.locator("canvas").press("Shift+F10");
    await expect(alice.getByRole("menu")).toBeVisible();
    await alice.getByRole("menu").press("Escape");
    await expect(alice.locator("canvas")).toBeFocused();
    await alice.locator("canvas").press("ContextMenu");
    await alice.getByRole("menuitem", { name: "Token controls", exact: true }).click();
    await expect(inspector(alice).getByLabel("Current HP", { exact: true })).toHaveValue("12");
    await inspector(alice).getByLabel("Current HP", { exact: true }).fill("10");
    await inspector(alice)
      .getByRole("button", { name: "Save health & status", exact: true })
      .click();
    await expect(inspector(dm).getByLabel("Current HP", { exact: true })).toHaveValue("10");
    await inspector(dm).getByLabel("Current HP", { exact: true }).fill("9");
    await inspector(alice).getByLabel("Current HP", { exact: true }).fill("8");
    await inspector(alice)
      .getByRole("button", { name: "Save health & status", exact: true })
      .click();
    await expect(inspector(dm)).toContainText("Your draft is kept");
    await expect(
      inspector(dm).getByRole("button", { name: "Save health & status", exact: true }),
    ).toBeDisabled();
    await inspector(dm)
      .getByRole("button", { name: "Reload health & status", exact: true })
      .click();
    await expect(inspector(dm).getByLabel("Current HP", { exact: true })).toHaveValue("8");
    const actor = crypto.randomUUID();
    await commands(dm, campaign, [
      {
        type: "actor.create",
        payload: {
          actorId: actor,
          name: "Bound warden",
          kind: "character",
          assetId: rowan.assetId,
          biography: "",
          dmNotes: "ACTOR_SECRET_V19",
          hp: 30,
          maxHp: 40,
          attributes: {},
        },
      },
      {
        type: "actor.permission",
        payload: { actorId: actor, userId: ids.Alice, permission: "owner" },
      },
    ]);
    await inspector(dm)
      .getByRole("button", { name: "Position & permissions", exact: true })
      .click();
    await inspector(dm).getByLabel("Linked actor", { exact: true }).selectOption(actor);
    await inspector(dm).getByRole("button", { name: "Health & status", exact: true }).click();
    await expect(inspector(dm).getByLabel("Current HP", { exact: true })).toHaveValue("30");
    await expect(inspector(alice).getByLabel("Current HP", { exact: true })).toHaveValue("30");
    await expect(inspector(bob).locator(".token-vitals")).toContainText("HP is not shared");
    expect((await token(bob)).actorId).toBeNull();
    expect((await token(bob)).health).toBeUndefined();
    await inspector(alice).getByLabel("Current HP", { exact: true }).fill("25");
    await inspector(alice)
      .getByRole("button", { name: "Save health & status", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await (await dm.request.get(`/api/campaigns/${campaign}/actors`)).json()).actors.find(
            (a: { id: string }) => a.id === actor,
          )?.hp,
      )
      .toBe(25);
    await inspector(dm).getByLabel("Current HP", { exact: true }).fill("23");
    await commands(alice, campaign, [
      {
        type: "actor.update",
        payload: {
          actorId: actor,
          expectedVersion: 2,
          name: "Bound warden",
          biography: "",
          hp: 19,
          maxHp: 40,
          attributes: {},
        },
      },
    ]);
    await expect(inspector(dm)).toContainText("Your draft is kept");
    await inspector(dm)
      .getByRole("button", { name: "Reload health & status", exact: true })
      .click();
    await expect(inspector(dm).getByLabel("Current HP", { exact: true })).toHaveValue("19");
    await dm.getByRole("button", { name: "Close Token inspector", exact: true }).click();
    await bob.getByRole("button", { name: "Close Token inspector", exact: true }).click();
    await menu(bob);
    await menu(dm);
    await dm.getByRole("menuitem", { name: "Make GM-only", exact: true }).click();
    await expect(bob.getByRole("menu")).toHaveCount(0);
    await expect(inspector(alice)).toHaveCount(0);
    await expect
      .poll(async () => (await read(bob)).flatMap((s) => s.tokens).some((t) => t.id === rowan.id))
      .toBe(false);
    await menu(dm);
    await dm.getByRole("menuitem", { name: "Show to players", exact: true }).click();
    await expect.poll(async () => (await token(alice)).health?.hp).toBe(19);
    await controls(alice);
    await commands(dm, campaign, [
      {
        type: "actor.permission",
        payload: { actorId: actor, userId: ids.Alice, permission: "none" },
      },
    ]);
    await expect(inspector(alice).getByRole("spinbutton")).toHaveCount(0);
    await expect(inspector(alice).locator(".token-vitals")).toContainText("HP is not shared");
    await commands(dm, campaign, [
      { type: "token.link", payload: { tokenId: rowan.id, actorId: null } },
    ]);
    await controls(dm);
    await inspector(dm).getByLabel("Current HP", { exact: true }).fill("");
    await inspector(dm).getByLabel("Maximum HP", { exact: true }).fill("");
    await inspector(dm).getByRole("button", { name: "Marked", exact: true }).click();
    await inspector(dm).getByRole("button", { name: "Poisoned", exact: true }).click();
    await inspector(dm).getByRole("button", { name: "Save health & status", exact: true }).click();
    await expect.poll(async () => (await token(bob)).health).toBeUndefined();
    await expect.poll(async () => (await token(bob)).statuses ?? []).toEqual([]);
    await expect.poll(async () => (await pixels()).equals(clean)).toBe(true);
    // A newly rendered token can sort before older IDs; context actions must follow actual draw order.
    const disposable = "00000000-0000-4000-8000-000000000019";
    await commands(dm, campaign, [
      {
        type: "token.create",
        payload: {
          tokenId: disposable,
          sceneId: initial.id,
          name: "Disposable counter",
          assetId: rowan.assetId,
          size: rowan.size,
          x: rowan.x,
          y: rowan.y,
          visibility: "shared",
        },
      },
    ]);
    await dm.getByRole("button", { name: "Close Token inspector", exact: true }).click();
    await menu(dm);
    await expect(dm.getByRole("menu")).toHaveAccessibleName("Actions for Disposable counter");
    await dm.getByRole("menuitem", { name: "Delete token…", exact: true }).click();
    await expect(inspector(dm)).toContainText("Disposable counter");
    await inspector(dm).getByRole("button", { name: "Confirm delete", exact: true }).click();
    await expect
      .poll(async () => (await read(dm)).flatMap((s) => s.tokens).some((t) => t.id === disposable))
      .toBe(false);
    await controls(dm);
    await inspector(dm).getByLabel("Current HP", { exact: true }).fill("6");
    await inspector(dm).getByLabel("Maximum HP", { exact: true }).fill("20");
    await inspector(dm).getByLabel("Map HP visibility").selectOption("controllers");
    await inspector(dm).getByRole("button", { name: "Stunned", exact: true }).click();
    await inspector(dm).getByRole("button", { name: "Concentrating", exact: true }).click();
    await inspector(dm).getByRole("button", { name: "Save health & status", exact: true }).click();
    await commands(dm, campaign, [
      { type: "token.assign", payload: { tokenId: rowan.id, userId: ids.Alice } },
    ]);
    await stop();
    await start();
    for (const page of [dm, alice, bob]) {
      await page.reload();
      await expect(page.getByTestId("connection-status")).toHaveText("Live");
      await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    }
    await expect.poll(async () => (await token(alice)).health?.hp).toBe(6);
    expect((await token(bob)).health).toBeUndefined();
    expect((await token(dm)).statuses).toEqual(["stunned", "concentrating"]);
    await expectContextRecovery(alice);
    await expectIdleMap(alice);
    await expectIdleMap(bob);
    await alice.getByRole("button", { name: "Zoom in", exact: true }).click();
    const from = await point(alice, rowan.x, rowan.y, 1.2),
      to = await point(alice, rowan.x + 60, rowan.y, 1.2);
    await alice.mouse.move(from.x, from.y);
    await alice.mouse.down();
    await alice.mouse.move(to.x, to.y, { steps: 5 });
    await alice.mouse.up();
    await expect.poll(async () => (await token(dm)).x).toBe(rowan.x + 60);
    expect((await token(dm)).health?.hp).toBe(6);
    const captures = process.env.HEARTH_VITALS_CAPTURE_DIR;
    async function capture(page: Page, name: string) {
      if (captures) {
        mkdirSync(captures, { recursive: true });
        await page.screenshot({
          path: join(captures, `Hearth_VTT_0.0.19_${name}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    await capture(bob, "token_player");
    await menu(dm, rowan.x + 60, rowan.y);
    await capture(dm, "token_menu");
    await dm.getByRole("menuitem", { name: "Token controls", exact: true }).click();
    await inspector(dm).getByLabel("Current HP", { exact: true }).fill("7");
    const save = inspector(dm).getByRole("button", { name: "Save health & status", exact: true });
    await expect(save).toBeInViewport({ ratio: 1 });
    await save.click({ trial: true });
    await capture(dm, "token_controls");
    for (const viewport of [
      { width: 760, height: 700 },
      { width: 390, height: 700 },
      { width: 900, height: 520 },
    ]) {
      await dm.setViewportSize(viewport);
      if (viewport.width === 900)
        await dm.getByRole("button", { name: "Expand sidebar", exact: true }).click();
      await expect(inspector(dm).getByLabel("Current HP", { exact: true })).toHaveValue("7");
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport({ ratio: 1 });
      await save.click({ trial: true });
      await expect
        .poll(async () => {
          const w = await inspector(dm).boundingBox(),
            s = await dm.getByRole("complementary", { name: "Workspace sidebar" }).boundingBox();
          return w && s ? w.x + w.width - s.x : 9999;
        })
        .toBeLessThanOrEqual(0);
      await capture(
        dm,
        viewport.width === 760
          ? "token_controls_narrow"
          : viewport.width === 390
            ? "token_controls_constrained"
            : "token_controls_short",
      );
      await dm.getByRole("button", { name: "Close Token inspector", exact: true }).click();
      await dm.getByRole("button", { name: "Token actions", exact: true }).click();
      const lastAction = dm.getByRole("menuitem", { name: "Delete token…", exact: true });
      await expect(lastAction).toBeInViewport({ ratio: 1 });
      await lastAction.click({ trial: true });
      const menuBox = await dm.getByRole("menu").boundingBox();
      const stageBox = await dm.locator(".workspace-stage").boundingBox();
      expect(
        menuBox && stageBox && menuBox.y + menuBox.height <= stageBox.y + stageBox.height,
      ).toBe(true);
      await dm.getByRole("menuitem", { name: "Token controls", exact: true }).click();
      await inspector(dm).getByLabel("Current HP", { exact: true }).fill("7");
    }
    expect(bobFrames.join(" ")).not.toContain("ACTOR_SECRET_V19");
    expect(bobFrames.join(" ")).not.toContain(actor);
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    await stop();
    rmSync(data, { recursive: true, force: true });
  }
});
