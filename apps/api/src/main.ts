/**
 * CE Board Master — API Application Bootstrap
 *
 * This is the entry point for the NestJS application.
 *
 * Configuration sequence (order matters):
 * 1. Create NestJS app with Fastify HTTP adapter (2x faster than Express)
 * 2. Configure Pino structured logging
 * 3. Apply global security middleware (Helmet, CORS, Compression)
 * 4. Register global pipes, filters, and interceptors
 * 5. Configure Swagger API documentation
 * 6. Start listening on configured port
 *
 * Architecture decisions:
 * - Fastify over Express: ~2x throughput improvement under load, critical for
 *   exam sessions with concurrent answer submissions.
 * - Pino over Winston/Morgan: ~5x faster logging, JSON output for Datadog.
 * - Global exception filter registered via useGlobalFilters (not as NestJS
 *   provider) to ensure it catches errors from all lifecycle events.
 *
 * Security hardening applied at bootstrap level (not via modules):
 * - Helmet: Sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
 * - CORS: Restricts cross-origin requests to CORS_ORIGINS env variable
 * - Compression: gzip for responses > 1KB
 * - Body size limit: 10MB (allows bulk question imports)
 */
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import compression from '@fastify/compress';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import pino from 'pino';
import { AppModule } from './app.module';
import { registerWebhookRawBodyParser } from './payments/webhooks/raw-body.plugin';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import type { AppEnvironment } from './config/configuration';

