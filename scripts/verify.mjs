import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export function assertVersions(root = projectRoot) {
  const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
  const cargo = readFileSync(resolve(root, "Cargo.toml"), "utf8");
  const section = cargo.match(/^\[workspace\.package\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
  const rustVersion = section?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!version || version !== rustVersion)
    throw new Error("Application versions in package.json and Cargo.toml must match.");
  const packages = readFileSync(resolve(root, "Cargo.lock"), "utf8").split(/^\[\[package\]\]\s*$/m);
  for (const name of ["hearth-domain", "hearth-storage", "hearth-server"]) {
    const block = packages.find((entry) => entry.match(/^name\s*=\s*"([^"]+)"/m)?.[1] === name);
    if (block?.match(/^version\s*=\s*"([^"]+)"/m)?.[1] !== version)
      throw new Error(`Cargo.lock version for ${name} must match ${version}.`);
  }
  return version;
}
export function parseVerificationArgs(args) {
  for (const arg of args)
    if (!["--release", "--browser-only", "--list"].includes(arg))
      throw new Error(`Unknown verification option: ${arg}`);
  return {
    release: args.includes("--release"),
    browserOnly: args.includes("--browser-only"),
    list: args.includes("--list"),
  };
}
export function createVerificationPlan({
  root = projectRoot,
  env = process.env,
  platform = process.platform,
  release = false,
  browserOnly = false,
} = {}) {
  const environment = { ...env };
  for (const key of ["HEARTH_DATA_DIR", "HEARTH_BIND", "HEARTH_ORIGINS", "HEARTH_WEB_DIR"])
    delete environment[key];
  environment.HEARTH_TEST_HOST_BIN = resolve(
    root,
    env.CARGO_TARGET_DIR || "target",
    release ? "release" : "debug",
    `hearth-server${platform === "win32" ? ".exe" : ""}`,
  );
  environment.HEARTH_TEST_WEB_DIR = resolve(root, "apps/web/dist");
  const step = (label, command, ...args) => ({ label, command, args });
  const steps = browserOnly
    ? []
    : [
        step("workflow tests", "pnpm", "test:tooling"),
        step("format and lint", "pnpm", "lint"),
        step("TypeScript types", "pnpm", "typecheck"),
        step("TypeScript tests", "pnpm", "test"),
        step("Rust formatting", "cargo", "fmt", "--all", "--", "--check"),
        step(
          "Rust lint",
          "cargo",
          "clippy",
          "--workspace",
          "--all-targets",
          "--locked",
          "--",
          "-D",
          "warnings",
        ),
        step("Rust tests", "cargo", "test", "--workspace", "--locked"),
        step("roadmap inventory", "pnpm", "check:features"),
      ];
  steps.push(
    step("browser application build", "pnpm", "build"),
    step(
      "host application build",
      "cargo",
      "build",
      "--locked",
      "-p",
      "hearth-server",
      ...(release ? ["--release"] : []),
    ),
    step("complete browser regression", "pnpm", "exec", "playwright", "test"),
  );
  return { root, env: environment, steps };
}
export async function runVerificationPlan(plan, { logger = console, stdio = "inherit" } = {}) {
  for (const step of plan.steps) {
    logger.log(`Checking ${step.label}: ${step.command} ${step.args.join(" ")}`);
    const status = await new Promise((done) => {
      const child = spawn(step.command, step.args, {
        cwd: plan.root,
        env: plan.env,
        stdio,
        shell: process.platform === "win32" && step.command === "pnpm",
      });
      const interrupt = () => child.kill("SIGINT");
      process.once("SIGINT", interrupt);
      const finish = (code) => {
        process.removeListener("SIGINT", interrupt);
        done(code);
      };
      child.once("error", (error) => {
        logger.error(`${step.label} could not start: ${error.message}`);
        finish(1);
      });
      child.once("exit", (code) => finish(code ?? 1));
    });
    if (status !== 0) {
      logger.error(`Validation stopped at ${step.label} (exit ${status}).`);
      return status;
    }
  }
  return 0;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const options = parseVerificationArgs(process.argv.slice(2));
    const version = assertVersions();
    const plan = createVerificationPlan(options);
    console.log(
      `Hearth ${version}: ${options.release ? "optimized" : "debug"} application validation`,
    );
    if (options.list) {
      for (const step of plan.steps) console.log(`${step.command} ${step.args.join(" ")}`);
      console.log(`Browser host: ${plan.env.HEARTH_TEST_HOST_BIN}`);
    } else {
      process.exitCode = await runVerificationPlan(plan);
      if (process.exitCode === 0)
        console.log(
          "Automated checks passed. Manual release and playable-session gates still apply.",
        );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
