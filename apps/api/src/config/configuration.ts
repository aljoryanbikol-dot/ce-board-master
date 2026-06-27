/**
 * CE Board Master — Configuration Module
 *
 * Centralizes all environment variable access with Zod validation.
 * Every value is validated at startup — the application fails immediately
 * if a required environment variable is missing or invalid.
 *
 * Architecture decision (ADR-004): We use @nestjs/config with a typed
 * configuration factory rather than direct process.env access. This
 * ensures type safety and early-fail validation behavior.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Environment schema — validated at application bootstrap
// ---------------------------------------------------------------------------
const EnvironmentSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().min(1024).max(65535).default(3001),
  API_PREFIX: z.string().default('api/v1'),
  APP_NAME: z.string().default('CE Board Master API'),
  APP_VERSION: z.string().default('1.0.0'),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  ADMIN_URL: z.string().url(),
  CORS_ORIGINS: z.string(),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_URL: z.string().min(1),
  DATABASE_ANALYTICS_URL: z.string().min(1),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.coerce.boolean().default(false),
  REDIS_DB_CACHE: z.coerce.number().default(0),
  REDIS_DB_QUEUE: z.coerce.number().default(1),
  REDIS_DB_SESSION: z.coerce.number().default(2),
  REDIS_DEFAULT_TTL: z.coerce.number().default(300),

  // JWT
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ACCESS_TOKEN_EXPIRES_IN: z.coerce.number().default(900),
  JWT_REFRESH_TOKEN_EXPIRES_IN: z.coerce.number().default(2592000),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // AWS
  AWS_REGION: z.string().default('ap-southeast-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_S3_PRESIGN_EXPIRY: z.coerce.number().default(900),
  CDN_DOMAIN: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_BASIC_MONTHLY: z.string().min(1),
  STRIPE_PRICE_BASIC_ANNUAL: z.string().min(1),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1),
  STRIPE_PRICE_PRO_ANNUAL: z.string().min(1),

  // PayMongo
  PAYMONGO_SECRET_KEY: z.string().min(1),
  PAYMONGO_PUBLIC_KEY: z.string().min(1),
  PAYMONGO_WEBHOOK_SECRET: z.string().min(1),

  // Xendit (Sprint 2.5)
  XENDIT_SECRET_KEY: z.string().min(1).optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().min(1).optional(),

  // Payment provider selection (Sprint 2.5)
  PAYMENT_DEFAULT_PROVIDER: z.enum(['paymongo', 'xendit', 'mock']).default('mock'),
  PAYMENT_GRACE_PERIOD_DAYS: z.coerce.number().default(3),
  PAYMENT_CURRENCY: z.string().default('PHP'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().default(4096),
  AI_TUTOR_DAILY_LIMIT: z.coerce.number().default(50),

  // Resend (Email)
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().default('CE Board Master'),

  // Rate Limiting
  RATE_LIMIT_GLOBAL: z.coerce.number().default(120),
  RATE_LIMIT_AUTH: z.coerce.number().default(10),
  RATE_LIMIT_PUBLIC: z.coerce.number().default(20),

  // Security
  ARGON2_PEPPER: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),

  // Health Check
  HEALTH_DB_THRESHOLD_MS: z.coerce.number().default(200),
  HEALTH_REDIS_THRESHOLD_MS: z.coerce.number().default(50),

  // Swagger
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
  SWAGGER_PATH: z.string().default('docs'),

  // Queue
  QUEUE_CONCURRENCY_EMAIL: z.coerce.number().default(5),
  QUEUE_CONCURRENCY_ANALYTICS: z.coerce.number().default(10),
  QUEUE_CONCURRENCY_AI_CONTENT: z.coerce.number().default(3),
});

// ---------------------------------------------------------------------------
// Exported configuration factory (consumed by @nestjs/config)
// ---------------------------------------------------------------------------
export type AppEnvironment = z.infer<typeof EnvironmentSchema>;

export default (): AppEnvironment => {
  // Parse and validate — throws ZodError at startup if invalid
  const result = EnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(
      `\n\n❌ Invalid environment variables:\n${errors}\n\n` +
        'Copy .env.example to .env and fill in all required values.\n',
    );
  }

  return result.data;
};
