import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        // Each suite binds its own ephemeral port, so they are safe to run in
        // parallel — but the server logs every connection, and interleaved
        // output from several servers is unreadable. Kept quiet unless a test
        // fails, when the logs are worth having.
        silent: 'passed-only',
        testTimeout: 10000,
        hookTimeout: 10000,
    },
});
