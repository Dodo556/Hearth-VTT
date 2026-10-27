import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";

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
async function signIn(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: false }).fill(username);
  await page.getByLabel("Password", { exact: false }).fill(password);
  if (await page.getByLabel("Display name").count()) {
    await page.getByLabel("Display name").fill("Game Master");
    await page.getByRole("button", { name: "Create my Hearth", exact: true }).click();
  } else await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your campaigns." })).toBeVisible();
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const done = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGINT");
  await Promise.race([done, new Promise((resolve) => setTimeout(resolve, 5000))]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await done;
  }
}
test("owner browser recovers a complete host and both players retain only their authorized content", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const owner = await browser.newContext(),
    ac = await browser.newContext(),
    bc = await browser.newContext();
  const restoredContexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
  let child: ChildProcess | undefined;
  try {
    const dm = await owner.newPage(),
      a = await ac.newPage(),
      b = await bc.newPage();
    const errors: string[] = [],
      playerFrames: string[] = [];
    for (const p of [dm, a, b]) p.on("pageerror", (e) => errors.push(e.message));
    for (const p of [a, b])
      p.on("websocket", (s) => s.on("framereceived", (f) => playerFrames.push(String(f.payload))));
    await signIn(dm, "gamemaster", "a long strong password");
    const headers = { "X-Hearth-Request": "1", Origin: "http://127.0.0.1:8790" };
    const created = await dm.request.post("/api/campaigns", {
      headers,
      data: {
        name: "Recovered encounter",
        description: "Isolated full-host recovery",
        createDemo: true,
      },
    });
    expect(created.ok()).toBe(true);
    const camp = (await created.json()).campaign.id;
    await dm.goto(`/campaign/${camp}`);
    await expect(dm.getByTestId("connection-status")).toHaveText("Live");
    for (const [p, user] of [
      [a, "backup_alice"],
      [b, "backup_bob"],
    ] as const) {
      const invitation = await dm.request.post(`/api/campaigns/${camp}/invites`, {
        headers,
        data: { expiresInHours: 24 },
      });
      const joined = await p.request.post("/api/invites/redeem", {
        headers,
        data: {
          code: (await invitation.json()).invite.code,
          username: user,
          displayName: user,
          password: "a long player password",
        },
      });
      expect(joined.ok()).toBe(true);
      await p.goto(`/campaign/${camp}`);
      await expect(p.getByTestId("connection-status")).toHaveText("Live");
      await expect(p.getByRole("button", { name: "Backup & recovery", exact: true })).toHaveCount(
        0,
      );
      expect((await p.request.get("/api/host/recovery")).status()).toBe(403);
    }
    const roster = (await (await dm.request.get(`/api/campaigns/${camp}/participants`)).json())
      .participants;
    const scene = (await (await dm.request.get(`/api/campaigns/${camp}/scenes`)).json()).scenes[0];
    const uploaded = await dm.request.post(`/api/campaigns/${camp}/assets`, {
      headers: { ...headers, "Content-Type": "image/png" },
      data: readFileSync("content/examples/amber-keep/warden.png"),
    });
    expect(uploaded.ok()).toBe(true);
    const art = (await uploaded.json()).asset.id;
    const work: unknown[] = [];
    for (const token of scene.tokens) {
      const actorId = crypto.randomUUID(),
        hidden = token.visibility === "dm";
      work.push({
        type: "actor.create",
        payload: {
          actorId,
          name: token.name,
          kind: hidden ? "npc" : "character",
          assetId: hidden ? art : token.assetId,
          biography: "Persisted biography",
          dmNotes: "PRIVATE RECOVERY NOTES",
          hp: 18,
          maxHp: 20,
          attributes: {},
        },
      });
      if (!hidden) {
        work.push({ type: "actor.visibility", payload: { actorId, visibility: "shared" } });
        work.push({
          type: "actor.permission",
          payload: {
            actorId,
            userId: roster.find(
              (r: { displayName: string }) =>
                r.displayName === (token.name.startsWith("Rowan") ? "backup_alice" : "backup_bob"),
            ).id,
            permission: "owner",
          },
        });
      }
      work.push({ type: "token.link", payload: { tokenId: token.id, actorId } });
    }
    work.push({
      type: "journal.create",
      payload: {
        journalId: crypto.randomUUID(),
        title: "Recovery secret",
        body: "PRIVATE RECOVERY JOURNAL",
      },
    });
    work.push({
      type: "combat.create",
      payload: {
        clientEncounterId: crypto.randomUUID(),
        sceneId: scene.id,
        name: "Persistent encounter",
      },
    });
    await commands(dm, camp, work);
    let encounter = (await (await dm.request.get(`/api/campaigns/${camp}/combat`)).json())
      .encounter;
    for (const token of scene.tokens) {
      await commands(dm, camp, [
        {
          type: "combat.add",
          payload: {
            encounterId: encounter.id,
            expectedVersion: encounter.version,
            clientCombatantId: crypto.randomUUID(),
            tokenId: token.id,
          },
        },
      ]);
      encounter = (await (await dm.request.get(`/api/campaigns/${camp}/combat`)).json()).encounter;
    }
    await commands(dm, camp, [
      {
        type: "combat.start",
        payload: { encounterId: encounter.id, expectedVersion: encounter.version },
      },
    ]);
    const bob = roster.find((r: { displayName: string }) => r.displayName === "backup_bob").id;
    await commands(a, camp, [
      {
        type: "chat.send",
        payload: {
          clientMessageId: crypto.randomUUID(),
          body: "PRIVATE RECOVERY WHISPER",
          visibility: "whisper",
          recipientIds: [bob],
        },
      },
      {
        type: "dice.roll",
        payload: {
          clientRollId: crypto.randomUUID(),
          expression: "7d1+23",
          visibility: "selected",
          recipientIds: [bob],
        },
      },
    ]);
    expect(playerFrames.join(" ")).not.toContain("PRIVATE RECOVERY JOURNAL");
    expect(playerFrames.join(" ")).not.toContain("PRIVATE RECOVERY NOTES");
    const endpoints = ["scenes", "actors", "journals", "combat", "chat", "rolls"];
    const expected: unknown[][] = [];
    for (const p of [dm, a, b]) {
      const docs = [];
      for (const endpoint of endpoints)
        docs.push(await (await p.request.get(`/api/campaigns/${camp}/${endpoint}`)).json());
      expected.push(docs);
    }
    const oldCookies = (await ac.storageState()).cookies;
    const allWorlds = (await (await dm.request.get("/api/campaigns")).json()).campaigns;
    const artworkHashes = new Set<string>();
    let encounterCount = 0;
    for (const world of allWorlds) {
      const artwork = (await (await dm.request.get(`/api/campaigns/${world.id}/assets`)).json())
        .assets;
      for (const item of artwork) {
        const file = await dm.request.get(`/api/campaigns/${world.id}/assets/${item.id}`);
        expect(file.ok()).toBe(true);
        artworkHashes.add(
          createHash("sha256")
            .update(await file.body())
            .digest("hex"),
        );
      }
      if ((await (await dm.request.get(`/api/campaigns/${world.id}/combat`)).json()).encounter)
        encounterCount++;
    }
    await dm.getByRole("button", { name: "Backup & recovery", exact: true }).click();
    await dm.getByRole("button", { name: "Prepare host backup", exact: true }).click();
    const download = dm.waitForEvent("download");
    await dm.getByRole("link", { name: "Download backup", exact: true }).click();
    const artifact = await download;
    const archive = test.info().outputPath("complete.hearthbackup");
    await artifact.saveAs(archive);
    await dm.getByLabel("Backup file", { exact: true }).setInputFiles({
      name: "broken.hearthbackup",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("bad backup"),
    });
    await dm.getByRole("button", { name: "Verify backup", exact: true }).click();
    await expect(dm.getByRole("alert")).toContainText("invalid");
    await expect(
      dm.getByRole("button", { name: "Create recovery copy", exact: true }),
    ).toBeDisabled();
    await dm.getByLabel("Backup file", { exact: true }).setInputFiles(archive);
    await dm.getByRole("button", { name: "Verify backup", exact: true }).click();
    await expect(dm.getByRole("heading", { name: "Verified backup", exact: true })).toBeVisible();
    await dm.getByRole("button", { name: "Create recovery copy", exact: true }).click();
    await expect(
      dm.getByRole("heading", { name: "Recovery copy ready", exact: true }),
    ).toBeVisible();
    const recovery = await (await dm.request.get("/api/host/recovery")).json();
    const root = join(recovery.dataDirectory, "restores", recovery.lastRestore.directoryName);
    expect(recovery.lastRestore.summary.counts.assets).toBe(artworkHashes.size);
    expect(recovery.lastRestore.summary.counts.encounters).toBe(encounterCount);
    expect(recovery.lastRestore.summary.counts.campaigns).toBe(allWorlds.length);
    expect((await dm.request.get(`/api/campaigns/${camp}`)).ok()).toBe(true);
    await dm.screenshot({ path: test.info().outputPath("recovery-ready.png") });
    await Promise.all([dm.close(), a.close(), b.close()]);
    const baseURL = "http://127.0.0.1:8793";
    child = spawn(testHostExecutable(), [], {
      stdio: "ignore",
      env: {
        ...process.env,
        HEARTH_BIND: "127.0.0.1:8793",
        HEARTH_ORIGINS: baseURL,
        HEARTH_DATA_DIR: root,
        HEARTH_WEB_DIR: resolve("apps/web/dist"),
      },
    });
    let ready = false;
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw new Error("Recovered host exited");
      try {
        ready = (await fetch(`${baseURL}/api/health`)).ok;
        if (ready) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(ready).toBe(true);
    const old = await browser.newContext({
      baseURL,
      storageState: { cookies: oldCookies, origins: [] },
    });
    restoredContexts.push(old);
    expect((await old.request.get("/api/campaigns")).status()).toBe(401);
    await old.close();
    const recoveredPages: Page[] = [];
    for (const [n, user] of ["gamemaster", "backup_alice", "backup_bob"].entries()) {
      const context = await browser.newContext({ baseURL });
      restoredContexts.push(context);
      const p = await context.newPage();
      recoveredPages.push(p);
      p.on("pageerror", (e) => errors.push(e.message));
      await signIn(p, user, n === 0 ? "a long strong password" : "a long player password");
      await p.goto(`/campaign/${camp}`);
      await expect(p.getByTestId("connection-status")).toHaveText("Live");
      await expect(p.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
      for (const [i, endpoint] of endpoints.entries())
        expect(await (await p.request.get(`/api/campaigns/${camp}/${endpoint}`)).json()).toEqual(
          expected[n]?.[i],
        );
      if (n === 0) {
        expect((await (await p.request.get("/api/campaigns")).json()).campaigns).toEqual(allWorlds);
        expect((await p.request.get(`/api/campaigns/${camp}/assets/${art}`)).ok()).toBe(true);
      } else {
        expect((await p.request.get(`/api/campaigns/${camp}/assets/${art}`)).status()).toBe(404);
        expect((await p.request.get("/api/host/recovery")).status()).toBe(403);
      }
      await p.getByRole("tab", { name: "Combat", exact: true }).click();
      await expect(p.getByTestId("combatant")).toHaveCount(n === 0 ? 3 : 2);
      await p.getByRole("tab", { name: "Journal", exact: true }).click();
      await expect(p.getByRole("button", { name: "Recovery secret", exact: true })).toHaveCount(
        n === 0 ? 1 : 0,
      );
    }
    const recoveredAlice = recoveredPages[1],
      recoveredBob = recoveredPages[2];
    if (!recoveredAlice || !recoveredBob) throw new Error("Recovered players missing");
    await recoveredAlice.getByRole("tab", { name: "Combat", exact: true }).click();
    await recoveredBob.getByRole("tab", { name: "Combat", exact: true }).click();
    await recoveredAlice.getByLabel("HP for Rowan · Warden", { exact: true }).fill("15");
    await recoveredAlice
      .getByRole("button", { name: "Save HP for Rowan · Warden", exact: true })
      .click();
    await expect(
      recoveredBob.getByTestId("combatant").filter({ hasText: "Rowan · Warden" }),
    ).toContainText("15 / 20");
    const originalCombat = (await (await owner.request.get(`/api/campaigns/${camp}/combat`)).json())
      .encounter;
    expect(
      originalCombat.combatants.find((c: { name: string }) => c.name.startsWith("Rowan")).hp,
    ).toBe(18);
    expect(errors).toEqual([]);
  } finally {
    for (const c of restoredContexts) await c.close();
    if (child) await stop(child);
    await owner.close();
    await ac.close();
    await bc.close();
  }
});
