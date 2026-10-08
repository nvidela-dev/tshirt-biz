import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', use: { channel: 'chromium', baseURL: 'http://localhost:3011', viewport: { width: 1440, height: 1050 } }, webServer: { command: 'npm run dev -- --port 3011', url: 'http://localhost:3011', reuseExistingServer: true }, reporter: 'list' });
