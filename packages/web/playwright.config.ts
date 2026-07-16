import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_DATABASE_PATH = path.join(os.tmpdir(), 'maktab-periods-e2e.db');
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command:
        `npm run build --workspace=packages/api && ` +
        `DATABASE_PATH=${E2E_DATABASE_PATH} HOST=127.0.0.1 PORT=4011 ` +
        `CORS_ORIGINS=http://127.0.0.1:4174 LOG_LEVEL=error npm start --workspace=packages/api`,
      cwd: workspaceRoot,
      url: 'http://127.0.0.1:4011/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        'VITE_API_PROXY_TARGET=http://127.0.0.1:4011 npm run dev --workspace=packages/web -- --host 127.0.0.1 --port 4174 --strictPort',
      cwd: workspaceRoot,
      url: 'http://127.0.0.1:4174/periods',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
