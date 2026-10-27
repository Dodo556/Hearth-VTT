import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
/** Resolve the same selected host for browser fixtures, recovery and captures. */
export function testHostExecutable({
  root = projectRoot,
  env = process.env,
  platform = process.platform,
} = {}) {
  return env.HEARTH_TEST_HOST_BIN
    ? resolve(root, env.HEARTH_TEST_HOST_BIN)
    : resolve(
        root,
        env.CARGO_TARGET_DIR || "target",
        "debug",
        `hearth-server${platform === "win32" ? ".exe" : ""}`,
      );
}
