import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { testHostExecutable } from "./test-runtime.mjs";

const data = mkdtempSync(join(tmpdir(), "hearth-e2e-"));
const web = join(data, "web");
cpSync(process.env.HEARTH_TEST_WEB_DIR || resolve("apps/web/dist"), web, { recursive: true });
const child = spawn(testHostExecutable(), [], {
  stdio: "inherit",
  env: {
    ...process.env,
    HEARTH_BIND: "127.0.0.1:8790",
    HEARTH_ORIGINS: "http://127.0.0.1:8790",
    HEARTH_DATA_DIR: data,
    HEARTH_WEB_DIR: web,
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill("SIGINT"));
child.on("error", (error) => {
  console.error(error.message);
  rmSync(data, { recursive: true, force: true });
  process.exit(1);
});
child.on("exit", (code) => {
  rmSync(data, { recursive: true, force: true });
  process.exit(code ?? 0);
});
