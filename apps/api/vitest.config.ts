/**
 * Vitest Configuration — Unit and Integration Tests
 *
 * Uses Vitest instead of Jest per the Technology Stack decision:
 * - Vitest is ~5x faster than Jest for TypeScript projects
 * - Native ESM support (no Babel transform needed)
 * - Compatible with Jest API (minimal migration cost)
 * - Excellent watch mode with instant feedback
 *
 * Coverage provider: V8 (built into Node.js, no extra dependencies)
 * Coverage threshold: 80% minimum per Project Constitution Article XIV
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Unit tests only — no external services required
    include: ['src/**/*.spec.ts', 'test/unit/**/*.spec.ts'],
    exclude: ['test/e2e/**', 'test/integration/**'],

    // Global setup for NestJS testing utilities
    globals: true,
    environment: 'node',

    // Reporter configuration
    reporters: ['verbose', 'json'],
    outputFile: {
      json: 'coverage/test-results.json',
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Enforce Project Constitution minimum (Article XIV §14: 80% minimum)
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      // Critical paths require higher coverage (auth, payments, grading)
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.dto.ts',
        'src/**/*.entity.ts',
        'src/database/generated/**',
        'prisma/**',
      ],
    },

    // Timeout for tests (prevents hanging tests in CI)
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },

  // Path aliases — must match tsconfig.json paths
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@config': resolve(__dirname, 'src/config'),
      '@common': resolve(__dirname, 'src/common'),
      '@database': resolve(__dirname, 'src/database'),
      '@cache': resolve(__dirname, 'src/cache'),
      '@queue': resolve(__dirname, 'src/queue'),
    },
  },
});
