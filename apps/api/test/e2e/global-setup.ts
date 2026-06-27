/**
 * E2E Global Setup — runs once before all E2E test suites.
 *
 * Responsibilities:
 * 1. Verify test database connection
 * 2. Run Prisma migrations on test database
 * 3. Seed minimum required test data
 *
 * Environment: Reads from .env.test (create from .env.example with test DB credentials)
 * The test database should be isolated from development database.
 */
import { execSync } from 'child_process';

export async function setup(): Promise<void> {
  console.log('\n🧪 Setting up E2E test environment...');

  // Ensure test environment variables are set
  if (!process.env['DATABASE_URL']?.includes('test')) {
    throw new Error(
      'E2E tests must use a dedicated test database.\n' +
        'Ensure DATABASE_URL in .env.test points to a test database.',
    );
  }

  // Run migrations on the test database
  console.log('  📦 Running Prisma migrations on test database...');
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env['DATABASE_URL'] },
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('  ✅ E2E environment ready\n');
}

export async function teardown(): Promise<void> {
  console.log('\n🧹 Cleaning up E2E test environment...');
}
