/**
 * Commitlint configuration for CE Board Master.
 *
 * Enforces Conventional Commits format: type(scope): description
 *
 * Valid types:
 *   feat     - New feature
 *   fix      - Bug fix
 *   docs     - Documentation only
 *   style    - Formatting (no logic change)
 *   refactor - Code restructure (no feature/fix)
 *   test     - Add/update tests
 *   chore    - Build process, tooling
 *   perf     - Performance improvement
 *   ci       - CI/CD changes
 *   build    - Build system changes
 *   revert   - Revert a previous commit
 *
 * Examples:
 *   feat(auth): add Google OAuth login
 *   fix(questions): correct answer validation on mock exam submit
 *   docs(api): update health check endpoint documentation
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'build', 'revert'],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'auth', 'users', 'profiles', 'subjects', 'topics', 'subtopics',
        'questions', 'study', 'exams', 'analytics', 'adaptive', 'ai-tutor',
        'subscriptions', 'payments', 'notifications', 'admin', 'search',
        'uploads', 'health', 'database', 'cache', 'queue', 'config',
        'common', 'infra', 'ci', 'docs', 'deps',
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 120],
  },
};
