import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8790",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.HEARTH_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.HEARTH_CHROMIUM_EXECUTABLE }
        : {}),
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "node scripts/test-host.mjs",
    url: "http://127.0.0.1:8790/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
