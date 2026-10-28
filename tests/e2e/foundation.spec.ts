import { expect, type Page, test } from "@playwright/test";
import { isolatedTest as it } from "./isolatedHost";

test("owner and two isolated players use the real host with private projections", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const dm = await ownerContext.newPage();
  const errors: string[] = [];
  dm.on("pageerror", (error) => errors.push(error.message));
  await dm.goto("/");
  await dm.getByLabel("Username", { exact: false }).fill("gamemaster");
  await dm.getByLabel("Display name").fill("Dominik");
  await dm.getByLabel("Password", { exact: false }).fill("a long strong password");
  await dm.getByRole("button", { name: "Create my Hearth" }).click();
  await expect(dm.getByRole("heading", { name: "Your campaigns." })).toBeVisible();
  await dm.screenshot({ path: test.info().outputPath("library.png"), fullPage: true });
  await dm.getByRole("link", { name: "Explore the sample" }).click();
  await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
  await dm.getByRole("tab", { name: "Journal", exact: true }).click();
  await expect(dm.getByRole("button", { name: "DM · Beneath the keep" })).toBeVisible();
  await dm.screenshot({ path: test.info().outputPath("table.png"), fullPage: true });
  const id = new URL(dm.url()).pathname.split("/").pop();
  const privateScene = await (await dm.request.get(`/api/campaigns/${id}/scenes`)).json();
  expect(privateScene.scenes[0].tokens).toHaveLength(3);

  async function invitation() {
    await dm.getByRole("button", { name: "Invite players", exact: true }).click();
    await dm.getByRole("button", { name: "Create invitation", exact: true }).click();
    const link = await dm.getByLabel("Invitation link").inputValue();
    await dm.getByRole("button", { name: "Close dialog" }).click();
    return link;
  }
  async function join(page: Page, link: string, name: string) {
    await page.goto(link);
    await page.getByLabel("Username", { exact: false }).fill(name.toLowerCase());
    await page.getByLabel("Display name").fill(name);
    await page.getByLabel("Password", { exact: false }).fill("a long player password");
    await page.getByRole("button", { name: "Join the adventure" }).click();
    await expect(page.locator(".table-title strong")).toHaveText("The Amber Keep");
    await page.getByRole("tab", { name: "Journal", exact: true }).click();
    await expect(page.getByRole("button", { name: "Invite players", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "DM · Beneath the keep" })).toHaveCount(0);
    const scenes = await (await page.request.get(`/api/campaigns/${id}/scenes`)).json();
    expect(scenes.scenes[0].tokens).toHaveLength(2);
    expect(JSON.stringify(scenes)).not.toContain("sentinel");
    const journals = await (await page.request.get(`/api/campaigns/${id}/journals`)).json();
    expect(journals.journals).toHaveLength(1);
    expect(JSON.stringify(journals)).not.toContain("clapper");
    expect((await page.request.get(`/api/campaigns/${id}/assets/vault-sentinel`)).status()).toBe(
      404,
    );
  }
  const received: string[] = [];
  const alice = await aliceContext.newPage();
  alice.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => received.push(String(frame.payload))),
  );
  const bob = await bobContext.newPage();
  await join(alice, await invitation(), "Alice");
  await join(bob, await invitation(), "Bob");
  // A failed map/token download recovers on a fresh connection without a reload.
  const failedAssets = new Set<string>();
  const recoveredAssets = new Set<string>();
  await alice.route("**/api/campaigns/*/assets/*", (route) => {
    const asset = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    if (["amber-map", "token-warden"].includes(asset) && !failedAssets.has(asset)) {
      failedAssets.add(asset);
      return route.abort();
    }
    recoveredAssets.add(asset);
    return route.continue();
  });
  await alice.reload();
  await expect(alice.getByRole("button", { name: "Retry artwork" })).toBeVisible();
  await aliceContext.setOffline(true);
  await expect(alice.getByTestId("connection-status")).toHaveText("Reconnecting");
  await aliceContext.setOffline(false);
  await expect(alice.getByTestId("connection-status")).toHaveText("Live");
  await expect(alice.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
  await expect(alice.getByRole("button", { name: "Retry artwork" })).toHaveCount(0);
  expect(recoveredAssets.has("amber-map")).toBe(true);
  expect(recoveredAssets.has("token-warden")).toBe(true);
  await alice.unroute("**/api/campaigns/*/assets/*");
  // Real browser movement, authorization, visibility and reconnection.
  for (const page of [dm, alice, bob]) {
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.getByTestId("connection-status")).toHaveText("Live");
    await page.getByRole("tab", { name: "Scene", exact: true }).click();
    await page.getByRole("button", { name: "Rowan · Warden", exact: true }).click();
  }
  await expect(bob.getByRole("button", { name: "Move token", exact: true })).toHaveCount(0);
  await dm.getByLabel("Controlled by").selectOption({ label: "Alice" });
  await expect(alice.getByRole("button", { name: "Move token", exact: true })).toBeEnabled();
  await alice.getByLabel("Token X").fill("630");
  await alice.getByLabel("Token Y").fill("690");
  await alice.getByRole("button", { name: "Move token", exact: true }).click();
  for (const page of [dm, alice, bob])
    await expect(page.getByTestId("token-position")).toHaveText("630, 690");
  await expect(alice.getByRole("button", { name: "Move token", exact: true })).toBeEnabled();
  await alice.locator("canvas").focus();
  await alice.keyboard.press("ArrowRight");
  await expect(dm.getByTestId("token-position")).toHaveText("690, 690");
  await expect(alice.getByRole("button", { name: "Move token", exact: true })).toBeEnabled();
  const bounds = await alice.locator("canvas").boundingBox();
  if (!bounds) throw new Error("Canvas has no bounds");
  const scale = Math.min(bounds.width / 1440, bounds.height / 960) * 0.92;
  const cx = bounds.x + (bounds.width - 1440 * scale) / 2;
  const cy = bounds.y + (bounds.height - 960 * scale) / 2;
  await alice.mouse.move(cx + 690 * scale, cy + 690 * scale);
  await alice.mouse.down();
  await alice.mouse.move(cx + 810 * scale, cy + 690 * scale, { steps: 6 });
  await alice.mouse.up();
  for (const page of [dm, alice, bob])
    await expect(page.getByTestId("token-position")).toHaveText("810, 690");
  await alice.getByRole("button", { name: "Zoom in", exact: true }).click();
  const camera = await alice.locator(".scene-viewport").getAttribute("data-zoom");
  const originalCanvas = await alice.locator("canvas").evaluate((canvas) => {
    canvas.dataset.survives = "yes";
    return true;
  });
  expect(originalCanvas).toBe(true);
  await aliceContext.setOffline(true);
  await expect(alice.getByTestId("connection-status")).toHaveText("Reconnecting");
  await dm.getByLabel("Token X").fill("750");
  await dm.getByRole("button", { name: "Move token", exact: true }).click();
  await expect(dm.getByTestId("token-position")).toHaveText("750, 690");
  await aliceContext.setOffline(false);
  await expect(alice.getByTestId("connection-status")).toHaveText("Live");
  await expect(alice.getByTestId("token-position")).toHaveText("750, 690");
  await expect(alice.locator("canvas")).toHaveAttribute("data-survives", "yes");
  await expect(alice.locator(".scene-viewport")).toHaveAttribute("data-zoom", camera ?? "");
  await dm.getByLabel("Token visibility").selectOption("dm");
  await expect(alice.getByRole("button", { name: "Rowan · Warden", exact: true })).toHaveCount(0);
  await expect(bob.getByRole("button", { name: "Rowan · Warden", exact: true })).toHaveCount(0);
  await dm.getByLabel("Token visibility").selectOption("shared");
  await expect(alice.getByRole("button", { name: "Rowan · Warden", exact: true })).toBeVisible();
  await alice.reload();
  await expect(alice.getByTestId("connection-status")).toHaveText("Live");
  await alice.getByRole("tab", { name: "Scene", exact: true }).click();
  await alice.getByRole("button", { name: "Rowan · Warden", exact: true }).click();
  await expect(alice.getByTestId("token-position")).toHaveText("750, 690");
  await dm.getByRole("tab", { name: "People" }).click();
  await expect(dm.locator(".member-entry").filter({ hasText: "Bob" })).toBeVisible();
  const bobEntry = dm.locator(".member-entry").filter({ hasText: "Bob" });
  await bobEntry.getByRole("button", { name: "Revoke access" }).click();
  await bobEntry.locator(".revoke-confirm").getByRole("button", { name: "Revoke access" }).click();
  await expect(bob.getByRole("alert")).toContainText("unavailable");
  await dm.getByRole("link", { name: "Campaign library" }).click();
  await dm.getByRole("button", { name: "New campaign", exact: true }).click();
  await dm.getByLabel("Campaign name").fill("Žilina — Čierna veža");
  await dm.getByLabel("Description", { exact: true }).fill("An original adventure.");
  await dm.getByRole("button", { name: "Create campaign", exact: true }).click();
  await expect(dm.getByRole("heading", { name: "Žilina — Čierna veža" })).toBeVisible();
  await dm.getByRole("button", { name: "Campaign settings: Žilina — Čierna veža" }).click();
  await dm.getByLabel("Archived", { exact: true }).check();
  await dm.getByRole("button", { name: "Save changes" }).click();
  await expect(dm.getByRole("heading", { name: "Žilina — Čierna veža" })).toHaveCount(0);
  await dm.getByRole("button", { name: "Archived", exact: true }).click();
  await expect(dm.getByRole("heading", { name: "Žilina — Čierna veža" })).toBeVisible();
  await dm.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(dm.getByRole("heading", { name: "Welcome back, storyteller." })).toBeVisible();
  await dm.getByLabel("Username", { exact: false }).fill("gamemaster");
  await dm.getByLabel("Password", { exact: false }).fill("a long strong password");
  await dm.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dm.getByRole("heading", { name: "Your campaigns." })).toBeVisible();
  expect(errors).toEqual([]);
  // Cookie identity can change in another tab while this tab retains a DM projection.
  await dm.getByRole("link", { name: "Explore the sample" }).click();
  await dm.getByRole("tab", { name: "Journal", exact: true }).click();
  await expect(dm.getByRole("button", { name: "DM · Beneath the keep" })).toBeVisible();
  const switcher = await ownerContext.newPage();
  await switcher.goto("/");
  await switcher.getByRole("button", { name: "Sign out", exact: true }).click();
  await switcher.getByLabel("Username", { exact: false }).fill("alice");
  await switcher.getByLabel("Password", { exact: false }).fill("a long player password");
  await switcher.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(switcher.getByRole("heading", { name: "Your campaigns." })).toBeVisible();
  await expect(dm.getByRole("button", { name: "DM · Beneath the keep" })).toHaveCount(0);
  await expect(dm.locator(".table-header .role-badge")).toHaveText("Player");
  await dm.getByRole("tab", { name: "Journal", exact: true }).click();
  await expect(dm.getByRole("button", { name: "DM · Beneath the keep" })).toHaveCount(0);
  await expect(dm.getByRole("button", { name: "A letter from the watch" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(received.join(" ")).not.toContain("vault-sentinel");
  expect(received.join(" ")).not.toContain("clapper");
  await ownerContext.close();
  // The DM browser is closed; the independent host still accepts player movement.
  await alice.getByLabel("Token X").fill("990");
  await alice.getByRole("button", { name: "Move token", exact: true }).click();
  await expect(alice.getByTestId("token-position")).toHaveText("990, 690");
  expect(errors).toEqual([]);
  await aliceContext.close();
  await bobContext.close();
});

test("DM authors a private custom map and publishes only the active scene", async ({ browser }) => {
  const owner = await browser.newContext();
  const player = await browser.newContext();
  const dm = await owner.newPage();
  const alice = await player.newPage();
  const errors: string[] = [];
  const received: string[] = [];
  for (const page of [dm, alice]) page.on("pageerror", (error) => errors.push(error.message));
  alice.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => received.push(String(frame.payload))),
  );
  async function login(page: Page, username: string, password: string) {
    await page.goto("/");
    await page.getByLabel("Username", { exact: false }).fill(username);
    await page.getByLabel("Password", { exact: false }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your campaigns." })).toBeVisible();
  }
  await login(dm, "gamemaster", "a long strong password");
  await login(alice, "alice", "a long player password");
  await dm.getByRole("link", { name: "Explore the sample" }).click();
  const campaignPath = new URL(dm.url()).pathname;
  await alice.goto(campaignPath);
  await expect(alice.getByTestId("connection-status")).toHaveText("Live");
  await dm.getByRole("button", { name: "New scene", exact: true }).click();
  await dm.getByLabel("Scene name", { exact: true }).fill("Private cavern");
  await dm
    .getByLabel("Map image", { exact: true })
    .setInputFiles("content/examples/amber-keep/map.png");
  await expect(dm.getByText("1440 × 960 px", { exact: true })).toBeVisible();
  await dm.getByRole("button", { name: "Create scene", exact: true }).click();
  await expect(dm.locator(".table-title")).toContainText("Private cavern");
  expect(received.join(" ")).not.toContain("Private cavern");
  await expect(alice.locator(".table-title")).toContainText("The Old Watchtower");
  await dm.getByRole("button", { name: "Add token", exact: true }).click();
  await dm.getByLabel("Token name", { exact: true }).fill("Cave guardian");
  await dm.getByLabel("Token X", { exact: true }).fill("150");
  await dm.getByLabel("Token Y", { exact: true }).fill("150");
  await dm
    .getByRole("dialog")
    .getByLabel("Token visibility", { exact: true })
    .selectOption("shared");
  await dm.getByRole("button", { name: "Place token", exact: true }).click();
  await expect(dm.getByRole("button", { name: "Cave guardian", exact: true })).toBeVisible();
  await dm.getByLabel("Controlled by").selectOption({ label: "Alice" });
  await expect(dm.getByRole("button", { name: "Edit token", exact: true })).toBeEnabled();
  await dm.getByRole("button", { name: "Edit token", exact: true }).click();
  await dm.getByLabel("Token name", { exact: true }).fill("Stone guardian");
  await dm.getByLabel("Token art", { exact: true }).selectOption("token-scout");
  await dm.getByLabel("Token size", { exact: true }).fill("60");
  await dm.getByRole("button", { name: "Save token", exact: true }).click();
  await expect(dm.getByRole("button", { name: "Stone guardian", exact: true })).toBeVisible();
  expect(received.join(" ")).not.toContain("Stone guardian");
  await dm.getByRole("button", { name: "Show scene to players", exact: true }).click();
  await expect(alice.locator(".table-title")).toContainText("Private cavern");
  await expect(alice.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
  await alice.getByRole("tab", { name: "Scene", exact: true }).click();
  await alice.getByRole("button", { name: "Stone guardian", exact: true }).click();
  await alice.getByLabel("Token X", { exact: true }).fill("210");
  await alice.getByRole("button", { name: "Move token", exact: true }).click();
  await expect(dm.getByTestId("token-position")).toHaveText("210, 150");
  const scenes = await (
    await dm.request.get(`/api/campaigns/${campaignPath.split("/").pop()}/scenes`)
  ).json();
  const custom = scenes.scenes.find((scene: { name: string }) => scene.name === "Private cavern");
  await dm.screenshot({ path: test.info().outputPath("custom-table.png"), fullPage: true });
  await dm.getByRole("tab", { name: "Scene", exact: true }).click();
  await dm
    .getByLabel("Prepared scene", { exact: true })
    .selectOption({ label: "The Old Watchtower" });
  await expect(alice.locator(".table-title")).toContainText("Private cavern");
  await dm.getByRole("tab", { name: "Scene", exact: true }).click();
  await dm.getByLabel("Prepared scene", { exact: true }).selectOption({ label: "Private cavern" });
  await dm.getByRole("button", { name: "Take scene private", exact: true }).click();
  await expect(alice.locator("canvas")).toHaveCount(0);
  await expect(
    alice.getByText("Your DM is preparing the next scene.", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await alice.request.get(
        `/api/campaigns/${campaignPath.split("/").pop()}/assets/${custom.backgroundAssetId}`,
      )
    ).status(),
  ).toBe(404);
  await alice.reload();
  await expect(alice.getByTestId("connection-status")).toHaveText("Live");
  await expect(alice.locator("canvas")).toHaveCount(0);
  await dm.getByRole("button", { name: "Stone guardian", exact: true }).click();
  await dm.getByRole("button", { name: "Delete token", exact: true }).click();
  await dm.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(dm.getByRole("button", { name: "Stone guardian", exact: true })).toHaveCount(0);
  await dm.getByRole("tab", { name: "Scene", exact: true }).click();
  await dm
    .getByLabel("Prepared scene", { exact: true })
    .selectOption({ label: "The Old Watchtower" });
  await dm.getByRole("button", { name: "Show scene to players", exact: true }).click();
  await expect(alice.locator(".table-title")).toContainText("The Old Watchtower");
  expect(errors).toEqual([]);
  await owner.close();
  await player.close();
});

test("leaving the table during an unacknowledged drag releases the renderer safely", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  let held = false;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.routeWebSocket("**/api/campaigns/*/ws", (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message));
      if (frame.kind === "ack") held = true;
      else socket.send(message);
    });
  });
  await page.goto("/");
  await page.getByLabel("Username", { exact: false }).fill("alice");
  await page.getByLabel("Password", { exact: false }).fill("a long player password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Explore the sample" }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
  await expect(page.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
  const id = new URL(page.url()).pathname.split("/").pop();
  const data = await (await page.request.get(`/api/campaigns/${id}/scenes`)).json();
  const scene = data.scenes[0];
  const token = scene.tokens.find((item: { canMove: boolean }) => item.canMove);
  if (!token) throw new Error("Player needs an assigned token");
  const bounds = await page.locator("canvas").boundingBox();
  if (!bounds) throw new Error("Canvas needs bounds");
  const scale = Math.min(bounds.width / scene.width, bounds.height / scene.height) * 0.92;
  const x = bounds.x + (bounds.width - scene.width * scale) / 2 + token.x * scale;
  const y = bounds.y + (bounds.height - scene.height * scale) / 2 + token.y * scale;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + scene.gridSize * scale, y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => held).toBe(true);
  await page.getByRole("link", { name: "Campaign library" }).click();
  await expect(page.getByRole("heading", { name: "Your campaigns." })).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  expect(errors).toEqual([]);
  await context.close();
});

