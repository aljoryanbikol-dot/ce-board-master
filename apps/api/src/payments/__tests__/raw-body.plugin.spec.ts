/**
 * @file raw-body.plugin.spec.ts
 * @module Payments/Webhooks/Tests
 *
 * Tests the raw-body content-type parser against a real Fastify instance using
 * fastify.inject(). This is the critical guard against silent production
 * webhook signature failures, so it is tested end-to-end through the parser.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import {
  registerWebhookRawBodyParser,
  WEBHOOK_BODY_LIMIT,
} from '../webhooks/raw-body.plugin';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  registerWebhookRawBodyParser(app);

  // A webhook route echoes back what the parser captured.
  app.post('/api/v1/payments/webhooks/mock', (req: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      rawBody: (req as { rawBody?: string }).rawBody ?? null,
      parsed: req.body,
    });
  });

  // A non-webhook route should parse JSON but NOT capture a raw body.
  app.post('/api/v1/users', (req: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      rawBody: (req as { rawBody?: string }).rawBody ?? null,
      parsed: req.body,
    });
  });

  await app.ready();
  return app;
}

describe('registerWebhookRawBodyParser', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  it('captures the exact raw bytes on a webhook route', async () => {
    // Deliberately unusual key order + spacing the provider might send.
    const raw = '{"z":1,"a":  2,"é":"ñ"}';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/mock',
      headers: { 'content-type': 'application/json' },
      payload: raw,
    });
    const body = res.json();
    // The captured raw body must be byte-identical to what was sent — NOT a
    // re-serialization (which would reorder keys and drop the spacing).
    expect(body.rawBody).toBe(raw);
    expect(body.parsed).toEqual({ z: 1, a: 2, 'é': 'ñ' });
  });

  it('still parses JSON so @Body() keeps working on webhook routes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/mock',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ type: 'payment.paid' }),
    });
    expect(res.json().parsed).toEqual({ type: 'payment.paid' });
  });

  it('does NOT capture a raw body on non-webhook routes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'a@b.com' }),
    });
    const body = res.json();
    expect(body.rawBody).toBeNull();          // not captured
    expect(body.parsed).toEqual({ email: 'a@b.com' }); // but still parsed
  });

  it('treats an empty body as an empty object', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/mock',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().parsed).toEqual({});
    expect(res.json().rawBody).toBe('');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/mock',
      headers: { 'content-type': 'application/json' },
      payload: '{not valid json',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an over-limit webhook body with 413', async () => {
    const huge = JSON.stringify({ blob: 'x'.repeat(WEBHOOK_BODY_LIMIT + 100) });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/mock',
      headers: { 'content-type': 'application/json' },
      payload: huge,
    });
    expect(res.statusCode).toBe(413);
  });

  it('preserves bytes that JSON.stringify would alter (regression guard)', async () => {
    // Forward-slash and unicode escaping: providers send "\/" and raw unicode;
    // a naive re-stringify would normalize these, breaking the HMAC.
    const raw = '{"url":"https:\\/\\/x.test\\/cb","emoji":"\\u2728"}';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/mock',
      headers: { 'content-type': 'application/json' },
      payload: raw,
    });
    expect(res.json().rawBody).toBe(raw);
    // And re-serializing the parsed object would NOT match — proving why we
    // must keep the raw bytes.
    expect(JSON.stringify(res.json().parsed)).not.toBe(raw);
  });
});
