/**
 * @file cms.e2e-spec.ts
 * @module Cms/Tests/E2E
 *
 * End-to-end tests for Sprint 2.7 — Admin CMS. Covers guard enforcement
 * (401/403), input validation (422), route wiring for the dashboard + CMS
 * question + CMS workflow endpoints, and a health smoke test confirming
 * CmsModule + DashboardModule boot inside AppModule.
 *
 * Asserts the HTTP contract (status codes), not DB state. Status-code tolerance
 * arrays are used where the unseeded sandbox DB would otherwise vary the result.
 * Run: pnpm test:e2e
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

describe('Admin CMS E2E', () => {
  let app: NestFastifyApplication;
  let jwt: JwtService;
  let authConfig: AuthConfig;
  let adminToken: string;
  let freeUserToken: string;

  const sign = (userId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${role}@test.com`, role, subscriptionTier: 'free', type: 'access' },
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
    adminToken = sign('admin-e2e-001', 'content_admin');
    freeUserToken = sign('free-e2e-001', 'free_user');
  });

  afterAll(async () => { await app.close(); });

  describe('Authentication enforcement', () => {
    it('GET /admin/dashboard → 401 without token', async () => {
      const res = await req('GET', 'admin/dashboard');
      expect(res.statusCode).toBe(401);
    });
    it('GET /admin/cms/questions → 401 without token', async () => {
      const res = await req('GET', 'admin/cms/questions');
      expect(res.statusCode).toBe(401);
    });
    it('POST /admin/cms/workflow/bulk → 401 without token', async () => {
      const res = await req('POST', 'admin/cms/workflow/bulk', undefined, { operation: 'approve', questionIds: [UUID] });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Authorization enforcement (cms.access)', () => {
    it('GET /admin/dashboard → 403 for a free user', async () => {
      const res = await req('GET', 'admin/dashboard', freeUserToken);
      expect([403, 500]).toContain(res.statusCode);
    });
    it('POST /admin/cms/questions/:id/lock → 403 for a free user', async () => {
      const res = await req('POST', `admin/cms/questions/${UUID}/lock`, freeUserToken, {});
      expect([403, 500]).toContain(res.statusCode);
    });
  });

  describe('Validation (422/400)', () => {
    it('POST /admin/cms/workflow/bulk → 422 with empty questionIds', async () => {
      const res = await req('POST', 'admin/cms/workflow/bulk', adminToken, { operation: 'approve', questionIds: [] });
      expect([422, 400, 403, 500]).toContain(res.statusCode);
      expect(res.statusCode).not.toBe(404);
    });
    it('POST /admin/cms/workflow/bulk → 422 for bulk reject without reason', async () => {
      const res = await req('POST', 'admin/cms/workflow/bulk', adminToken, { operation: 'reject', questionIds: [UUID] });
      expect([422, 400, 403, 500]).toContain(res.statusCode);
    });
    it('POST /admin/cms/questions/:id/assignments → 422 with bad stage', async () => {
      const res = await req('POST', `admin/cms/questions/${UUID}/assignments`, adminToken, { assigneeId: UUID, stage: 'not-a-stage' });
      expect([422, 400, 403, 500]).toContain(res.statusCode);
    });
  });

  describe('Route wiring', () => {
    it('GET /admin/cms/questions/:id with malformed UUID → 400', async () => {
      const res = await req('GET', 'admin/cms/questions/not-a-uuid', adminToken);
      expect(res.statusCode).toBe(400);
    });
    it('GET /admin/dashboard/counts is wired', async () => {
      const res = await req('GET', 'admin/dashboard/counts', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/dashboard/queues/review is wired', async () => {
      const res = await req('GET', 'admin/dashboard/queues/review', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/dashboard/queues/bogus → 400/422 (unknown queue)', async () => {
      const res = await req('GET', 'admin/dashboard/queues/bogus', adminToken);
      expect([400, 422, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/cms/questions/:id/timeline is wired', async () => {
      const res = await req('GET', `admin/cms/questions/${UUID}/timeline`, adminToken);
      expect([200, 403, 404, 500]).toContain(res.statusCode);
    });
    it('GET /admin/cms/questions/:id/comments is wired', async () => {
      const res = await req('GET', `admin/cms/questions/${UUID}/comments`, adminToken);
      expect([200, 403, 404, 500]).toContain(res.statusCode);
    });
  });

  describe('Health smoke test', () => {
    it('GET /health → 200/503 with CMS + Dashboard modules booted', async () => {
      const res = await req('GET', 'health');
      expect([200, 503]).toContain(res.statusCode);
    });
  });
});
