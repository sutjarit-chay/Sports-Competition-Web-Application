import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const testPort = Number(process.env.PLAYWRIGHT_TEST_PORT || 3000);
if (!Number.isInteger(testPort) || testPort < 1 || testPort > 65535)
  throw new Error("PLAYWRIGHT_TEST_PORT must be a valid TCP port");
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    channel:
      !chromiumPath && process.platform === "darwin" ? "chrome" : undefined,
    launchOptions: {
      executablePath: chromiumPath,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: `npm run build -- --webpack && npm start -- --port ${testPort}`,
    url: `http://127.0.0.1:${testPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
  workers: 1,
});
