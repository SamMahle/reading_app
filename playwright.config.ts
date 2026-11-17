import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build, so the service worker
 * and precache are exercised. WebKit with an iPad viewport is the target
 * (spec §4.1); the Chromium project exists for machines without WebKit:
 *   npx playwright test --project=chromium
 */
const iPadLandscape = {
  viewport: { width: 1024, height: 768 },
  hasTouch: true,
  deviceScaleFactor: 2,
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'off', serviceWorkers: 'allow' },
  projects: [
    { name: 'webkit', use: { ...devices['Desktop Safari'], ...iPadLandscape } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...iPadLandscape } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
