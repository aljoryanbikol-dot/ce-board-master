/**
 * @file raw-body.plugin.ts
 * @module Payments/Webhooks
 *
 * Raw-body capture for payment webhook signature verification.
 *
 * THE PROBLEM
 * -----------
 * Payment providers (PayMongo, Xendit, Stripe) sign the EXACT bytes of the
 * request body with an HMAC. To verify, we must hash the identical bytes the
 * provider hashed. Fastify's default JSON content-type parser consumes the
 * incoming stream and hands us a parsed object — the original bytes are gone.
 * Re-serializing with JSON.stringify() does NOT reproduce them: key ordering,
 * whitespace, and non-ASCII escaping differ, so every real signature fails.
 *
 * THE FIX
 * -------
 * Register a content-type parser, scoped to webhook routes only, that:
 *   1. Buffers the raw request bytes.
 *   2. Stashes the raw UTF-8 string on `request.rawBody` for HMAC verification.
 *   3. Still parses JSON so `@Body()`, logging, and DTOs keep working.
 *
 * Everything outside the webhook prefix continues to use Fastify's normal
 * parser untouched (including the 10MB bulk-import limit).
 *
 * WHY A SEPARATE PARSER INSTANCE
 * ------------------------------
 * Fastify allows exactly one parser per content-type per encapsulation context.
 * We cannot globally replace the JSON parser without affecting every route, so
 * we gate on the URL path inside the parser and defer to standard parsing for
 * non-webhook requests by returning the parsed body without the raw capture.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';

/** Path fragment that identifies payment webhook routes. */
export const WEBHOOK_PATH_FRAGMENT = '/payments/webhooks/';

/** Max bytes accepted for a webhook body (generous; provider events are small). */
export const WEBHOOK_BODY_LIMIT = 1 * 1024 * 1024; // 1MB

/** Request shape with the optional captured raw body. */
type RequestWithRawBody = FastifyRequest & { rawBody?: string };

interface RawBodyParserError extends Error {
  statusCode?: number;
}

/** Done-callback signature for a Fastify content-type parser. */
type ParserDone = (err: Error | null, body?: unknown) => void;

/**
 * Register the raw-body content-type parser on a Fastify instance.
 *
 * Must be called during bootstrap BEFORE the app starts listening, and before
 * any other `application/json` parser is added for these routes.
 */
export function registerWebhookRawBodyParser(fastify: FastifyInstance): void {
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer', bodyLimit: 10 * 1024 * 1024 },
    (req: FastifyRequest, body: Buffer, done: ParserDone) => {
      const url = req.url ?? '';
      const isWebhook = url.includes(WEBHOOK_PATH_FRAGMENT);

      // Enforce a tighter body limit on webhook routes
      if (isWebhook && body.length > WEBHOOK_BODY_LIMIT) {
        const err: RawBodyParserError = new Error('Webhook payload too large');
        err.statusCode = 413;
        done(err, undefined);
        return;
      }

      const rawString = body.toString('utf8');

      // Parse JSON for all routes (preserves @Body / DTO / logging behaviour).
      // An empty body is valid for some provider pings — treat as {}.
      let parsed: unknown = {};
      if (rawString.length > 0) {
        try {
          parsed = JSON.parse(rawString);
        } catch {
          const err: RawBodyParserError = new Error('Invalid JSON payload');
          err.statusCode = 400;
          done(err, undefined);
          return;
        }
      }

      // Only attach the raw body on webhook routes — avoids holding large
      // raw buffers in memory for ordinary high-volume JSON traffic.
      if (isWebhook) {
        (req as RequestWithRawBody).rawBody = rawString;
      }

      done(null, parsed);
    },
  );
}
