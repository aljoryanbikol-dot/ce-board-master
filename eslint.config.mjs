// CE Board Master — shared ESLint flat config (ESLint 9).
// Each workspace package re-exports this (optionally extending it).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Ignore generated / build output across the monorepo.
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/prisma/migrations/**',
      '**/src/database/generated/**',
    ],
  },

  // Base JS + TypeScript recommended rules.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Project-wide rule tuning.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Intentional/harmless in our regexes and runtime guards — not build blockers.
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
    },
  },

  // Test files: allow unused setup imports (vi, beforeEach, mock placeholders, any).
  {
    files: ['**/__tests__/**', '**/*.spec.ts', '**/*.test.ts', '**/test/**'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Disable stylistic rules that conflict with Prettier (keep last).
  prettier,
);
