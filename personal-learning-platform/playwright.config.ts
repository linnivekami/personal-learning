import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:8787", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8787/api/v1/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
