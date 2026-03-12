import { defineConfig, devices } from '@playwright/test';
import { join } from 'path';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'safari',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm run dev',
      port: 5173,
      reuseExistingServer: true,
      cwd: join(__dirname, '..', 'frontend'),
      env: { VITE_API_URL: 'http://localhost:3000/api/v1' },
    },
    {
      command: 'pnpm run start:dev',
      port: 3000,
      reuseExistingServer: true,
      cwd: join(__dirname, '..', 'backend'),
      env: { MOCK_MODE: 'true' },
    },
  ],
});
