import { defineConfig, devices } from '@playwright/test';

/**
 * `npm run design:compare`: drives the app into each Figma screen's state and
 * captures it beside Figma's preview. One worker and the real phase lengths,
 * so every state holds still long enough to capture and the room lists hold
 * only the rooms a screen means to show.
 */
const PORT = Number(process.env.SCREENS_PORT ?? 3320);

export default defineConfig({
  testDir: 'screens',
  workers: 1,
  reporter: 'list',
  timeout: 300_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
  },
  outputDir: '../test-results/screens',
  webServer: {
    command: 'node server/build/server/server.js',
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { NODE_ENV: 'production', PORT: String(PORT) },
  },
});
