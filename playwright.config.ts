import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev -w apps/api',
      port: 3001,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npm run dev -w apps/web',
      port: 5173,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
