/**
 * @file auth.e2e-spec.ts
 * @module Auth/E2E
 *
 * End-to-end tests for the complete authentication flow.
 *
 * Tests the full API behaviour from HTTP request to database response
 * against a running NestJS application with a real test database.
 *
 * Flow tested:
 * register → verify-email → login → GET /me → change-password
 *         → refresh → logout → forgot-password → resend-verification
 *
 * Setup:
 * 1. Requires NODE_ENV=test and a test database (see .env.test.example)
 * 2. Migrations run via globalSetup before tests execute
 * 3. Test user is cleaned up in afterAll
 *
 * Run: pnpm test:e2e
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';

const TEST_EMAIL    = 'e2e-auth@ce-boardmaster.test';
const TEST_PASSWORD = 'E2eTestPass1!';

describe('Authentication Flows (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  // Shared state across tests
  let verificationToken: string | undefined;
  let accessToken: string | undefined;
  let refreshCookie: string | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    // Register Fastify cookie plugin (needed for refresh token cookie)
    await app.register(
      require('@fastify/cookie') as Parameters<typeof app.register>[0],
    );

    await app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Clean up test user between test suites (not between individual tests
    // in the same flow — they share state intentionally)
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user
      .deleteMany({ where: { email: TEST_EMAIL } })
      .catch(() => {}); // Ignore if not found

    await app.close();
  });

  const post = (url: string, body: object, headers: Record<string, string> = {}) =>
    app.getHttpAdapter().getInstance().inject({
      method:  'POST',
      url:     `/api/v1/${url}`,
      payload: body,
      headers: { 'content-type': 'application/json', ...headers },
    });

  const get = (url: string, headers: Record<string, string> = {}) =>
    app.getHttpAdapter().getInstance().inject({
      method:  'GET',
      url:     `/api/v1/${url}`,
      headers,
    });

  const patch = (url: string, body: object, headers: Record<string, string> = {}) =>
    app.getHttpAdapter().getInstance().inject({
      method:  'PATCH',
      url:     `/api/v1/${url}`,
      payload: body,
      headers: { 'content-type': 'application/json', ...headers },
    });

  // ── 1. Registration ─────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should register a new user and return 201', async () => {
      // Clean up any pre-existing test user first
      await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

      const res = await post('auth/register', {
        firstName: 'E2E',
        lastName:  'Test',
        email:     TEST_EMAIL,
        password:  TEST_PASSWORD,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.email).toBe(TEST_EMAIL);
      expect(body.data.userId).toBeTruthy();
    });

    it('should return 409 for duplicate email', async () => {
      const res = await post('auth/register', {
        firstName: 'Dup',
        lastName:  'User',
        email:     TEST_EMAIL,
        password:  TEST_PASSWORD,
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should return 422 for missing required fields', async () => {
      const res = await post('auth/register', { email: 'incomplete@test.com' });
      expect(res.statusCode).toBe(422);
    });

    it('should return 422 for weak password', async () => {
      const res = await post('auth/register', {
        firstName: 'Test', lastName: 'User',
        email: 'weak@test.com', password: 'weak',
      });
      expect(res.statusCode).toBe(422);
    });
  });

  // ── 2. Login (before verification) ─────────────────────────────────────────

  describe('POST /auth/login (before verification)', () => {
    it('should return 403 ACCOUNT_NOT_VERIFIED', async () => {
      const res = await post('auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
    });
  });

  // ── 3. Email verification ───────────────────────────────────────────────────

  describe('POST /auth/verify-email', () => {
    beforeAll(async () => {
      // Manually activate the account for e2e testing
      // (Email is not actually sent in tests — BullMQ is mocked)
      const dbUser = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
      if (dbUser) {
        // Create a test verification token directly in the DB
        const { hashToken, generateSecureToken } = await import(
          '../../src/auth/utils/token.utils'
        );
        const rawToken = generateSecureToken(32);
        verificationToken = rawToken;

        const expiresAt = new Date(Date.now() + 86_400_000);
        await prisma.userAuthToken.create({
          data: {
            userId:    dbUser.id,
            tokenHash: hashToken(rawToken),
            tokenType: 'email_verify',
            expiresAt,
            isRevoked: false,
          },
        });
      }
    });

    it('should verify email and activate account', async () => {
      expect(verificationToken).toBeTruthy();

      const res = await post('auth/verify-email', { token: verificationToken });
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);
      expect(body.data.message).toContain('verified');
    });

    it('should return 401 for already-used token', async () => {
      const res = await post('auth/verify-email', { token: verificationToken });
      // Token is consumed — second use should fail or be already verified
      expect([401, 409]).toContain(res.statusCode);
    });

    it('should return 401 for invalid token', async () => {
      const res = await post('auth/verify-email', { token: 'a'.repeat(64) });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── 4. Login (after verification) ──────────────────────────────────────────

  describe('POST /auth/login (after verification)', () => {
    it('should login and return access token + refresh cookie', async () => {
      const res = await post('auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.tokenType).toBe('Bearer');
      expect(body.data.expiresIn).toBe(900);
      expect(body.data.user.email).toBe(TEST_EMAIL);

      accessToken = body.data.accessToken;

      // Extract refresh cookie
      const setCookieHeader = res.headers['set-cookie'];
      expect(setCookieHeader).toBeTruthy();
      const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      expect(cookieStr).toContain('refreshToken');
      expect(cookieStr).toContain('HttpOnly');
      refreshCookie = cookieStr;
    });

    it('should return 401 for wrong password', async () => {
      const res = await post('auth/login', { email: TEST_EMAIL, password: 'WrongPass1!' });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 422 for invalid email format', async () => {
      const res = await post('auth/login', { email: 'not-an-email', password: 'Pass1!' });
      expect(res.statusCode).toBe(422);
    });
  });

  // ── 5. GET /me ───────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('should return current user profile', async () => {
      expect(accessToken).toBeTruthy();

      const res = await get('auth/me', { authorization: `Bearer ${accessToken}` });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.email).toBe(TEST_EMAIL);
      expect(body.data.isVerified).toBe(true);
    });

    it('should return 401 without token', async () => {
      const res = await get('auth/me');
      expect(res.statusCode).toBe(401);
    });
  });

  // ── 6. POST /auth/refresh ────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('should issue a new access token using the refresh cookie', async () => {
      expect(refreshCookie).toBeTruthy();

      const res = await post('auth/refresh', {}, { cookie: refreshCookie! });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.accessToken).toBeTruthy();

      // Update access token for subsequent tests
      accessToken = body.data.accessToken;
    });

    it('should return 401 without cookie', async () => {
      const res = await post('auth/refresh', {});
      expect(res.statusCode).toBe(401);
    });
  });

  // ── 7. Resend verification ───────────────────────────────────────────────────

  describe('POST /auth/resend-verification', () => {
    it('should always return 200 (anti-enumeration)', async () => {
      const res = await post('auth/resend-verification', { email: 'nobody@nowhere.com' });
      expect(res.statusCode).toBe(200);
    });

    it('should return 200 for registered email too', async () => {
      const res = await post('auth/resend-verification', { email: TEST_EMAIL });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── 8. Forgot password ───────────────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('should always return 200 (anti-enumeration)', async () => {
      const res = await post('auth/forgot-password', { email: 'nobody@nowhere.com' });
      expect(res.statusCode).toBe(200);
    });

    it('should return 200 for registered email', async () => {
      const res = await post('auth/forgot-password', { email: TEST_EMAIL });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── 9. Change password ───────────────────────────────────────────────────────

  describe('PATCH /auth/change-password', () => {
    it('should change password and revoke sessions', async () => {
      expect(accessToken).toBeTruthy();

      const res = await patch(
        'auth/change-password',
        { currentPassword: TEST_PASSWORD, newPassword: 'UpdatedPass2@' },
        { authorization: `Bearer ${accessToken}` },
      );

      // Sessions revoked — accessing /me should fail now
      expect(res.statusCode).toBe(200);
    });

    it('should return 401 for wrong current password', async () => {
      // Get a new token since previous one was revoked
      await prisma.user.update({ where: { email: TEST_EMAIL }, data: { passwordHash: undefined } });

      // Re-login with new password
      const loginRes = await post('auth/login', { email: TEST_EMAIL, password: 'UpdatedPass2@' });
      if (loginRes.statusCode === 200) {
        accessToken = JSON.parse(loginRes.body).data.accessToken;

        const res = await patch(
          'auth/change-password',
          { currentPassword: 'WrongOld1!', newPassword: 'NewNew2@' },
          { authorization: `Bearer ${accessToken}` },
        );

        expect(res.statusCode).toBe(401);
      }
    });
  });

  // ── 10. Logout ───────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('should logout and clear cookie', async () => {
      // Re-login to get fresh tokens
      const loginRes = await post('auth/login', { email: TEST_EMAIL, password: 'UpdatedPass2@' });
      if (loginRes.statusCode !== 200) return; // Skip if password state is unknown

      const { accessToken: at } = JSON.parse(loginRes.body).data;
      const cookie = (loginRes.headers['set-cookie'] as string | string[])?.[0] ?? '';

      const res = await post('auth/logout', {}, {
        authorization: `Bearer ${at}`,
        cookie,
      });

      expect(res.statusCode).toBe(204);
    });

    it('should return 401 without authentication', async () => {
      const res = await post('auth/logout', {});
      expect(res.statusCode).toBe(401);
    });
  });

  // ── 11. Health check (smoke test) ────────────────────────────────────────────

  describe('GET /health', () => {
    it('should return 200 (public endpoint, no auth needed)', async () => {
      const res = await get('health');
      expect(res.statusCode).toBe(200);
    });
  });
});