async function actorStageOwner(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: false }).fill("gamemaster");
  await page.getByLabel("Password", { exact: false }).fill("a long strong password");
  if (await page.getByLabel("Display name").count()) {
    await page.getByLabel("Display name").fill("Dominik");
    await page.getByRole("button", { name: "Create my Hearth", exact: true }).click();
  } else await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your campaigns." })).toBeVisible();
  await page.getByRole("link", { name: "Explore the sample" }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Live");
}
it("character sheets and linked ownership converge without private notes or stale overwrites", async ({
  browser,
  isolatedHostURL,
}) => {
  test.setTimeout(180000);
  const owner = await browser.newContext({ baseURL: isolatedHostURL });
  const player = await browser.newContext({ baseURL: isolatedHostURL });
  const observer = await browser.newContext({ baseURL: isolatedHostURL });
  const dm = await owner.newPage();
  const lia = await player.newPage();
  const kai = await observer.newPage();
  const errors: string[] = [];
  const received: string[] = [];
  for (const p of [dm, lia, kai]) p.on("pageerror", (e) => errors.push(e.message));
  lia.on("websocket", (s) => s.on("framereceived", (f) => received.push(String(f.payload))));
  await actorStageOwner(dm);
  const id = new URL(dm.url()).pathname.split("/").pop();
  async function join(page: Page, user: string, display: string) {
    await dm.getByRole("button", { name: "Invite players", exact: true }).click();
    await dm.getByRole("button", { name: "Create invitation", exact: true }).click();
    const link = await dm.getByLabel("Invitation link").inputValue();
    await dm.getByRole("button", { name: "Close dialog" }).click();
    await page.goto(link);
    await page.getByLabel("Username", { exact: false }).fill(user);
    await page.getByLabel("Display name").fill(display);
    await page.getByLabel("Password", { exact: false }).fill("a long player password");
    await page.getByRole("button", { name: "Join the adventure" }).click();
    await expect(page.getByTestId("connection-status")).toHaveText("Live");
  }
  await join(lia, "lia_actor", "Lia");
  await join(kai, "kai_actor", "Kai");
  await dm.getByRole("tab", { name: "Characters", exact: true }).click();
  await dm.getByRole("button", { name: "New actor", exact: true }).click();
  await dm.getByLabel("Actor name", { exact: true }).fill("Mira the scholar");
  await dm.getByLabel("Biography", { exact: true }).fill("A wandering scholar.");
  await dm.getByLabel("DM notes", { exact: true }).fill("SECRET SHEET NOTES");
  await dm
    .getByLabel("Portrait upload", { exact: true })
    .setInputFiles("content/examples/amber-keep/scout.png");
  await expect(dm.getByText("Portrait uploaded", { exact: true })).toBeVisible();
  await dm.getByRole("button", { name: "Add property", exact: true }).click();
  await dm.getByLabel("Property name 1", { exact: true }).fill("Strength");
  await dm.getByLabel("Property value 1", { exact: true }).fill("14");
  await dm.getByRole("button", { name: "Create actor", exact: true }).click();
  await expect(dm.getByRole("heading", { name: "Mira the scholar", exact: true })).toBeVisible();
  await lia.getByRole("tab", { name: "Characters", exact: true }).click();
  await expect(lia.getByRole("heading", { name: "Mira the scholar" })).toHaveCount(0);
  await dm.getByLabel("Permission for Lia", { exact: true }).selectOption("owner");
  await expect(lia.getByRole("heading", { name: "Mira the scholar" })).toBeVisible();
  await dm.getByLabel("Permission for Kai", { exact: true }).selectOption("observer");
  await kai.getByRole("tab", { name: "Characters", exact: true }).click();
  await expect(kai.getByRole("heading", { name: "Mira the scholar" })).toBeVisible();
  await expect(kai.getByRole("button", { name: "Edit sheet", exact: true })).toHaveCount(0);
  await dm.getByRole("tab", { name: "Scene", exact: true }).click();
  await dm.getByRole("button", { name: "Rowan · Warden", exact: true }).click();
  await dm.getByLabel("Linked actor", { exact: true }).selectOption({ label: "Mira the scholar" });
  await lia.getByRole("tab", { name: "Scene", exact: true }).click();
  await lia.getByRole("button", { name: "Rowan · Warden", exact: true }).click();
  await expect(lia.getByLabel("Token X", { exact: true })).toBeEnabled();
  await lia.getByLabel("Token X", { exact: true }).fill("450");
  await lia.getByRole("button", { name: "Move token", exact: true }).click();
  await expect(dm.getByTestId("token-position")).toContainText("450");
  await lia.getByRole("tab", { name: "Characters", exact: true }).click();
  await lia.getByRole("button", { name: "Edit sheet", exact: true }).click();
  await lia.getByRole("dialog").getByLabel("Current HP", { exact: true }).fill("7");
  await expect(lia.getByLabel("DM notes", { exact: true })).toHaveCount(0);
  await dm.getByRole("tab", { name: "Characters", exact: true }).click();
  await dm.getByRole("button", { name: "Edit sheet", exact: true }).click();
  await dm.getByRole("dialog").getByLabel("Current HP", { exact: true }).fill("9");
  await dm.getByRole("button", { name: "Save sheet", exact: true }).click();
  await expect(kai.getByTestId("actor-hp")).toHaveText("9 / 20");
  await lia.getByRole("button", { name: "Save sheet", exact: true }).click();
  await expect(lia.getByRole("dialog").getByRole("alert")).toHaveText(
    "This sheet changed. Reload the latest sheet before saving.",
  );
  await lia.getByRole("button", { name: "Reload latest sheet", exact: true }).click();
  await expect(lia.getByRole("dialog").getByLabel("Current HP", { exact: true })).toHaveValue("9");
  await lia.getByRole("dialog").getByLabel("Current HP", { exact: true }).fill("7");
  await lia.getByRole("button", { name: "Save sheet", exact: true }).click();
  await expect(dm.getByTestId("actor-hp")).toHaveText("7 / 20");
  await dm.getByLabel("Permission for Lia", { exact: true }).selectOption("none");
  await expect(lia.getByRole("heading", { name: "Mira the scholar" })).toHaveCount(0);
  expect((await (await lia.request.get(`/api/campaigns/${id}/actors`)).json()).actors).toHaveLength(
    0,
  );
  expect(received.join(" ")).not.toContain("SECRET SHEET NOTES");
  await dm.screenshot({ path: test.info().outputPath("actor-sheet.png"), fullPage: true });
  await dm.getByRole("button", { name: "Delete actor", exact: true }).click();
  await dm.getByRole("button", { name: "Confirm actor deletion", exact: true }).click();
  await expect(kai.getByRole("heading", { name: "Mira the scholar" })).toHaveCount(0);
  await observer.close();
  await dm.getByRole("button", { name: "New scene", exact: true }).click();
  await dm.getByLabel("Scene name", { exact: true }).fill("Disposable draft");
  await dm.getByLabel("Use existing artwork", { exact: true }).selectOption("amber-map");
  await dm.getByRole("button", { name: "Create scene", exact: true }).click();
  await expect(dm.locator(".table-title")).toContainText("Disposable draft");
  await dm.getByRole("button", { name: "Rename scene", exact: true }).click();
  await dm.getByLabel("Scene name", { exact: true }).fill("A temporary table");
  await dm.getByRole("button", { name: "Save scene name", exact: true }).click();
  await expect(dm.getByRole("dialog")).toHaveCount(0);
  await expect(dm.locator(".table-title")).toContainText("A temporary table");
  await dm.getByRole("button", { name: "Show scene to players", exact: true }).click();
  await expect(lia.locator(".table-title")).toContainText("A temporary table");
  await dm.getByRole("button", { name: "Delete scene", exact: true }).click();
  await dm.getByRole("button", { name: "Confirm scene deletion", exact: true }).click();
  await expect(
    lia.getByRole("heading", { name: "Your DM is preparing the next scene." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await owner.close();
  await player.close();
});
it("a stale scene rename cannot overwrite another DM tab", async ({ browser, isolatedHostURL }) => {
  const c = await browser.newContext({ baseURL: isolatedHostURL });
  const a = await c.newPage();
  await actorStageOwner(a);
  const path = new URL(a.url()).pathname;
  await a.getByRole("tab", { name: "Scene", exact: true }).click();
  const scene = await a.getByLabel("Prepared scene", { exact: true }).inputValue();
  const b = await c.newPage();
  await b.goto(path);
  await expect(b.getByTestId("connection-status")).toHaveText("Live");
  await b.getByRole("tab", { name: "Scene", exact: true }).click();
  await b.getByLabel("Prepared scene", { exact: true }).selectOption(scene);
  for (const p of [a, b]) await p.getByRole("tab", { name: "Scene", exact: true }).click();
  await a.getByRole("button", { name: "Rename scene", exact: true }).click();
  await a.getByLabel("Scene name", { exact: true }).fill("Older form value");
  await b.getByRole("button", { name: "Rename scene", exact: true }).click();
  await b.getByLabel("Scene name", { exact: true }).fill("Newer accepted name");
  await b.getByRole("button", { name: "Save scene name", exact: true }).click();
  await expect(b.getByRole("dialog")).toHaveCount(0);
  await expect(a.locator(".table-title")).toContainText("Newer accepted name");
  await a.getByRole("button", { name: "Save scene name", exact: true }).click();
  await expect(a.getByRole("dialog").getByRole("alert")).toHaveText(
    "This scene name changed. Reload the latest name before saving.",
  );
  await expect(b.locator(".table-title")).toContainText("Newer accepted name");
  await a.getByRole("button", { name: "Reload latest scene name", exact: true }).click();
  await expect(a.getByLabel("Scene name", { exact: true })).toHaveValue("Newer accepted name");
  await a.getByLabel("Scene name", { exact: true }).fill("Reviewed scene name");
  await a.getByRole("button", { name: "Save scene name", exact: true }).click();
  await expect(b.locator(".table-title")).toContainText("Reviewed scene name");
  await c.close();
});

it("manual fog covers players, reveals one rectangle live and survives reconnect", async ({
  browser,
  isolatedHostURL,
}) => {
  const owner = await browser.newContext({ baseURL: isolatedHostURL }),
    ac = await browser.newContext({ baseURL: isolatedHostURL }),
    bc = await browser.newContext({ baseURL: isolatedHostURL });
  const dm = await owner.newPage(),
    a = await ac.newPage(),
    b = await bc.newPage();
  const errors: string[] = [],
    received: string[] = [];
  for (const p of [dm, a, b]) p.on("pageerror", (e) => errors.push(e.message));
  a.on("websocket", (s) => s.on("framereceived", (f) => received.push(String(f.payload))));
  await actorStageOwner(dm);
  const path = new URL(dm.url()).pathname,
    id = path.split("/").pop();
  for (const [p, user] of [
    [a, "fog_alice"],
    [b, "fog_bob"],
  ] as const) {
    await dm.getByRole("button", { name: "Invite players", exact: true }).click();
    await dm.getByRole("button", { name: "Create invitation", exact: true }).click();
    const link = await dm.getByLabel("Invitation link").inputValue();
    await dm.getByRole("button", { name: "Close dialog" }).click();
    await p.goto(link);
    await p.getByLabel("Username", { exact: false }).fill(user);
    await p.getByLabel("Display name").fill(user);
    await p.getByLabel("Password", { exact: false }).fill("a long player password");
    await p.getByRole("button", { name: "Join the adventure" }).click();
    await expect(p.getByTestId("connection-status")).toHaveText("Live");
  }
  await dm.getByRole("button", { name: "New scene", exact: true }).click();
  await dm.getByLabel("Scene name", { exact: true }).fill("Fog laboratory");
  await dm.getByLabel("Use existing artwork", { exact: true }).selectOption("amber-map");
  await dm.getByRole("button", { name: "Create scene", exact: true }).click();
  await expect(dm.locator(".table-title")).toContainText("Fog laboratory");
  await dm.getByRole("tab", { name: "Scene", exact: true }).click();
  await dm.getByRole("button", { name: "Enable fog", exact: true }).click();
  await expect(dm.getByRole("button", { name: "Disable fog", exact: true })).toBeEnabled();
  await dm.getByRole("button", { name: "Add token", exact: true }).click();
  await dm.getByLabel("Token name", { exact: true }).fill("Fog ambush secret");
  await dm.getByLabel("Token X", { exact: true }).fill("90");
  await dm.getByLabel("Token Y", { exact: true }).fill("90");
  await dm.getByLabel("Token art", { exact: true }).selectOption("vault-sentinel");
  await dm
    .getByRole("dialog")
    .getByLabel("Token visibility", { exact: true })
    .selectOption("shared");
  await dm.getByRole("button", { name: "Place token", exact: true }).click();
  await dm.getByRole("button", { name: "Edit token", exact: true }).click();
  await dm.getByLabel("Token name", { exact: true }).fill("Lantern guard");
  await dm.getByRole("button", { name: "Save token", exact: true }).click();
  await expect(dm.getByRole("dialog")).toHaveCount(0);
  await dm.getByRole("button", { name: "Show scene to players", exact: true }).click();
  for (const p of [a, b]) {
    await expect(p.locator(".table-title")).toContainText("Fog laboratory");
    await expect(p.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
    await p.getByRole("tab", { name: "Scene", exact: true }).click();
    await expect(p.getByRole("button", { name: "Lantern guard", exact: true })).toHaveCount(0);
    await expect(p.getByRole("button", { name: "Reveal all", exact: true })).toHaveCount(0);
    expect((await p.request.get(`/api/campaigns/${id}/assets/vault-sentinel`)).status()).toBe(404);
  }
  await a.screenshot({ path: test.info().outputPath("fog-covered-player.png"), fullPage: true });
  await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
  const canvas = dm.locator(".pixi-host canvas"),
    original = await canvas.elementHandle();
  await dm.getByRole("button", { name: "Reveal rectangle", exact: true }).click();
  await expect(dm.getByRole("button", { name: "Reveal rectangle", exact: true })).toBeEnabled();
  await expect(a.getByRole("button", { name: "Lantern guard", exact: true })).toHaveCount(0);
  await dm.getByRole("button", { name: "Close Token inspector", exact: true }).click();
  await dm.getByRole("button", { name: "Fit scene", exact: true }).click();
  await dm.getByRole("button", { name: "Reveal area", exact: true }).click();
  const bounds = await canvas.boundingBox();
  expect(bounds).toBeTruthy();
  if (!bounds) throw Error("Canvas missing");
  const scale = Math.min(bounds.width / 1440, bounds.height / 960) * 0.92;
  const wx = bounds.x + (bounds.width - 1440 * scale) / 2,
    wy = bounds.y + (bounds.height - 960 * scale) / 2;
  await dm.mouse.move(wx + 61 * scale, wy + 61 * scale);
  await dm.mouse.down();
  await dm.mouse.move(wx + 179 * scale, wy + 179 * scale, { steps: 5 });
  await dm.mouse.up();
  for (const p of [a, b])
    await expect(p.getByRole("button", { name: "Lantern guard", exact: true })).toBeVisible();
  expect(await original?.evaluate((el) => el === document.querySelector(".pixi-host canvas"))).toBe(
    true,
  );
  await expect(dm.getByRole("button", { name: "Cover all", exact: true })).toBeEnabled();
  await dm.getByRole("button", { name: "Zoom in", exact: true }).click();
  const zoom = await dm.locator(".scene-viewport").getAttribute("data-zoom");
  expect((await a.request.get(`/api/campaigns/${id}/assets/vault-sentinel`)).status()).toBe(200);
  await dm.screenshot({ path: test.info().outputPath("fog-dm-revealed.png"), fullPage: true });
  await ac.setOffline(true);
  await expect(a.getByTestId("connection-status")).not.toHaveText("Live");
  await ac.setOffline(false);
  await expect(a.getByTestId("connection-status")).toHaveText("Live");
  await expect(a.getByRole("button", { name: "Lantern guard", exact: true })).toBeVisible();
  await dm.getByRole("button", { name: "Cover all", exact: true }).click();
  for (const p of [a, b])
    await expect(p.getByRole("button", { name: "Lantern guard", exact: true })).toHaveCount(0);
  await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-zoom", zoom ?? "");
  expect(await original?.evaluate((el) => el === document.querySelector(".pixi-host canvas"))).toBe(
    true,
  );
  expect((await a.request.get(`/api/campaigns/${id}/assets/vault-sentinel`)).status()).toBe(404);
  await a.reload();
  await expect(a.getByTestId("connection-status")).toHaveText("Live");
  await a.getByRole("tab", { name: "Scene", exact: true }).click();
  await expect(a.getByRole("button", { name: "Lantern guard", exact: true })).toHaveCount(0);
  const fallback = await ac.newPage();
  fallback.on("pageerror", (e) => errors.push(e.message));
  // Pixi can recover from unavailable WebGL via another renderer. Deny backend
  // module loading to exercise the actual initialization-failure fallback.
  await fallback.route("**/assets/*Renderer-*.js", (route) => route.abort());
  await fallback.goto(path);
  await expect(fallback.locator(".canvas-fallback")).toContainText("Fog is enabled");
  await expect(fallback.locator(".canvas-fallback img")).toHaveCount(0);
  expect(received.join(" ")).not.toContain("Fog ambush secret");
  expect(errors).toEqual([]);
  await owner.close();
  await ac.close();
  await bc.close();
});

it("server dice keep public private self and blind history separate", async ({
  browser,
  isolatedHostURL,
}) => {
  const owner = await browser.newContext({ baseURL: isolatedHostURL }),
    ac = await browser.newContext({ baseURL: isolatedHostURL }),
    bc = await browser.newContext({ baseURL: isolatedHostURL });
  const dm = await owner.newPage(),
    a = await ac.newPage(),
    b = await bc.newPage();
  const errors: string[] = [],
    af: string[] = [],
    bf: string[] = [],
    df: string[] = [];
  for (const p of [dm, a, b]) p.on("pageerror", (e) => errors.push(e.message));
  for (const [p, frames] of [
    [dm, df],
    [a, af],
    [b, bf],
  ] as const)
    p.on("websocket", (s) => s.on("framereceived", (f) => frames.push(String(f.payload))));
  await actorStageOwner(dm);
  const path = new URL(dm.url()).pathname,
    id = path.split("/").pop();
  for (const [p, user] of [
    [a, "dice_alice"],
    [b, "dice_bob"],
  ] as const) {
    await dm.getByRole("button", { name: "Invite players", exact: true }).click();
    await dm.getByRole("button", { name: "Create invitation", exact: true }).click();
    const link = await dm.getByLabel("Invitation link").inputValue();
    await dm.getByRole("button", { name: "Close dialog" }).click();
    await p.goto(link);
    await p.getByLabel("Username", { exact: false }).fill(user);
    await p.getByLabel("Display name").fill(user);
    await p.getByLabel("Password", { exact: false }).fill("a long player password");
    await p.getByRole("button", { name: "Join the adventure" }).click();
    await expect(p.getByTestId("connection-status")).toHaveText("Live");
  }
  for (const p of [dm, a, b]) await p.getByRole("tab", { name: "Dice", exact: true }).click();
  const result = (p: Page, expression: string) =>
    p.getByTestId("roll-result").filter({ hasText: expression });
  async function roll(expression: string, scope: string, label: string) {
    await a.getByLabel("Dice expression", { exact: true }).fill(expression);
    await a.getByLabel("Roll visibility", { exact: true }).selectOption(scope);
    await a.getByRole("button", { name: label, exact: true }).click();
    await expect(a.getByRole("button", { name: label, exact: true })).toBeEnabled();
  }
  await roll("2d1+3", "public", "Roll publicly");
  for (const p of [dm, a, b])
    await expect(result(p, "2d1+3").getByLabel("Roll total", { exact: true })).toHaveText("5");
  await roll("3d1+7", "gm", "Roll to DM + me");
  for (const p of [dm, a])
    await expect(result(p, "3d1+7").getByLabel("Roll total", { exact: true })).toHaveText("10");
  await expect(result(b, "3d1+7")).toHaveCount(0);
  await roll("4d1+9", "self", "Roll privately");
  await expect(result(a, "4d1+9").getByLabel("Roll total", { exact: true })).toHaveText("13");
  for (const p of [dm, b]) await expect(result(p, "4d1+9")).toHaveCount(0);
  await roll("5d1+11", "blind", "Roll blind");
  await expect(a.locator(".dice-acceptance")).toContainText("Only the DM receives the result");
  await expect(result(dm, "5d1+11").getByLabel("Roll total", { exact: true })).toHaveText("16");
  for (const p of [a, b]) await expect(result(p, "5d1+11")).toHaveCount(0);
  const dh = await (await dm.request.get(`/api/campaigns/${id}/rolls`)).json();
  const blind = dh.rolls.find((r: { expression: string }) => r.expression === "5d1+11");
  expect(blind).toBeTruthy();
  const hidden = await a.request.get(`/api/campaigns/${id}/rolls/${blind.id}`),
    unknown = await a.request.get(
      `/api/campaigns/${id}/rolls/00000000-0000-4000-8000-000000000000`,
    );
  expect(hidden.status()).toBe(404);
  expect(await hidden.json()).toEqual(await unknown.json());
  expect(af.join(" ")).not.toContain("5d1+11");
  expect(bf.join(" ")).not.toContain("3d1+7");
  expect(bf.join(" ")).not.toContain("4d1+9");
  expect(df.join(" ")).not.toContain("4d1+9");
  await ac.setOffline(true);
  await expect(a.getByTestId("connection-status")).not.toHaveText("Live");
  await expect(a.getByRole("button", { name: "Roll blind", exact: true })).toBeDisabled();
  await ac.setOffline(false);
  await expect(a.getByTestId("connection-status")).toHaveText("Live");
  await expect(a.getByTestId("roll-result")).toHaveCount(3);
  await a.reload();
  await expect(a.getByTestId("connection-status")).toHaveText("Live");
  await a.getByRole("tab", { name: "Dice", exact: true }).click();
  await expect(a.getByTestId("roll-result")).toHaveCount(3);
  await expect(result(a, "4d1+9")).toBeVisible();
  await expect(result(a, "5d1+11")).toHaveCount(0);
  await roll("101d6", "public", "Roll publicly");
  await expect(a.getByRole("alert").first()).toContainText("at most 120");
  expect((await (await a.request.get(`/api/campaigns/${id}/rolls`)).json()).rolls).toHaveLength(3);
  await a.getByLabel("Roll visibility", { exact: true }).selectOption("self");
  await a.getByRole("button", { name: "Quick roll d20", exact: true }).click();
  await expect(result(a, "1d20")).toBeVisible();
  const quick = await result(a, "1d20").getByLabel("Roll total", { exact: true }).textContent();
  expect(Number(quick)).toBeGreaterThanOrEqual(1);
  expect(Number(quick)).toBeLessThanOrEqual(20);
  await expect(result(dm, "1d20")).toHaveCount(0);
  await expect(result(b, "1d20")).toHaveCount(0);
  await a.getByLabel("Dice expression", { exact: true }).fill("d20+12");
  await a.getByRole("tab", { name: "Characters", exact: true }).click();
  await a.getByRole("tab", { name: "Dice", exact: true }).click();
  await expect(a.getByLabel("Roll visibility", { exact: true })).toHaveValue("self");
  await expect(a.getByLabel("Dice expression", { exact: true })).toHaveValue("d20+12");
  await dm.screenshot({ path: test.info().outputPath("dice-dm-history.png"), fullPage: true });
  await a.screenshot({ path: test.info().outputPath("dice-player-history.png"), fullPage: true });
  const campaign = (await (await dm.request.get(`/api/campaigns/${id}`)).json()).campaign;
  await dm.request.patch(`/api/campaigns/${id}`, {
    headers: { "X-Hearth-Request": "1", Origin: isolatedHostURL },
    data: { name: campaign.name, description: campaign.description, archived: true },
  });
  await expect(a.getByRole("button", { name: "Roll privately", exact: true })).toBeDisabled();
  await dm.request.patch(`/api/campaigns/${id}`, {
    headers: { "X-Hearth-Request": "1", Origin: isolatedHostURL },
    data: { name: campaign.name, description: campaign.description, archived: false },
  });
  expect(errors).toEqual([]);
  await owner.close();
  await ac.close();
  await bc.close();
});

it("DM journal pages share safely and stale edits preserve drafts", async ({
  browser,
  isolatedHostURL,
}) => {
  const owner = await browser.newContext({ baseURL: isolatedHostURL }),
    ac = await browser.newContext({ baseURL: isolatedHostURL }),
    bc = await browser.newContext({ baseURL: isolatedHostURL });
  const dm = await owner.newPage(),
    a = await ac.newPage(),
    b = await bc.newPage();
  const errors: string[] = [],
    frames: string[] = [];
  for (const p of [dm, a, b]) p.on("pageerror", (e) => errors.push(e.message));
  for (const p of [a, b])
    p.on("websocket", (s) => s.on("framereceived", (f) => frames.push(String(f.payload))));
  await actorStageOwner(dm);
  const path = new URL(dm.url()).pathname,
    id = path.split("/").pop();
  for (const [p, user] of [
    [a, "journal_alice"],
    [b, "journal_bob"],
  ] as const) {
    await dm.getByRole("button", { name: "Invite players", exact: true }).click();
    await dm.getByRole("button", { name: "Create invitation", exact: true }).click();
    const link = await dm.getByLabel("Invitation link").inputValue();
    await dm.getByRole("button", { name: "Close dialog" }).click();
    await p.goto(link);
    await p.getByLabel("Username", { exact: false }).fill(user);
    await p.getByLabel("Display name").fill(user);
    await p.getByLabel("Password", { exact: false }).fill("a long player password");
    await p.getByRole("button", { name: "Join the adventure" }).click();
    await expect(p.getByTestId("connection-status")).toHaveText("Live");
    await p.getByRole("tab", { name: "Journal", exact: true }).click();
    await expect(p.getByRole("button", { name: "New page", exact: true })).toHaveCount(0);
  }
  await dm.getByRole("tab", { name: "Journal", exact: true }).click();
  await dm.getByRole("button", { name: "New page", exact: true }).click();
  await dm.getByLabel("Page title", { exact: true }).fill("Moon clue 0.0.7");
  await dm.getByLabel("Page text", { exact: true }).fill("JOURNAL PRIVATE INITIAL");
  await dm.getByRole("tab", { name: "Dice", exact: true }).click();
  await dm.getByRole("tab", { name: "Journal", exact: true }).click();
  await expect(dm.getByLabel("Page text", { exact: true })).toHaveValue("JOURNAL PRIVATE INITIAL");
  await dm.getByRole("button", { name: "Create private page", exact: true }).click();
  await expect(dm.locator(".journal-page h2")).toHaveText("Moon clue 0.0.7");
  const pages = (await (await dm.request.get(`/api/campaigns/${id}/journals`)).json()).journals;
  const pageId = pages.find((p: { title: string }) => p.title === "Moon clue 0.0.7").id;
  for (const p of [a, b]) {
    await expect(p.getByRole("button", { name: "Moon clue 0.0.7", exact: true })).toHaveCount(0);
    expect((await p.request.get(`/api/campaigns/${id}/journals/${pageId}`)).status()).toBe(404);
  }
  await dm.getByRole("button", { name: "Edit page", exact: true }).click();
  const literal = "<script>globalThis.journalInjected=true</script>\nA shared clue.";
  await dm.getByLabel("Page text", { exact: true }).fill(literal);
  await dm.getByLabel("Page visibility", { exact: true }).selectOption("shared");
  await dm.getByRole("button", { name: "Save and share page", exact: true }).click();
  for (const p of [a, b]) {
    await p.getByRole("button", { name: "Moon clue 0.0.7", exact: true }).click();
    await expect(p.locator(".journal-page > p")).toHaveText(literal);
    expect(await p.evaluate(() => "journalInjected" in globalThis)).toBe(false);
  }
  const other = await owner.newPage();
  await other.goto(path);
  await expect(other.getByTestId("connection-status")).toHaveText("Live");
  await other.getByRole("tab", { name: "Journal", exact: true }).click();
  await other.getByRole("button", { name: "Moon clue 0.0.7", exact: true }).click();
  await other.getByRole("button", { name: "Edit page", exact: true }).click();
  await other.getByLabel("Page text", { exact: true }).fill("My stale draft");
  await dm.getByRole("button", { name: "Edit page", exact: true }).click();
  await dm.getByLabel("Page text", { exact: true }).fill("New authoritative clue");
  await dm.getByRole("button", { name: "Save and share page", exact: true }).click();
  await expect(
    other.getByRole("button", { name: "Save and share page", exact: true }),
  ).toBeDisabled();
  await expect(other.getByLabel("Page text", { exact: true })).toHaveValue("My stale draft");
  await other.getByRole("button", { name: "Reload page", exact: true }).click();
  await expect(other.getByLabel("Page text", { exact: true })).toHaveValue(
    "New authoritative clue",
  );
  await other.getByRole("button", { name: "Cancel", exact: true }).click();
  await ac.setOffline(true);
  await expect(a.getByTestId("connection-status")).not.toHaveText("Live");
  await dm.getByRole("button", { name: "Edit page", exact: true }).click();
  await dm.getByLabel("Page text", { exact: true }).fill("JOURNAL PRIVATE CONCEALED");
  await dm.getByLabel("Page visibility", { exact: true }).selectOption("dm");
  await dm.getByRole("button", { name: "Save private page", exact: true }).click();
  await ac.setOffline(false);
  for (const p of [a, b]) {
    await expect(p.getByTestId("connection-status")).toHaveText("Live");
    await expect(p.getByRole("button", { name: "Moon clue 0.0.7", exact: true })).toHaveCount(0);
  }
  expect(frames.join(" ")).not.toContain("JOURNAL PRIVATE INITIAL");
  expect(frames.join(" ")).not.toContain("JOURNAL PRIVATE CONCEALED");
  await dm.reload();
  await expect(dm.getByTestId("connection-status")).toHaveText("Live");
  await dm.getByRole("button", { name: "Moon clue 0.0.7", exact: true }).click();
  await expect(dm.locator(".journal-page > p")).toHaveText("JOURNAL PRIVATE CONCEALED");
  await dm.getByRole("button", { name: "Delete page", exact: true }).click();
  await expect(dm.getByRole("dialog")).toContainText("Moon clue 0.0.7");
  await dm.getByRole("button", { name: "Confirm delete page", exact: true }).click();
  await expect(dm.getByRole("dialog")).toHaveCount(0);
  await expect(dm.getByRole("button", { name: "Moon clue 0.0.7", exact: true })).toHaveCount(0);
  expect((await dm.request.get(`/api/campaigns/${id}/journals/${pageId}`)).status()).toBe(404);
  expect(errors).toEqual([]);
  await owner.close();
  await ac.close();
  await bc.close();
});

it("chat whispers and selected dice remain private through reconnect and recipient revocation", async ({
  browser,
  isolatedHostURL,
}) => {
  const owner = await browser.newContext({ baseURL: isolatedHostURL }),
    ac = await browser.newContext({ baseURL: isolatedHostURL }),
    bc = await browser.newContext({ baseURL: isolatedHostURL });
  const dm = await owner.newPage(),
    a = await ac.newPage(),
    b = await bc.newPage();
  const errors: string[] = [],
    dmFrames: string[] = [];
  for (const p of [dm, a, b]) p.on("pageerror", (e) => errors.push(e.message));
  dm.on("websocket", (s) => s.on("framereceived", (f) => dmFrames.push(String(f.payload))));
  await actorStageOwner(dm);
  const id = new URL(dm.url()).pathname.split("/").pop();
  for (const [p, user] of [
    [a, "chat_alice"],
    [b, "chat_bob"],
  ] as const) {
    await dm.getByRole("button", { name: "Invite players", exact: true }).click();
    await dm.getByRole("button", { name: "Create invitation", exact: true }).click();
    const link = await dm.getByLabel("Invitation link").inputValue();
    await dm.getByRole("button", { name: "Close dialog" }).click();
    await p.goto(link);
    await p.getByLabel("Username", { exact: false }).fill(user);
    await p.getByLabel("Display name").fill(user);
    await p.getByLabel("Password", { exact: false }).fill("a long player password");
    await p.getByRole("button", { name: "Join the adventure" }).click();
    await expect(p.getByTestId("connection-status")).toHaveText("Live");
  }
  for (const p of [dm, a, b]) await p.getByRole("tab", { name: "Chat", exact: true }).click();
  const message = (p: Page, text: string) =>
    p.getByTestId("chat-message").filter({ hasText: text });
  await a.getByLabel("Message text", { exact: true }).fill("Public <script>literal()</script>");
  await a.getByRole("button", { name: "Send to everyone", exact: true }).click();
  for (const p of [dm, a, b])
    await expect(message(p, "Public <script>literal()</script>")).toBeVisible();
  await a.getByLabel("Message visibility", { exact: true }).selectOption("whisper");
  await a.getByRole("checkbox", { name: "chat_bob", exact: true }).check();
  await a.getByLabel("Message text", { exact: true }).fill("PRIVATE TO BOB ONLY");
  await a.getByRole("button", { name: "Send whisper", exact: true }).click();
  await expect(message(b, "PRIVATE TO BOB ONLY")).toBeVisible();
  await expect(message(dm, "PRIVATE TO BOB ONLY")).toHaveCount(0);
  const messageId = await message(b, "PRIVATE TO BOB ONLY").getAttribute("data-message-id");
  expect((await dm.request.get(`/api/campaigns/${id}/chat/${messageId}`)).status()).toBe(404);
  await a.getByRole("tab", { name: "Dice", exact: true }).click();
  await a.getByLabel("Roll visibility", { exact: true }).selectOption("selected");
  await a.getByRole("checkbox", { name: "chat_bob", exact: true }).check();
  await a.getByLabel("Dice expression", { exact: true }).fill("7d1+23");
  await a.getByRole("button", { name: "Roll to selected participants", exact: true }).click();
  await expect(b.getByTestId("chat-roll-card").filter({ hasText: "7d1+23" })).toBeVisible();
  await expect(dm.getByTestId("chat-roll-card").filter({ hasText: "7d1+23" })).toHaveCount(0);
  expect(dmFrames.join(" ")).not.toContain("PRIVATE TO BOB ONLY");
  expect(dmFrames.join(" ")).not.toContain("7d1+23");
  await a.getByRole("tab", { name: "Chat", exact: true }).click();
  await a.getByLabel("Message text", { exact: true }).fill("Private draft across tabs");
  await a.getByRole("tab", { name: "Characters", exact: true }).click();
  await a.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(a.getByLabel("Message visibility", { exact: true })).toHaveValue("whisper");
  await expect(a.getByLabel("Message text", { exact: true })).toHaveValue(
    "Private draft across tabs",
  );
  await expect(a.getByRole("checkbox", { name: "chat_bob", exact: true })).toBeChecked();
  await bc.setOffline(true);
  await expect(b.getByTestId("connection-status")).not.toHaveText("Live");
  await a.getByLabel("Message text", { exact: true }).fill("WHISPER AFTER RECONNECT");
  await a.getByRole("button", { name: "Send whisper", exact: true }).click();
  await expect(message(a, "WHISPER AFTER RECONNECT")).toBeVisible();
  await bc.setOffline(false);
  await expect(b.getByTestId("connection-status")).toHaveText("Live");
  await expect(message(b, "WHISPER AFTER RECONNECT")).toBeVisible();
  await b.reload();
  await expect(b.getByTestId("connection-status")).toHaveText("Live");
  await b.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(message(b, "PRIVATE TO BOB ONLY")).toBeVisible();
  await a.getByLabel("Message text", { exact: true }).fill("Keep draft after Bob leaves");
  const roster = await (await dm.request.get(`/api/campaigns/${id}/participants`)).json();
  const bobId = roster.participants.find(
    (p: { displayName: string }) => p.displayName === "chat_bob",
  ).id;
  expect(
    (
      await dm.request.post(`/api/campaigns/${id}/members/${bobId}/revoke`, {
        headers: { "X-Hearth-Request": "1", Origin: isolatedHostURL },
        data: {},
      })
    ).ok(),
  ).toBe(true);
  await expect(b.getByRole("link", { name: "Campaign library", exact: true })).toBeVisible();
  await expect(b.getByTestId("chat-message")).toHaveCount(0);
  await expect(b.getByTestId("chat-roll-card")).toHaveCount(0);
  await expect(
    a
      .getByRole("region", { name: "Chat", exact: true })
      .getByText("A selected participant is no longer available.", { exact: false }),
  ).toBeVisible();
  await expect(a.getByRole("button", { name: "Send whisper", exact: true })).toBeDisabled();
  await expect(a.getByLabel("Message text", { exact: true })).toHaveValue(
    "Keep draft after Bob leaves",
  );
  await expect(a.getByLabel("Message visibility", { exact: true })).toHaveValue("whisper");
  expect(errors).toEqual([]);
  await owner.close();
  await ac.close();
  await bc.close();
});

async function fixtureCommands(page: Page, campaign: string, commands: unknown[]) {
  await page.evaluate(
    async ({ campaign, commands }) => {
      const url = new URL(`/api/campaigns/${campaign}/ws`, location.href);
      url.protocol = "ws:";
      const socket = new WebSocket(url, "hearth.v1");
      let revision = 0;
      let pending: { id: string; resolve: () => void; reject: (e: Error) => void } | null = null;
      let readyResolve: () => void = () => {},
        readyReject: (e: Error) => void = () => {};
      const ready = new Promise<void>((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
      });
      socket.onopen = () =>
        socket.send(JSON.stringify({ kind: "hello", schemaVersion: 1, lastRevision: null }));
      socket.onmessage = (event) => {
        const frame = JSON.parse(event.data);
        if (frame.kind === "snapshot") {
          revision = Math.max(revision, frame.revision);
          readyResolve();
        }
        if (frame.kind === "ack" && pending && pending.id === frame.requestId) {
          revision = frame.revision;
          pending.resolve();
          pending = null;
        }
        if (frame.kind === "error") {
          const error = new Error(frame.error.message);
          if (pending) {
            pending.reject(error);
            pending = null;
          } else readyReject(error);
        }
      };
      socket.onerror = () => readyReject(new Error("Fixture command connection failed"));
      try {
        await ready;
        for (const command of commands)
          await new Promise<void>((resolve, reject) => {
            const id = crypto.randomUUID();
            pending = { id, resolve, reject };
            socket.send(
              JSON.stringify({
                kind: "command",
                schemaVersion: 1,
                requestId: id,
                baseRevision: revision,
                command,
              }),
            );
          });
      } finally {
        socket.close();
      }
    },
    { campaign, commands },
  );
}

it("VTT workspace preserves the canvas and drafts while combat stays authorized", async ({
  browser,
  isolatedHostURL,
}) => {
  const owner = await browser.newContext({ baseURL: isolatedHostURL }),
    ac = await browser.newContext({ baseURL: isolatedHostURL }),
    bc = await browser.newContext({ baseURL: isolatedHostURL });
  const dm = await owner.newPage(),
    a = await ac.newPage(),
    b = await bc.newPage();
  const errors: string[] = [],
    playerFrames: string[] = [];
  for (const p of [dm, a, b]) p.on("pageerror", (e) => errors.push(e.message));
  for (const p of [a, b])
    p.on("websocket", (s) => s.on("framereceived", (f) => playerFrames.push(String(f.payload))));
  await actorStageOwner(dm);
  const headers = { "X-Hearth-Request": "1", Origin: isolatedHostURL };
  const created = await dm.request.post("/api/campaigns", {
    headers,
    data: { name: "Workspace encounter", description: "Live workspace test", createDemo: true },
  });
  expect(created.ok()).toBe(true);
  const campaign = (await created.json()).campaign.id;
  await dm.goto(`/campaign/${campaign}`);
  await expect(dm.getByTestId("connection-status")).toHaveText("Live");
  await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-renderer", "pixi");
  for (const [page, user] of [
    [a, "arena_alice"],
    [b, "arena_bob"],
  ] as const) {
    const issued = await dm.request.post(`/api/campaigns/${campaign}/invites`, {
      headers,
      data: { expiresInHours: 24 },
    });
    const invite = (await issued.json()).invite;
    const joined = await page.request.post("/api/invites/redeem", {
      headers,
      data: {
        code: invite.code,
        username: user,
        displayName: user,
        password: "a long player password",
      },
    });
    expect(joined.ok()).toBe(true);
    await page.goto(`/campaign/${campaign}`);
    await expect(page.getByTestId("connection-status")).toHaveText("Live");
  }
  const roster = (await (await dm.request.get(`/api/campaigns/${campaign}/participants`)).json())
    .participants;
  const scene = (await (await dm.request.get(`/api/campaigns/${campaign}/scenes`)).json())
    .scenes[0];
  const commands: unknown[] = [];
  let rowanActor = "";
  for (const token of scene.tokens) {
    const actorId = crypto.randomUUID(),
      npc = token.visibility === "dm";
    if (token.name.startsWith("Rowan")) rowanActor = actorId;
    commands.push({
      type: "actor.create",
      payload: {
        actorId,
        name: token.name,
        kind: npc ? "npc" : "character",
        assetId: token.assetId,
        biography: "Encounter participant",
        dmNotes: "SECRET COMBAT NOTES",
        hp: npc ? 30 : token.name.startsWith("Rowan") ? 18 : 14,
        maxHp: npc ? 30 : token.name.startsWith("Rowan") ? 20 : 14,
        attributes: {},
      },
    });
    if (!npc) {
      commands.push({ type: "actor.visibility", payload: { actorId, visibility: "shared" } });
      const player = roster.find(
        (p: { displayName: string }) =>
          p.displayName === (token.name.startsWith("Rowan") ? "arena_alice" : "arena_bob"),
      );
      commands.push({
        type: "actor.permission",
        payload: { actorId, userId: player.id, permission: "owner" },
      });
    }
    commands.push({ type: "token.link", payload: { tokenId: token.id, actorId } });
  }
  await fixtureCommands(dm, campaign, commands);
  for (const p of [dm, a, b]) await p.getByRole("tab", { name: "Combat", exact: true }).click();
  await dm.getByLabel("Encounter name", { exact: true }).fill("Bell chamber encounter");
  await dm.getByRole("button", { name: "Prepare encounter", exact: true }).click();
  for (let n = 0; n < 3; n++) {
    await dm.getByRole("button", { name: "Add to encounter", exact: true }).click();
    await expect(dm.getByTestId("combatant")).toHaveCount(n + 1);
  }
  for (const [name, value] of [
    ["Rowan · Warden", "18"],
    ["Elara · Scout", "14"],
    ["Vault sentinel", "10"],
  ]) {
    await dm.getByLabel(`Initiative for ${name}`, { exact: true }).fill(value ?? "");
    await dm.getByRole("button", { name: `Set initiative for ${name}`, exact: true }).click();
  }
  await dm.getByRole("button", { name: "Begin combat", exact: true }).click();
  for (const p of [dm, a, b]) await expect(p.getByText("ROUND 1", { exact: true })).toBeVisible();
  await expect(a.getByTestId("combatant")).toHaveCount(2);
  await expect(b.getByTestId("combatant")).toHaveCount(2);
  await a.getByLabel("HP for Rowan · Warden", { exact: true }).fill("16");
  await a.getByRole("button", { name: "Save HP for Rowan · Warden", exact: true }).click();
  await expect(b.getByTestId("combatant").filter({ hasText: "Rowan · Warden" })).toContainText(
    "16 / 20",
  );
  await expect(b.getByLabel("HP for Rowan · Warden", { exact: true })).toHaveCount(0);
  await dm.getByRole("button", { name: "Next turn", exact: true }).click();
  await expect(a.locator(".current-turn")).toContainText("Elara · Scout");
  await dm.getByRole("button", { name: "Next turn", exact: true }).click();
  for (const p of [a, b]) await expect(p.getByText("Awaiting GM", { exact: true })).toBeVisible();
  expect(playerFrames.join(" ")).not.toContain("Vault sentinel");
  expect(playerFrames.join(" ")).not.toContain("SECRET COMBAT NOTES");
  await dm.getByRole("button", { name: "Next turn", exact: true }).click();
  await expect(a.getByText("ROUND 2", { exact: true })).toBeVisible();
  const hp = dm.getByLabel("HP for Rowan · Warden", { exact: true });
  await hp.fill("15");
  const originalHp = await hp.elementHandle();
  await dm.getByRole("button", { name: "Pop out combat tracker", exact: true }).click();
  await expect(dm.locator('[data-window-id="combat-tracker"]')).toBeVisible();
  expect(await hp.evaluate((current, old) => current === old, originalHp)).toBe(true);
  await dm.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(hp).toHaveValue("15");
  await dm.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  const handle = dm.getByRole("button", { name: "Move Combat tracker", exact: true });
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Tracker handle missing");
  await dm.mouse.move(handleBox.x + 50, handleBox.y + 15);
  await dm.mouse.down();
  await dm.mouse.move(1500, handleBox.y + 15, { steps: 8 });
  await dm.mouse.up();
  await dm.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await expect
    .poll(async () => {
      const popup = await dm.locator('[data-window-id="combat-tracker"]').boundingBox();
      const stage = await dm.locator(".workspace-stage").boundingBox();
      return !!popup && !!stage && popup.x + popup.width <= stage.x + stage.width - 7;
    })
    .toBe(true);
  await dm.getByRole("button", { name: "Close Combat tracker", exact: true }).click();
  await dm.getByRole("tab", { name: "Combat", exact: true }).click();
  await expect(hp).toHaveValue("15");
  const canvas = dm.locator("canvas"),
    originalCanvas = await canvas.elementHandle(),
    zoom = await dm.locator(".scene-viewport").getAttribute("data-zoom");
  await dm.getByRole("button", { name: "Fit scene", exact: true }).click();
  await dm.getByRole("button", { name: "Pan canvas", exact: true }).click();
  const mapBox = await canvas.boundingBox();
  if (!mapBox) throw new Error("Canvas missing");
  const pawn = scene.tokens.find((t: { name: string }) => t.name.startsWith("Rowan"));
  const fit = Math.min(mapBox.width / scene.width, mapBox.height / scene.height) * 0.92;
  const px = mapBox.x + (mapBox.width - scene.width * fit) / 2 + pawn.x * fit;
  const py = mapBox.y + (mapBox.height - scene.height * fit) / 2 + pawn.y * fit;
  await dm.mouse.move(px, py);
  await dm.mouse.down();
  await dm.mouse.move(px + 60, py + 35, { steps: 6 });
  await dm.mouse.up();
  const afterPan = (await (await dm.request.get(`/api/campaigns/${campaign}/scenes`)).json())
    .scenes[0];
  expect(afterPan.tokens.find((t: { id: string }) => t.id === pawn.id)).toMatchObject({
    x: pawn.x,
    y: pawn.y,
  });
  await expect(dm.getByRole("button", { name: "Inspect selected token", exact: true })).toHaveCount(
    0,
  );
  await dm.getByRole("button", { name: "Select tokens", exact: true }).click();
  await dm.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await dm.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  expect(await canvas.evaluate((current, old) => current === old, originalCanvas)).toBe(true);
  await expect(dm.locator(".scene-viewport")).toHaveAttribute("data-zoom", zoom ?? "");
  const resizer = dm.getByRole("separator", { name: "Sidebar width" });
  await resizer.focus();
  await dm.keyboard.press("ArrowLeft");
  await expect(resizer).toHaveAttribute("aria-valuenow", "388");
  const divider = await resizer.boundingBox();
  if (!divider) throw new Error("Sidebar divider missing");
  await dm.mouse.move(divider.x + 3, divider.y + 100);
  await dm.mouse.down();
  await dm.mouse.move(divider.x - 37, divider.y + 100, { steps: 5 });
  await dm.mouse.up();
  await expect(resizer).toHaveAttribute("aria-valuenow", "428");
  expect(await canvas.evaluate((current, old) => current === old, originalCanvas)).toBe(true);
  await a.getByRole("tab", { name: "Dice", exact: true }).click();
  await a.getByLabel("Roll visibility", { exact: true }).selectOption("self");
  await a.getByRole("tab", { name: "Chat", exact: true }).click();
  await a.getByLabel("Message visibility", { exact: true }).selectOption("whisper");
  await a.getByRole("checkbox", { name: "arena_bob", exact: true }).check();
  await a.getByLabel("Message text", { exact: true }).fill("Private workspace draft");
  await a.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await a.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await expect(a.getByLabel("Message text", { exact: true })).toHaveValue(
    "Private workspace draft",
  );
  await expect(a.getByLabel("Message visibility", { exact: true })).toHaveValue("whisper");
  await a.getByLabel("Message text", { exact: true }).focus();
  await a.keyboard.press("Shift+D");
  await expect(a.getByRole("tab", { name: "Chat", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await a.getByRole("button", { name: "Prepare d6 roll", exact: true }).click();
  await expect(a.getByLabel("Dice expression", { exact: true })).toHaveValue("1d6");
  await expect(a.getByLabel("Roll visibility", { exact: true })).toHaveValue("self");
  expect(
    (await (await a.request.get(`/api/campaigns/${campaign}/rolls`)).json()).rolls,
  ).toHaveLength(0);
  await dm.getByRole("button", { name: "Take scene private", exact: true }).click();
  for (const p of [a, b]) {
    await p.getByRole("tab", { name: "Combat", exact: true }).click();
    await expect(p.getByTestId("combatant")).toHaveCount(0);
  }
  await dm.getByRole("button", { name: "Show scene to players", exact: true }).click();
  await expect(a.getByTestId("combatant")).toHaveCount(2);
  await dm.getByRole("button", { name: "End combat", exact: true }).click();
  await dm.getByRole("button", { name: "Confirm end combat", exact: true }).click();
  await expect(dm.getByText("ENDED", { exact: true })).toBeVisible();
  await dm.getByRole("button", { name: "Clear encounter", exact: true }).click();
  await dm.getByRole("button", { name: "Confirm clear encounter", exact: true }).click();
  await expect(dm.getByRole("button", { name: "Prepare encounter", exact: true })).toBeVisible();
  const actor = (
    await (await dm.request.get(`/api/campaigns/${campaign}/actors/${rowanActor}`)).json()
  ).actor;
  expect(actor.hp).toBe(16);
  await dm.setViewportSize({ width: 760, height: 700 });
  const sidebarBox = await dm
    .getByRole("complementary", { name: "Workspace sidebar" })
    .boundingBox();
  expect(sidebarBox?.width).toBeLessThan(710);
  await dm.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  expect(await canvas.evaluate((current, old) => current === old, originalCanvas)).toBe(true);
  expect(errors).toEqual([]);
  await owner.close();
  await ac.close();
  await bc.close();
});
