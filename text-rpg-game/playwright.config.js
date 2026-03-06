/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.js'),
  timeout: 60000,
  retries: 1,
  workers: 16,
  fullyParallel: true,
  reporter: [
    ['line'],
    ['json', { outputFile: 'test-results/e2e-result.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.CI ? undefined : {
    command: 'cd server && npm run dev:test',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: true,
    env: { ...process.env, MONGODB_DATABASE: 'turn-based-game-test', NODE_ENV: 'test' },
  },
};
