/**
 * Vitest Configuration — End-to-End Tests
 *
 * E2E tests run against a real database (test container) and real Redis.
 * They require the full application stack to be running.
 *
 * Run with: pnpm test:e2e
 *
 * Note: E2E tests are slower (~30-60s per suite) and are run in CI
 * only on merges to main, not on every PR.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e-spec.ts'],
    globals: true,
    environment: 'node',

    // E2E tests take longer — extend timeouts
    testTimeout: 60_000,
    hookTimeout: 60_000,

    // Run E2E tests sequentially to avoid database state conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Setup file that starts the test application
    globalSetup: './test/e2e/global-setup.ts',
    setupFiles: ['./test/e2e/setup.ts'],
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@config': resolve(__dirname, 'src/config'),
      '@common': resolve(__dirname, 'src/common'),
      '@database': resolve(__dirname, 'src/database'),
    },
  },
});
