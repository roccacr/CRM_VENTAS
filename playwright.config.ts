import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/playwright',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:8002',
  },
  webServer: {
    command: 'npm run build && npm run start',
    reuseExistingServer: true,
    timeout: 60_000,
    url: 'http://127.0.0.1:8002/api/v1/health',
  },
});
