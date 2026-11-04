import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel:
      !chromiumPath && process.platform === "darwin" ? "chrome" : undefined,
    launchOptions: {
      executablePath: chromiumPath,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run build && npm start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
  workers: 1,
});
