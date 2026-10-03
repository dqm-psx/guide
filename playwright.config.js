// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  expect: { timeout: 7500 },
  // Every test owns a fresh browser context, so tests are independent even
  // across files, and the served copy runs on four workers. The file://
  // contract is pinned by the file-mode smoke tests.
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Redundant with trace screencasts on failure; recording every test is
    // pure overhead on a suite this size.
    video: 'off',
  },
});
