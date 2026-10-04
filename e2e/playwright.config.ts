import { defineConfig, devices } from '@playwright/test';

/**
 * The production build, served by one server on a port of its own, as a
 * player meets it. Reveals are short so a whole game fits in a test; the
 * windows players act in keep their real lengths.
 */
const PORT = Number(process.env.E2E_PORT ?? 3310);

export default defineConfig({
  testDir: '.',
  // Every test makes its own rooms, so tests share the server safely.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 90_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  outputDir: '../test-results',
  webServer: {
    command: 'node back/build/server.js',
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'production',
      PORT: String(PORT),
      REVIEW_SECONDS: '1',
      MINESWEEPER_REVEAL_SECONDS: '0.5',
    },
  },
});
