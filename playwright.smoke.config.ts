import { defineConfig, devices } from "@playwright/test";

const platformPort = process.env.AIRJAM_SMOKE_PLATFORM_PORT ?? "3000";
const platformBaseUrl = `http://127.0.0.1:${platformPort}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
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
    command: "node ./scripts/browser-smoke-stack.mjs",
    url: platformBaseUrl,
    reuseExistingServer: true,
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
