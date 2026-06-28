// CE Board Master API — ESLint flat config (syntax-only linting).
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: ['vitest.config.ts', 'vitest.e2e.config.ts', 'prisma/**', 'dist/**'],
  },
];
