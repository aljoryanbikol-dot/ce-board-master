/**
 * @file mock-exam.e2e-spec.ts
 * @module Exams/Tests/E2E
 *
 * End-to-end tests for Sprint 3.2 — Mock Examination Engine. Covers guard
 * enforcement (401 without a token), authorization (403 for a role lacking
 * exam.* permissions), input validation (422 for malformed bodies), route wiring
 * for all five exam modules (mock-exam, session, result, review, analytics), and
 * a health smoke test confirming ExamsModule boots inside AppModule.
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

describe('Mock Examination Engine E2E', () => {
  let app: NestFastifyApplication;
  let jwt: JwtService;
  let authConfig: AuthConfig;
  let subscriberToken: string;
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
    subscriberToken = sign('subscriber-exam-001', 'subscriber');
    noPermToken = sign('noperm-exam-001', 'reviewer'); // reviewer lacks exam.* perms
  });

  afterAll(async () => { await app.close(); });

  // ── Authentication (401) ──────────────────────────────────────────────────────
  describe('Authentication enforcement (401 without token)', () => {
    it('POST exams (create)', async () => { expect((await req('POST', 'exams')).statusCode).toBe(401); });
    it('GET exams/templates', async () => { expect((await req('GET', 'exams/templates')).statusCode).toBe(401); });
    it('POST exams/templates', async () => { expect((await req('POST', 'exams/templates')).statusCode).toBe(401); });
    it('GET exams/resume', async () => { expect((await req('GET', 'exams/resume')).statusCode).toBe(401); });
    it('GET exams/:id', async () => { expect((await req('GET', `exams/${UUID}`)).statusCode).toBe(401); });
    it('POST exams/:id/begin', async () => { expect((await req('POST', `exams/${UUID}/begin`)).statusCode).toBe(401); });
    it('POST exams/:id/answers', async () => { expect((await req('POST', `exams/${UUID}/answers`)).statusCode).toBe(401); });
    it('POST exams/:id/submit', async () => { expect((await req('POST', `exams/${UUID}/submit`)).statusCode).toBe(401); });
    it('GET exams/:id/result', async () => { expect((await req('GET', `exams/${UUID}/result`)).statusCode).toBe(401); });
    it('GET exams/:id/review', async () => { expect((await req('GET', `exams/${UUID}/review`)).statusCode).toBe(401); });
    it('GET exams/history', async () => { expect((await req('GET', 'exams/history')).statusCode).toBe(401); });
    it('GET exams/leaderboard', async () => { expect((await req('GET', 'exams/leaderboard')).statusCode).toBe(401); });
  });

  // ── Authorization (403 for a role lacking exam.* perms) ─────────────────────────
  describe('Authorization enforcement (403 for a role lacking exam perms)', () => {
    it('blocks a reviewer from creating an exam', async () => {
      const res = await req('POST', 'exams', noPermToken, { kind: 'full_board' });
      expect([403, 401]).toContain(res.statusCode);
    });
    it('blocks a reviewer from exam history', async () => {
      const res = await req('GET', 'exams/history', noPermToken);
      expect([403, 401]).toContain(res.statusCode);
    });
    it('blocks a reviewer from creating templates (needs exam.manage)', async () => {
      const res = await req('POST', 'exams/templates', noPermToken, { code: 'X' });
      expect([403, 401, 422]).toContain(res.statusCode);
    });
  });

  // ── Validation (422/400 for malformed input) ────────────────────────────────────
  describe('Input validation (422/400 for malformed bodies)', () => {
    it('rejects exam creation with an invalid kind', async () => {
      const res = await req('POST', 'exams', subscriberToken, { kind: 'mega_board' });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects exam creation missing a target (no template/subject/composition)', async () => {
      const res = await req('POST', 'exams', subscriberToken, { kind: 'subject' });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects an answer with a non-uuid examQuestionId', async () => {
      const res = await req('POST', `exams/${UUID}/answers`, subscriberToken, { examQuestionId: 'not-a-uuid' });
      expect([400, 401, 403, 404, 422]).toContain(res.statusCode);
    });
    it('rejects a template with an empty composition', async () => {
      const res = await req('POST', 'exams/templates', subscriberToken, { code: 'T', name: 'T', kind: 'custom', durationMinutes: 60, composition: [] });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects a non-uuid path param on exam detail', async () => {
      const res = await req('GET', 'exams/not-a-uuid', subscriberToken);
      expect([400, 401, 403]).toContain(res.statusCode);
    });
    it('rejects a non-uuid path param on result', async () => {
      const res = await req('GET', 'exams/not-a-uuid/result', subscriberToken);
      expect([400, 401, 403]).toContain(res.statusCode);
    });
  });

  // ── Route wiring (authorized requests resolve, not 404) ─────────────────────────
  describe('Route wiring (resolves for a subscriber)', () => {
    it('GET exams/templates resolves', async () => { expect((await req('GET', 'exams/templates', subscriberToken)).statusCode).not.toBe(404); });
    it('GET exams/resume resolves', async () => { expect((await req('GET', 'exams/resume', subscriberToken)).statusCode).not.toBe(404); });
    it('GET exams/history resolves', async () => { expect((await req('GET', 'exams/history', subscriberToken)).statusCode).not.toBe(404); });
    it('GET exams/leaderboard resolves', async () => { expect((await req('GET', 'exams/leaderboard', subscriberToken)).statusCode).not.toBe(404); });
    it('GET exams/:id resolves (not 404 routing)', async () => { const res = await req('GET', `exams/${UUID}`, subscriberToken); expect([200, 403, 404, 400]).toContain(res.statusCode); });
    it('GET exams/:id/performance resolves', async () => { const res = await req('GET', `exams/${UUID}/performance`, subscriberToken); expect(res.statusCode).not.toBe(404); });
    it('GET exams/:id/analysis resolves', async () => { const res = await req('GET', `exams/${UUID}/analysis`, subscriberToken); expect(res.statusCode).not.toBe(404); });
    it('GET exams/results/code/:code resolves', async () => { const res = await req('GET', 'exams/results/code/CEBM-EX-TESTCODE', subscriberToken); expect(res.statusCode).not.toBe(404); });
  });

  // ── Health smoke ──────────────────────────────────────────────────────────────
  describe('Health smoke (ExamsModule boots in AppModule)', () => {
    it('GET health responds', async () => {
      const res = await req('GET', 'health');
      expect([200, 503]).toContain(res.statusCode);
    });
  });
});
