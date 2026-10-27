import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { testHostExecutable } from "./test-runtime.mjs";
import {
  assertVersions,
  createVerificationPlan,
  parseVerificationArgs,
  runVerificationPlan,
} from "./verify.mjs";

const quiet = { log() {}, error() {} };
function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), "hearth-workflow-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function manifests(root, version = "0.0.12") {
  writeFileSync(join(root, "package.json"), JSON.stringify({ version }));
  writeFileSync(join(root, "Cargo.toml"), `[workspace.package]\nversion = "0.0.12"\n`);
  writeFileSync(
    join(root, "Cargo.lock"),
    ["hearth-domain", "hearth-storage", "hearth-server"]
      .map((name) => `[[package]]\nname = "${name}"\nversion = "0.0.12"\n`)
      .join("\n"),
  );
}

test("release validation selects the built optimized host even when a stale override is inherited", () => {
  const root = resolve("example-project");
  const plan = createVerificationPlan({
    root,
    platform: "win32",
    release: true,
    env: { CARGO_TARGET_DIR: "build-cache", HEARTH_TEST_HOST_BIN: "old/debug/server" },
  });
  assert.equal(
    plan.env.HEARTH_TEST_HOST_BIN,
    join(root, "build-cache", "release", "hearth-server.exe"),
  );
  assert.equal(
    testHostExecutable({ root, platform: "win32", env: plan.env }),
    join(root, "build-cache", "release", "hearth-server.exe"),
  );
  const build = plan.steps.find((step) => step.command === "cargo" && step.args[0] === "build");
  assert.ok(build.args.includes("--release"));
  assert.deepEqual(plan.steps.at(-1).args, ["exec", "playwright", "test"]);
});
test("all harnesses can select a custom host and the default respects platform/target directory", () => {
  const root = resolve("project");
  assert.equal(
    testHostExecutable({ root, platform: "linux", env: {} }),
    join(root, "target", "debug", "hearth-server"),
  );
  assert.equal(
    testHostExecutable({ root, platform: "win32", env: { CARGO_TARGET_DIR: "cache" } }),
    join(root, "cache", "debug", "hearth-server.exe"),
  );
  assert.equal(
    testHostExecutable({
      root,
      platform: "linux",
      env: { HEARTH_TEST_HOST_BIN: "candidate/server" },
    }),
    join(root, "candidate", "server"),
  );
});
test("validation children cannot inherit the configured live campaign root", async (t) => {
  const root = temporary(t),
    output = join(root, "environment.json");
  const plan = createVerificationPlan({
    root,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: "isolated-target",
      HEARTH_DATA_DIR: "/live/campaign",
      HEARTH_BIND: "192.168.1.2:8787",
      HEARTH_WEB_DIR: "/old/web",
    },
  });
  plan.steps = [
    {
      label: "inspect validation environment",
      command: process.execPath,
      args: [
        "-e",
        `require('node:fs').writeFileSync(${JSON.stringify(output)}, JSON.stringify({data:process.env.HEARTH_DATA_DIR,bind:process.env.HEARTH_BIND,web:process.env.HEARTH_WEB_DIR,host:process.env.HEARTH_TEST_HOST_BIN}))`,
      ],
    },
  ];
  assert.equal(await runVerificationPlan(plan, { logger: quiet, stdio: "ignore" }), 0);
  const observed = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(observed.data, undefined);
  assert.equal(observed.bind, undefined);
  assert.equal(observed.web, undefined);
  assert.equal(
    observed.host,
    join(
      root,
      "isolated-target",
      "debug",
      process.platform === "win32" ? "hearth-server.exe" : "hearth-server",
    ),
  );
});
test("a failed real child stops validation and preserves its nonzero exit code", async (t) => {
  const root = temporary(t),
    marker = join(root, "markers");
  const append = (value) => ({
    label: value,
    command: process.execPath,
    args: [
      "-e",
      `require('node:fs').appendFileSync(${JSON.stringify(marker)}, ${JSON.stringify(value)})`,
    ],
  });
  const plan = {
    root,
    env: process.env,
    steps: [
      append("before"),
      { label: "failing check", command: process.execPath, args: ["-e", "process.exit(7)"] },
      append("must not run"),
    ],
  };
  assert.equal(await runVerificationPlan(plan, { logger: quiet, stdio: "ignore" }), 7);
  assert.equal(readFileSync(marker, "utf8"), "before");
});
test("a missing check executable fails validation without running later steps", async (t) => {
  const root = temporary(t),
    marker = join(root, "marker"),
    errors = [];
  const plan = {
    root,
    env: process.env,
    steps: [
      { label: "missing compiler", command: join(root, "nonexistent-command"), args: [] },
      {
        label: "later",
        command: process.execPath,
        args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad')`],
      },
    ],
  };
  assert.equal(
    await runVerificationPlan(plan, {
      logger: { log() {}, error: (message) => errors.push(message) },
      stdio: "ignore",
    }),
    1,
  );
  assert.throws(() => readFileSync(marker));
  assert.ok(errors.join(" ").includes("missing compiler"));
});
test("matched manifests validate and a mismatched application or lock version blocks checks", (t) => {
  const root = temporary(t);
  manifests(root);
  assert.equal(assertVersions(root), "0.0.12");
  manifests(root, "0.0.13");
  assert.throws(() => assertVersions(root), /version/i);
  manifests(root);
  writeFileSync(
    join(root, "Cargo.lock"),
    readFileSync(join(root, "Cargo.lock"), "utf8").replace(
      'version = "0.0.12"',
      'version = "0.0.11"',
    ),
  );
  assert.throws(() => assertVersions(root), /version/i);
});
test("unknown verification options cannot silently skip required checks", () => {
  assert.deepEqual(parseVerificationArgs(["--release", "--browser-only", "--list"]), {
    release: true,
    browserOnly: true,
    list: true,
  });
  assert.throws(() => parseVerificationArgs(["--skip-tests"]), /unknown/i);
});
