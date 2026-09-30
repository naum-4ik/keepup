import { defineConfig, devices } from "@playwright/test";

// README screenshots only (npm run readme:screenshots); not part of the e2e suite.
export default defineConfig({
  testDir: "scripts/readme",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3600", timezoneId: "Europe/Rome", colorScheme: "light" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: { command: "npm run build && npm run start -- -p 3600", url: "http://localhost:3600", reuseExistingServer: true, timeout: 180_000 },
});
