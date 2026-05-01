// @ts-check
const { defineConfig } = require('@playwright/test');

function getLambdaTestWsEndpoint() {
  const username = process.env.LT_USERNAME;
  const accessKey = process.env.LT_ACCESS_KEY;
  if (!username || !accessKey) {
    throw new Error('Missing LT credentials. Set LT_USERNAME and LT_ACCESS_KEY environment variables.');
  }

  const capabilities = {
    browserName: 'Chrome',
    browserVersion: 'latest',
    'LT:Options': {
      user: username,
      accessKey,
      platform: 'Windows 11',
      build: process.env.LT_BUILD || 'amazon-playwright',
      name: process.env.LT_TEST_NAME || 'amazon-parallel',
      console: true,
      network: true,
      video: true,
      // Keep your workers config; LambdaTest will run sessions in parallel.
    },
  };

  return `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(
    JSON.stringify(capabilities)
  )}`;
}

const useLambdaTest =
  process.env.USE_LAMBDATEST === '1' ||
  Boolean(process.env.LT_USERNAME) ||
  Boolean(process.env.LT_ACCESS_KEY);

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

  projects: [
    { name: 'local' },
    ...(useLambdaTest
      ? [
          {
            name: 'lambdatest',
            use: {
              browserName: 'chromium',
              headless: true,
              // Connect to LambdaTest Playwright Grid via WebSocket
              connectOptions: {
                wsEndpoint: getLambdaTestWsEndpoint(),
              },
            },
          },
        ]
      : []),
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
