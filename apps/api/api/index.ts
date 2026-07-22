/**
 * @file api/index.ts — Vercel serverless entry point for the NestJS API.
 *
 * Render's free tier suspends the service once the monthly instance-hour quota
 * is exhausted, which takes the whole platform down. Vercel's Hobby tier bills
 * per invocation instead of per running hour, so the API can stay reachable
 * without a card. This entry bootstraps the same Nest application used by
 * `src/main.ts` and hands each request to Fastify's underlying HTTP server.
 *
 * Serverless specifics:
 * - The Nest app is created once per warm container and memoised in module
 *   scope; only the first request in a cold container pays the bootstrap cost.
 * - `fastify.ready()` must resolve before requests are emitted, otherwise
 *   plugins (cookie, helmet, raw-body parser) are not yet mounted.
 * - Prisma must use Neon's POOLED connection string here: every warm container
 *   holds its own client, and the direct endpoint exhausts connections fast.
 * - BullMQ workers cannot run in a serverless container (no long-lived
 *   process). Queue producers still enqueue; delivery resumes when a worker
 *   host exists again.
 */
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { AppModule } from '../src/app.module';
import { registerWebhookRawBodyParser } from '../src/payments/webhooks/raw-body.plugin';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import type { AppEnvironment } from '../src/config/configuration';
import type { IncomingMessage, ServerResponse } from 'http';

let cached: NestFastifyApplication | undefined;

async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: true,
      // Vercel terminates TLS and forwards the original path; keep Fastify's
      // own logger quiet so logs stay as single JSON lines in the dashboard.
      logger: false,
    }),
    { bufferLogs: true, bodyParser: false },
  );

  const config = app.get(ConfigService<AppEnvironment>);

  // Raw body capture for payment webhook signature verification — must be
  // registered before the server is ready.
  registerWebhookRawBodyParser(app.getHttpAdapter().getInstance());

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  });

  const corsOrigins = (config.get('CORS_ORIGINS', { infer: true }) ?? '')
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-idempotency-key'],
    exposedHeaders: ['x-request-id'],
    credentials: true,
    maxAge: 86400,
  });

  await app.register(cookie, {
    secret: config.get('COOKIE_SECRET', { infer: true }) as string,
    parseOptions: {},
  });

  app.setGlobalPrefix(config.get('API_PREFIX', { infer: true }) ?? 'api/v1');

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
  app.useGlobalPipes(new ZodValidationPipe());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** Vercel Node.js runtime handler. */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!cached) cached = await createApp();
  cached.getHttpAdapter().getInstance().server.emit('request', req, res);
}

// Deployment marker: redeploy to pick up the corrected JWT key pair.
