import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
let interrupted = false;
for (const command of ["pnpm", "cargo"]) {
  const check = spawnSync(command, ["--version"], { cwd: root, shell: windows, stdio: "ignore" });
  if (check.status !== 0) {
    console.error(
      `Missing ${command}. Install the prerequisites in START_HERE.md, then open a fresh terminal.`,
    );
    process.exit(1);
  }
}
async function run(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    shell: windows,
    stdio: "inherit",
    env: process.env,
  });
  const interrupt = () => {
    interrupted = true;
    child.kill("SIGINT");
  };
  process.once("SIGINT", interrupt);
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) =>
        code === 0 && !interrupted
          ? resolve()
          : reject(new Error(`${command} exited with ${code ?? signal}`)),
      );
    });
  } finally {
    process.removeListener("SIGINT", interrupt);
  }
}
try {
  console.log("Preparing Hearth. The first Rust build may take several minutes.");
  await run("pnpm", ["install", "--frozen-lockfile"]);
  await run("pnpm", ["build"]);
  const origin = process.env.HEARTH_ORIGINS?.split(",")[0]?.trim() || "http://127.0.0.1:8787";
  console.log(
    `When the host reports ready, open ${origin} in your browser. Keep this terminal open; Ctrl+C stops the host.`,
  );
  await run("cargo", ["run", "--locked", "-p", "hearth-server"]);
} catch (error) {
  if (interrupted) {
    console.log("Hearth stopped.");
    process.exitCode = 130;
  } else {
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "See START_HERE.md for setup and troubleshooting. Your campaign data is kept outside the source folder.",
    );
    process.exitCode = 1;
  }
}
