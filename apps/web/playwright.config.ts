import { defineConfig, devices } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (process.env.CI ? undefined : "/opt/pw-browsers/chromium"),
      // Real WebRTC code paths with synthetic camera/microphone devices.
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
    permissions: ["camera", "microphone"],
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : { command: "pnpm start", url: `${BASE}/api/health`, reuseExistingServer: true, timeout: 120_000 },
});
