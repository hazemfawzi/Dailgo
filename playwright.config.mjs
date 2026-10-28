import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/browser',
  outputDir: 'test-results/browser',
  fullyParallel: false,
  workers: 1,
  // These end-to-end cases include multiple accounts/devices and cold lazy imports.
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://127.0.0.1:5187',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(process.env.DAILGO_BROWSER_PATH
        ? { executablePath: process.env.DAILGO_BROWSER_PATH }
        : existsSync('/usr/bin/chromium')
          ? { executablePath: '/usr/bin/chromium' }
          : {}),
    },
  },
  webServer: {
    command: 'node scripts/browser-server.mjs',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: 'list',
});
