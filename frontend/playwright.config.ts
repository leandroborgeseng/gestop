import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      // 321: WebKit com UA de iPhone. O Safari do iPhone não põe div em fullscreen;
      // o teste recusa requestFullscreen para exercer o fallback CSS.
      name: 'webkit',
      testMatch: /321-cco-barra-lateral|322-/,
      use: {
        ...devices['Desktop Safari'],
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      },
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'node ./scripts/e2e-webserver.mjs',
        url: 'http://127.0.0.1:3000/login',
        reuseExistingServer: false,
        timeout: 600_000,
      }
    : undefined,
});
