// Reuse the real isolated GM/Alice/Bob workflow; no live campaign root is used.
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const child = spawn(
  "pnpm",
  ["exec", "playwright", "test", "tests/e2e/scene-notes.spec.ts", "--workers=1"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      HEARTH_NOTES_CAPTURE_DIR: resolve(process.argv[2] || "artifacts/scene-notes"),
    },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
