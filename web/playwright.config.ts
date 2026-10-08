import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end + accessibility suite (see e2e/README.md).
 *
 * There is deliberately no `webServer` block: the stack (Postgres/Redis, Django with seeded demo
 * data and the dev OTP code, Next.js) is started separately, and BASE_URL points at the web app.
 * Specs share and mutate the seeded demo data, so they run serially in one worker.
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts", // vitest only picks up *.test.ts
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 2 : 0,
  forbidOnly: isCI,
  // Next dev compiles each route on first hit, so be generous.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    locale: "en-US",
    timezoneId: "Asia/Kathmandu",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
