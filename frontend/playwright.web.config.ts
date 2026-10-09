import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// Run the website checks without requiring an Expo install/export.
export default defineConfig({
  ...config,
  projects: config.projects?.filter((project) => project.name !== "native-web-phone"),
  webServer: Array.isArray(config.webServer) ? config.webServer[0] : config.webServer,
});
