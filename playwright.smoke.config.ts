import { defineConfig, devices } from "@playwright/test";

const platformPort = process.env.AIRJAM_SMOKE_PLATFORM_PORT ?? "3400";
const readyPort = process.env.AIRJAM_SMOKE_READY_PORT ?? "3499";
const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
const smokeReadyUrl = `http://127.0.0.1:${readyPort}/ready`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: platformBaseUrl,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node ./scripts/repo/cli.mjs smoke browser-stack",
    url: smokeReadyUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
