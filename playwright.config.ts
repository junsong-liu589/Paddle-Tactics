import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5173);
const webOrigin = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 240_000,
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
    ...devices["Desktop Chrome"],
  },
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true"
    ? {}
    : {
        webServer: {
          command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${webPort}`,
          cwd: "apps/web",
          url: webOrigin,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { CI: process.env.CI ?? "true" },
        },
      }),
});
