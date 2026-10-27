import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "@playwright/test";
import { testHostExecutable } from "../../scripts/test-runtime.mjs";

// Independent scenarios must not share authentication budgets or campaign state.
export const isolatedTest = test.extend<{ isolatedHostURL: string }>({
  isolatedHostURL: async ({ browser }, use) => {
    const existingContexts = new Set(browser.contexts());
    const reservation = createServer();
    await new Promise<void>((done, reject) => {
      reservation.once("error", reject);
      reservation.listen(0, "127.0.0.1", done);
    });
    const bind = `127.0.0.1:${(reservation.address() as AddressInfo).port}`;
    await new Promise<void>((done, reject) =>
      reservation.close((error) => (error ? reject(error) : done())),
    );
    const data = mkdtempSync(join(tmpdir(), "hearth-isolated-scenario-"));
    const url = `http://${bind}`;
    const host = spawn(testHostExecutable(), [], {
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        HEARTH_BIND: bind,
        HEARTH_ORIGINS: url,
        HEARTH_DATA_DIR: data,
        HEARTH_WEB_DIR: process.env.HEARTH_TEST_WEB_DIR || resolve("apps/web/dist"),
      },
    });
    let spawnError: Error | undefined;
    let diagnostics = "";
    host.on("error", (error) => {
      spawnError = error;
    });
    host.stderr?.on("data", (chunk) => {
      diagnostics = (diagnostics + String(chunk)).slice(-8000);
    });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 150; attempt++) {
        if (spawnError) throw spawnError;
        if (host.exitCode !== null) throw new Error(`Isolated host exited: ${diagnostics}`);
        try {
          if ((await fetch(`${url}/api/health`)).ok) {
            ready = true;
            break;
          }
        } catch {
          // Wait for this isolated host to bind.
        }
        await delay(100);
      }
      if (!ready) throw new Error(`Isolated host did not start: ${diagnostics}`);
      await use(url);
    } finally {
      await Promise.allSettled(
        browser
          .contexts()
          .filter((context) => !existingContexts.has(context))
          .map((context) => context.close()),
      );
      if (host.pid && host.exitCode === null) {
        const exited = new Promise<void>((done) => host.once("exit", () => done()));
        host.kill("SIGINT");
        await Promise.race([exited, delay(5000)]);
        if (host.exitCode === null) {
          host.kill("SIGKILL");
          await exited;
        }
      }
      rmSync(data, { recursive: true, force: true });
    }
  },
});
