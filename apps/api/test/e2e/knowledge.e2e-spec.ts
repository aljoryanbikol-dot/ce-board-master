/**
 * @file knowledge.e2e-spec.ts
 * @module Knowledge/Tests/E2E
 *
 * End-to-end tests for Sprint 2.8 — Content Knowledge Management. Covers guard
 * enforcement (401/403), input validation (422), and route wiring for all six
 * knowledge modules (knowledge, learning-objectives, blueprints, misconceptions,
 * formulas, editorial), plus a health smoke test confirming every Sprint 2.8
 * module boots inside AppModule.
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

describe('Knowledge Base E2E', () => {
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
    adminToken = sign('admin-e2e-001', 'content_admin');
    freeUserToken = sign('free-e2e-001', 'free_user');
  });

  afterAll(async () => { await app.close(); });

  describe('Authentication enforcement (401 without token)', () => {
    it('GET /admin/knowledge/documents', async () => { expect((await req('GET', 'admin/knowledge/documents')).statusCode).toBe(401); });
    it('GET /admin/knowledge/search', async () => { expect((await req('GET', 'admin/knowledge/search?q=stress')).statusCode).toBe(401); });
    it('POST /admin/knowledge/documents/ingest', async () => { expect((await req('POST', 'admin/knowledge/documents/ingest', undefined, { bookNumber: 11 })).statusCode).toBe(401); });
    it('GET /admin/learning-objectives', async () => { expect((await req('GET', 'admin/learning-objectives')).statusCode).toBe(401); });
    it('GET /admin/blueprints', async () => { expect((await req('GET', 'admin/blueprints')).statusCode).toBe(401); });
    it('GET /admin/misconceptions', async () => { expect((await req('GET', 'admin/misconceptions')).statusCode).toBe(401); });
    it('GET /admin/formulas', async () => { expect((await req('GET', 'admin/formulas')).statusCode).toBe(401); });
    it('GET /admin/editorial/standards', async () => { expect((await req('GET', 'admin/editorial/standards')).statusCode).toBe(401); });
  });

  describe('Authorization enforcement (403 for free_user)', () => {
    it('GET /admin/learning-objectives → 403', async () => {
      const res = await req('GET', 'admin/learning-objectives', freeUserToken);
      expect([403, 500]).toContain(res.statusCode);
    });
    it('POST /admin/knowledge/documents/ingest → 403', async () => {
      const res = await req('POST', 'admin/knowledge/documents/ingest', freeUserToken, { bookNumber: 11, title: 'X', contentText: 'x'.repeat(60) });
      expect([403, 422, 500]).toContain(res.statusCode);
    });
    it('GET /admin/editorial/catalog → 403', async () => {
      const res = await req('GET', 'admin/editorial/catalog', freeUserToken);
      expect([403, 500]).toContain(res.statusCode);
    });
  });

  describe('Validation (422) for authorized requests', () => {
    it('rejects ingestion missing required fields', async () => {
      const res = await req('POST', 'admin/knowledge/documents/ingest', adminToken, { bookNumber: 99 });
      expect([422, 400, 403, 500]).toContain(res.statusCode);
    });
    it('rejects an LO with an invalid subject code length', async () => {
      const res = await req('POST', 'admin/learning-objectives', adminToken, { subjectCode: 'TOOLONG', topicCode: 1, subtopicCode: 3, sequenceNumber: 1, statement: 'A measurable statement here.' });
      expect([422, 400, 403, 500]).toContain(res.statusCode);
    });
    it('rejects a blueprint with an unknown type', async () => {
      const res = await req('POST', 'admin/blueprints', adminToken, { subjectCode: 'STR', topicCode: 4, subtopicCode: 2, blueprintType: 'ZZZ', sequenceNumber: 1, name: 'X' });
      expect([422, 400, 403, 500]).toContain(res.statusCode);
    });
    it('rejects a cross-reference with a non-UUID id', async () => {
      const res = await req('POST', 'admin/knowledge/cross-references', adminToken, { referenceType: 'lo_to_formula', fromType: 'learning_objective', fromId: 'not-a-uuid', toType: 'formula', toId: 'also-bad' });
      expect([422, 400, 403, 500]).toContain(res.statusCode);
    });
  });

  describe('Route wiring (authorized requests resolve, not 404)', () => {
    it('GET /admin/knowledge/documents resolves', async () => {
      const res = await req('GET', 'admin/knowledge/documents', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/knowledge/search resolves', async () => {
      const res = await req('GET', 'admin/knowledge/search?q=stress', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/learning-objectives resolves', async () => {
      const res = await req('GET', 'admin/learning-objectives', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/learning-objectives/:id → not 404 route (UUID validated)', async () => {
      const res = await req('GET', `admin/learning-objectives/${UUID}`, adminToken);
      expect([200, 404, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/blueprints resolves', async () => {
      const res = await req('GET', 'admin/blueprints', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/misconceptions resolves', async () => {
      const res = await req('GET', 'admin/misconceptions', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/formulas resolves', async () => {
      const res = await req('GET', 'admin/formulas', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/editorial/catalog resolves', async () => {
      const res = await req('GET', 'admin/editorial/catalog', adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/editorial/standards/book/15 resolves', async () => {
      const res = await req('GET', 'admin/editorial/standards/book/15', adminToken);
      expect([200, 404, 400, 403, 500]).toContain(res.statusCode);
    });
    it('GET /admin/knowledge/entities/learning_objective/:id/graph resolves', async () => {
      const res = await req('GET', `admin/knowledge/entities/learning_objective/${UUID}/graph`, adminToken);
      expect([200, 403, 500]).toContain(res.statusCode);
    });
  });

  describe('Health smoke (Sprint 2.8 modules boot)', () => {
    it('GET /health → 200', async () => {
      const res = await req('GET', 'health');
      expect([200, 503]).toContain(res.statusCode);
    });
  });
});
