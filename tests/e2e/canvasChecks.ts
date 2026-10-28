import { expect, type Page } from "@playwright/test";

export async function trackDraws(page: Page) {
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

export const drawCount = (page: Page) =>
  page.evaluate(() => (window as unknown as Window & { hearthTestDraws: number }).hearthTestDraws);

export async function expectIdleMap(page: Page) {
  const count = () => drawCount(page);
  await expect.poll(count).toBeGreaterThan(0);
  // Allow pending asset uploads/frames to settle, then observe an unchanged map.
  await page.locator("canvas").screenshot();
  await page.waitForTimeout(200);
  const before = await count();
  await page.waitForTimeout(200);
  expect(await count(), "An unchanged tabletop should stop issuing GPU draw calls").toBe(before);
}

export async function expectContextRecovery(page: Page) {
  const beforeContextLoss = await page.locator("canvas").screenshot();
  const drawsAtRestore = await page.evaluate(
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
  await expect.poll(() => drawCount(page)).toBeGreaterThan(drawsAtRestore);
  expect(await page.locator("canvas").screenshot()).toEqual(beforeContextLoss);
  await expectIdleMap(page);
}
