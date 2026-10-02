import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    // Authentication URLs and storage contain credentials: do not capture them
    // in trace archives or videos. Individual safe UI screenshots may be added.
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    launchOptions: process.env.GOOGLE_CHROME_PATH ? { executablePath: process.env.GOOGLE_CHROME_PATH } : {},
  },
  webServer: {
    command: 'node scripts/with-local-env.mjs npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
