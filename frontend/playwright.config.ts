import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: "list",
  outputDir: ".artifacts/playwright",
  use: {
    trace: "retain-on-failure",
    navigationTimeout: 15000,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chromium",
  },
  projects: [
    {
      name: "web-desktop",
      testMatch: /web\.spec\.ts/,
      use: {
        baseURL: "http://127.0.0.1:3100",
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "web-phone",
      testMatch: /web\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        baseURL: "http://127.0.0.1:3100",
      },
    },
    {
      name: "native-web-phone",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        baseURL: "http://127.0.0.1:8082",
      },
    },
  ],
  webServer: [
    {
      command: "npm run start -- --port 3100",
      url: "http://127.0.0.1:3100/ui",
      reuseExistingServer: false,
    },
    {
      command: "npm run preview:web",
      cwd: "../mobile",
      url: "http://127.0.0.1:8082",
      reuseExistingServer: false,
    },
  ],
});