async function bootstrap(): Promise<void> {
  // ── Create logger (used before NestJS logger is available) ───────────────
  const logger = pino({
    level: process.env['LOG_LEVEL'] || 'info',
    ...(process.env['LOG_PRETTY'] === 'true'
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
  });

  // ── Create NestJS application with Fastify ───────────────────────────────
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger,
      // Fastify body size limit: 10MB for bulk CSV imports
      bodyLimit: 10 * 1024 * 1024,
      // Trust X-Forwarded-For from ALB/Cloudflare (for accurate IP logging)
      trustProxy: true,
    }),
    {
      // Suppress NestJS's default logger — Pino via Fastify handles all logging
      bufferLogs: true,
      // We register our own application/json content-type parser below
      // (registerWebhookRawBodyParser) to capture the raw body for webhook
      // signature verification. Disable Nest's default body parser so it does
      // not register a second application/json parser, which Fastify rejects
      // with FST_ERR_CTP_ALREADY_PRESENT. This is a JSON-only API.
      bodyParser: false,
    },
  );

  const config = app.get(ConfigService<AppEnvironment>);
  const isDevelopment = config.get('NODE_ENV', { infer: true }) === 'development';

  // ── Webhook raw-body capture ─────────────────────────────────────────────
  // Payment providers sign the exact request bytes. Register a content-type
  // parser that preserves the raw body on webhook routes so HMAC verification
  // hashes the identical bytes the provider hashed. MUST run before listen.
  registerWebhookRawBodyParser(app.getHttpAdapter().getInstance());
  const port = config.get('PORT', { infer: true })!;
  const apiPrefix = config.get('API_PREFIX', { infer: true })!;
  const corsOrigins = config
    .get('CORS_ORIGINS', { infer: true })!
    .split(',')
    .map((o: string) => o.trim());

  // ── Security middleware ──────────────────────────────────────────────────
  // Helmet: Sets security headers (CSP, HSTS, X-Frame-Options, etc.)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://cdn.ce-boardmaster.ph'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    // HSTS: 1 year, include subdomains
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // CORS: Only allow configured origins
  app.enableCors({
    origin: isDevelopment ? true : corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'x-idempotency-key',
    ],
    exposedHeaders: ['x-request-id'],
    credentials: true, // Required for httpOnly cookie refresh tokens
    maxAge: 86400, // Cache preflight for 24 hours
  });

  // Compression: gzip/brotli for responses > 1KB
  await app.register(compression, {
    encodings: ['gzip', 'deflate'],
  });

  // Cookie parsing/signing: required for the httpOnly refresh-token cookie
  // (reply.setCookie / request.cookies). Secret signs cookies for tamper-evidence.
  await app.register(cookie, {
    secret: config.get('COOKIE_SECRET', { infer: true }) as string,
    parseOptions: {},
  });

  // ── API prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix, {
    // Health check is at /api/v1/health, not /health
    // Exclude nothing — all routes under /api/v1
  });

  // ── Global pipes, filters, and interceptors ──────────────────────────────
  const httpAdapterHost = app.get(HttpAdapterHost);

  // Order of execution: Guard → Interceptor → Pipe → Handler → Interceptor → Filter
  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
  app.useGlobalPipes(
    new ZodValidationPipe(), // Global fallback; individual endpoints use specific schemas
  );

  // ── Swagger API Documentation ────────────────────────────────────────────
  const swaggerEnabled = config.get('SWAGGER_ENABLED', { infer: true });
  const swaggerPath = config.get('SWAGGER_PATH', { infer: true })!;

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CE Board Master API')
      .setDescription(
        `
        ## CE Board Master REST API v1

        The official backend API for the CE Board Master Philippine Civil Engineering
        Licensure Examination reviewer platform.

        ### Authentication
        - **JWT Bearer Token**: Include \`Authorization: Bearer <accessToken>\` on all protected endpoints.
        - **Refresh Token**: Sent as httpOnly cookie. Use \`POST /auth/refresh\` to rotate.

        ### Response Format
        All responses follow the standard envelope:
        \`\`\`json
        {
          "data": { ... },
          "meta": { "timestamp": "...", "requestId": "..." }
        }
        \`\`\`

        ### Governed by
        CE Board Master Project Constitution — Article XVII (API Standards)

        **Note:** This API is not affiliated with the Professional Regulation Commission (PRC).
        `,
      )
      .setVersion('1.0.0')
      .setContact('CE Board Master Engineering', '', 'engineering@ce-boardmaster.ph')
      .setLicense('Proprietary', '')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter the JWT access token from POST /auth/login',
        },
        'access-token',
      )
      .addCookieAuth('refreshToken', {
        type: 'apiKey',
        in: 'cookie',
        description: 'httpOnly refresh token cookie (set automatically by /auth/login)',
      })
      .addTag('Auth', 'Authentication and token management')
      .addTag('Users', 'User account management')
      .addTag('Profiles', 'Extended user profile')
      .addTag('Subjects', 'Subject taxonomy')
      .addTag('Questions', 'Question bank')
      .addTag('Study', 'Study sessions and answer submission')
      .addTag('Exams', 'Mock examination sessions')
      .addTag('Analytics', 'Performance analytics')
      .addTag('AI Tutor', 'Claude-powered AI study companion')
      .addTag('Subscriptions', 'Subscription plan management')
      .addTag('Payments', 'Payment processing')
      .addTag('Notifications', 'In-app and push notifications')
      .addTag('Admin', 'Content and platform administration')
      .addTag('Search', 'Full-text search')
      .addTag('Uploads', 'File upload management')
      .addTag('Health', 'System health checks')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'CE Board Master API Docs',
    });

    logger.info(
      `📚 Swagger docs: http://localhost:${port}/${swaggerPath}`,
    );
  }

  // ── Enable graceful shutdown ─────────────────────────────────────────────
  // Allows ECS to drain connections before stopping the container
  app.enableShutdownHooks();

  // ── Start server ─────────────────────────────────────────────────────────
  await app.listen(port, '0.0.0.0');

  logger.info(`
  ╔════════════════════════════════════════╗
  ║     CE Board Master API v1.0.0         ║
  ╠════════════════════════════════════════╣
  ║  Environment: ${config.get('NODE_ENV', { infer: true })!.padEnd(25)}║
  ║  Port:        ${String(port).padEnd(25)}║
  ║  API Prefix:  ${('/'+apiPrefix).padEnd(25)}║
  ║  Swagger:     ${(swaggerEnabled ? 'Enabled' : 'Disabled').padEnd(25)}║
  ╚════════════════════════════════════════╝
  `);
}

// Handle unhandled rejections at process level (safety net)
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

bootstrap().catch((error: unknown) => {
  console.error('Failed to start CE Board Master API:', error);
  process.exit(1);
});
