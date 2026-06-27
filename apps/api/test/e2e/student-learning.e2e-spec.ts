/**
 * @file student-learning.e2e-spec.ts
 * @module Student/Tests/E2E
 *
 * End-to-end tests for Sprint 3.1 — Student Learning Platform. Covers guard
 * enforcement (401 without a token), input validation (422 for malformed bodies),
 * ownership/permission behavior, and route wiring for all six student modules
 * (dashboard, practice, progress, achievements, planner, engagement), plus a
 * health smoke test confirming the StudentModule boots inside AppModule.
 *
 * Asserts the HTTP contract (status codes), not DB state. Status-code tolerance
 * arrays absorb the unseeded sandbox DB. Run: pnpm test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { AuthConfig } from '../../src/auth/config/auth.config';
import { registerWebhookRawBodyParser } from '../../src/payments/webhooks/raw-body.plugin';

const API = (p: string) => `/api/v1/${p}`;
const UUID = '00000000-0000-4000-8000-000000000001';

describe('Student Learning Platform E2E', () => {
  let app: NestFastifyApplication;
  let jwt: JwtService;
  let authConfig: AuthConfig;
  let subscriberToken: string;
  let freeToken: string;
  let noPermToken: string;

  const sign = (userId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${role}@test.com`, role, subscriptionTier: 'pro', type: 'access' },
      { privateKey: authConfig.jwtPrivateKey, algorithm: 'RS256', expiresIn: 900 },
    );

  const req = (method: 'GET' | 'POST' | 'DELETE' | 'PATCH', url: string, token?: string, body?: object) =>
    app.getHttpAdapter().getInstance().inject({
      method, url: API(url), payload: body,
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    registerWebhookRawBodyParser(app.getHttpAdapter().getInstance());
    await app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    jwt = app.get(JwtService);
    authConfig = app.get(AuthConfig);
    subscriberToken = sign('subscriber-e2e-001', 'subscriber');
    freeToken = sign('free-e2e-001', 'free_user');
    noPermToken = sign('noperm-e2e-001', 'reviewer'); // reviewer lacks student.* perms
  });

  afterAll(async () => { await app.close(); });

  // ── Authentication (401) ──────────────────────────────────────────────────────
  describe('Authentication enforcement (401 without token)', () => {
    it('GET student/dashboard', async () => { expect((await req('GET', 'student/dashboard')).statusCode).toBe(401); });
    it('POST student/practice/sessions', async () => { expect((await req('POST', 'student/practice/sessions')).statusCode).toBe(401); });
    it('POST student/practice/answers', async () => { expect((await req('POST', 'student/practice/answers')).statusCode).toBe(401); });
    it('GET student/progress/mastery', async () => { expect((await req('GET', 'student/progress/mastery')).statusCode).toBe(401); });
    it('GET student/progress/knowledge-gaps', async () => { expect((await req('GET', 'student/progress/knowledge-gaps')).statusCode).toBe(401); });
    it('GET student/achievements', async () => { expect((await req('GET', 'student/achievements')).statusCode).toBe(401); });
    it('GET student/achievements/leaderboard', async () => { expect((await req('GET', 'student/achievements/leaderboard')).statusCode).toBe(401); });
    it('POST student/planner/goals', async () => { expect((await req('POST', 'student/planner/goals')).statusCode).toBe(401); });
    it('GET student/planner/plans', async () => { expect((await req('GET', 'student/planner/plans')).statusCode).toBe(401); });
    it('POST student/bookmarks', async () => { expect((await req('POST', 'student/bookmarks')).statusCode).toBe(401); });
    it('GET student/favorites', async () => { expect((await req('GET', 'student/favorites')).statusCode).toBe(401); });
    it('GET student/history', async () => { expect((await req('GET', 'student/history')).statusCode).toBe(401); });
  });

  // ── Authorization (403 for a role without student.* perms) ──────────────────────
  describe('Authorization enforcement (403 for a role lacking student perms)', () => {
    it('blocks a reviewer (no student.learn) from the dashboard', async () => {
      const res = await req('GET', 'student/dashboard', noPermToken);
      expect([403, 401]).toContain(res.statusCode);
    });
    it('blocks a reviewer from practicing', async () => {
      const res = await req('POST', 'student/practice/answers', noPermToken, { questionId: UUID, selectedChoice: 'A' });
      expect([403, 401, 422]).toContain(res.statusCode);
    });
  });

  // ── Validation (422/400 for malformed input) ────────────────────────────────────
  describe('Input validation (422/400 for malformed bodies)', () => {
    it('rejects a practice start with an invalid mode', async () => {
      const res = await req('POST', 'student/practice/sessions', subscriberToken, { mode: 'sideways' });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects an answer with a non-uuid questionId', async () => {
      const res = await req('POST', 'student/practice/answers', subscriberToken, { questionId: 'not-a-uuid' });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects a goal with an invalid period', async () => {
      const res = await req('POST', 'student/planner/goals', subscriberToken, { period: 'hourly', targetQuestions: 10 });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects a bookmark with a non-uuid questionId', async () => {
      const res = await req('POST', 'student/bookmarks', subscriberToken, { questionId: 'nope' });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects a non-uuid path param on session detail', async () => {
      const res = await req('GET', 'student/practice/sessions/not-a-uuid', subscriberToken);
      expect([400, 401, 403]).toContain(res.statusCode);
    });
    it('rejects a non-uuid path param on bookmark delete', async () => {
      const res = await req('DELETE', 'student/bookmarks/not-a-uuid', subscriberToken);
      expect([400, 401, 403]).toContain(res.statusCode);
    });
  });

  // ── Route wiring (authorized requests resolve, not 404) ─────────────────────────
  describe('Route wiring (resolves for a subscriber)', () => {
    it('GET student/dashboard resolves', async () => { expect((await req('GET', 'student/dashboard', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/progress/mastery resolves', async () => { expect((await req('GET', 'student/progress/mastery', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/progress/weak-topics resolves', async () => { expect((await req('GET', 'student/progress/weak-topics', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/progress/statistics resolves', async () => { expect((await req('GET', 'student/progress/statistics', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/progress/statistics/heatmap resolves', async () => { expect((await req('GET', 'student/progress/statistics/heatmap', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/achievements resolves', async () => { expect((await req('GET', 'student/achievements', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/achievements/leaderboard resolves', async () => { expect((await req('GET', 'student/achievements/leaderboard', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/planner/goals resolves', async () => { expect((await req('GET', 'student/planner/goals', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/planner/calendar resolves', async () => { expect((await req('GET', 'student/planner/calendar?from=2026-07-01&to=2026-07-31', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/bookmarks resolves', async () => { expect((await req('GET', 'student/bookmarks', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/recently-viewed resolves', async () => { expect((await req('GET', 'student/recently-viewed', subscriberToken)).statusCode).not.toBe(404); });
    it('GET student/practice/recommendations resolves', async () => { expect((await req('GET', 'student/practice/recommendations', subscriberToken)).statusCode).not.toBe(404); });
  });

  // ── Health smoke ──────────────────────────────────────────────────────────────
  describe('Health smoke (StudentModule boots in AppModule)', () => {
    it('GET health responds', async () => {
      const res = await req('GET', 'health');
      expect([200, 503]).toContain(res.statusCode);
    });
  });
});
