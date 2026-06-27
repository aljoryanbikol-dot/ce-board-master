/**
 * ESLint Configuration for CE Board Master API
 *
 * Rules enforced:
 * - TypeScript strict checking via @typescript-eslint
 * - No unused variables (catches dead code early)
 * - No explicit `any` (enforces type safety from Project Constitution Art. XIV)
 * - Prettier formatting integration (no style conflicts)
 * - NestJS-specific rules (no circular dependency pitfalls)
 *
 * Ignored patterns:
 * - Generated Prisma client (auto-generated, not our code)
 * - dist/ (compiled output)
 * - vitest config files (different tsconfig context)
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: false,
  },
  ignorePatterns: [
    '.eslintrc.js',
    'dist/',
    'node_modules/',
    'src/database/generated/',
    'prisma/',
    'vitest.config.ts',
    'vitest.e2e.config.ts',
    'coverage/',
  ],
  rules: {
    // TypeScript strictness (Project Constitution Article XIV §14)
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',

    // NestJS patterns
    '@typescript-eslint/interface-name-prefix': 'off',

    // Code quality
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',

    // Prettier (formatting handled by .prettierrc)
    'prettier/prettier': 'error',
  },
};
