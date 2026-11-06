// Publication checks run against the staged, freshly synchronized artifact.
// The full application regression suite remains in playwright.config.js.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/publication',
  timeout: 30000,
  expect: { timeout: 7500 },
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  outputDir: './test-results/publication',
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
