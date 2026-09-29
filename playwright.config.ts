import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 240_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173/api/catalog",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CI: process.env.CI ?? "true",
      PORT: "3002",
      VITE_SERVER_ORIGIN: "http://127.0.0.1:3002",
    },
  },
});
