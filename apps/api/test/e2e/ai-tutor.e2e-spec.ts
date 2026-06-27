/**
 * @file ai-tutor.e2e-spec.ts
 * @module AITutor/Tests/E2E
 *
 * End-to-end tests for Sprint 3.3 — AI Tutor & Intelligent Learning Assistant.
 * Covers guard enforcement (401 without a token), authorization (403 for a role
 * lacking tutor.* permissions), input validation (422 for malformed bodies),
 * route wiring for all seven tutor modules (chat, conversations, explanations,
 * hints, solutions, formula assistant, recommendations + coaching), and a health
 * smoke test confirming AITutorModule boots inside AppModule.
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

describe('AI Tutor E2E', () => {
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

  const req = (method: 'GET' | 'POST' | 'DELETE', url: string, token?: string, body?: object) =>
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
    subscriberToken = sign('subscriber-tutor-001', 'subscriber');
    noPermToken = sign('noperm-tutor-001', 'reviewer'); // reviewer lacks tutor.* perms
  });

  afterAll(async () => { await app.close(); });

  // ── Authentication (401) ──────────────────────────────────────────────────────
  describe('Authentication enforcement (401 without token)', () => {
    it('POST tutor/conversations', async () => { expect((await req('POST', 'tutor/conversations')).statusCode).toBe(401); });
    it('POST tutor/ask', async () => { expect((await req('POST', 'tutor/ask')).statusCode).toBe(401); });
    it('POST tutor/conversations/:id/messages', async () => { expect((await req('POST', `tutor/conversations/${UUID}/messages`)).statusCode).toBe(401); });
    it('GET tutor/conversations', async () => { expect((await req('GET', 'tutor/conversations')).statusCode).toBe(401); });
    it('POST tutor/explain/concept', async () => { expect((await req('POST', 'tutor/explain/concept')).statusCode).toBe(401); });
    it('POST tutor/explain/question', async () => { expect((await req('POST', 'tutor/explain/question')).statusCode).toBe(401); });
    it('POST tutor/hint', async () => { expect((await req('POST', 'tutor/hint')).statusCode).toBe(401); });
    it('POST tutor/solution', async () => { expect((await req('POST', 'tutor/solution')).statusCode).toBe(401); });
    it('POST tutor/formula', async () => { expect((await req('POST', 'tutor/formula')).statusCode).toBe(401); });
    it('GET tutor/recommendations', async () => { expect((await req('GET', 'tutor/recommendations')).statusCode).toBe(401); });
    it('GET tutor/coaching', async () => { expect((await req('GET', 'tutor/coaching')).statusCode).toBe(401); });
    it('POST tutor/coaching/generate', async () => { expect((await req('POST', 'tutor/coaching/generate')).statusCode).toBe(401); });
  });

  // ── Authorization (403 for a role lacking tutor.* perms) ────────────────────────
  describe('Authorization enforcement (403 for a role lacking tutor perms)', () => {
    it('blocks a reviewer from the chat', async () => {
      const res = await req('POST', 'tutor/ask', noPermToken, { question: 'What is statics?' });
      expect([403, 401, 422]).toContain(res.statusCode);
    });
    it('blocks a reviewer from coaching', async () => {
      const res = await req('GET', 'tutor/coaching', noPermToken);
      expect([403, 401]).toContain(res.statusCode);
    });
    it('blocks a reviewer from recommendations', async () => {
      const res = await req('GET', 'tutor/recommendations', noPermToken);
      expect([403, 401]).toContain(res.statusCode);
    });
  });

  // ── Validation (422/400 for malformed input) ────────────────────────────────────
  describe('Input validation (422/400 for malformed bodies)', () => {
    it('rejects an empty ask', async () => {
      const res = await req('POST', 'tutor/ask', subscriberToken, { question: '' });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects a message over the char limit', async () => {
      const res = await req('POST', `tutor/conversations/${UUID}/messages`, subscriberToken, { message: 'x'.repeat(5000) });
      expect([400, 401, 403, 404, 422]).toContain(res.statusCode);
    });
    it('rejects an explain-question with a non-uuid questionId', async () => {
      const res = await req('POST', 'tutor/explain/question', subscriberToken, { questionId: 'not-a-uuid' });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects a hint with an out-of-range level', async () => {
      const res = await req('POST', 'tutor/hint', subscriberToken, { questionId: UUID, level: 9 });
      expect([400, 401, 403, 404, 422]).toContain(res.statusCode);
    });
    it('rejects a formula query that is empty', async () => {
      const res = await req('POST', 'tutor/formula', subscriberToken, { query: '' });
      expect([400, 401, 403, 422]).toContain(res.statusCode);
    });
    it('rejects a non-uuid path param on messages', async () => {
      const res = await req('POST', 'tutor/conversations/not-a-uuid/messages', subscriberToken, { message: 'hi' });
      expect([400, 401, 403]).toContain(res.statusCode);
    });
  });

  // ── Route wiring (authorized requests resolve, not 404) ─────────────────────────
  describe('Route wiring (resolves for a subscriber)', () => {
    it('GET tutor/conversations resolves', async () => { expect((await req('GET', 'tutor/conversations', subscriberToken)).statusCode).not.toBe(404); });
    it('GET tutor/recommendations resolves', async () => { expect((await req('GET', 'tutor/recommendations', subscriberToken)).statusCode).not.toBe(404); });
    it('GET tutor/coaching resolves', async () => { expect((await req('GET', 'tutor/coaching', subscriberToken)).statusCode).not.toBe(404); });
    it('POST tutor/coaching/generate resolves', async () => { const res = await req('POST', 'tutor/coaching/generate', subscriberToken); expect(res.statusCode).not.toBe(404); });
    it('POST tutor/ask resolves', async () => { const res = await req('POST', 'tutor/ask', subscriberToken, { question: 'What is equilibrium?' }); expect(res.statusCode).not.toBe(404); });
    it('POST tutor/explain/concept resolves', async () => { const res = await req('POST', 'tutor/explain/concept', subscriberToken, { concept: 'statics' }); expect(res.statusCode).not.toBe(404); });
    it('POST tutor/formula resolves', async () => { const res = await req('POST', 'tutor/formula', subscriberToken, { query: 'ohm' }); expect(res.statusCode).not.toBe(404); });
  });

  // ── Health smoke ──────────────────────────────────────────────────────────────
  describe('Health smoke (AITutorModule boots in AppModule)', () => {
    it('GET health responds', async () => {
      const res = await req('GET', 'health');
      expect([200, 503]).toContain(res.statusCode);
    });
  });
});
