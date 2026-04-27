// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',

  timeout: 60000,

  fullyParallel: true,
  workers: 2,

  retries: 1,

  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],

  use: {
    headless: false,

    // 👇 Make browser look real
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',

    viewport: { width: 1280, height: 720 },

    slowMo: 300,

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 15000,
    ignoreHTTPSErrors: true,
  },
});