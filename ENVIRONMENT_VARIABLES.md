# CE Board Master — Environment Variables Reference

**Version:** 1.0.0

Every variable read by the backend, validated by the Zod schema in
`apps/api/src/config/configuration.ts`. The app fails fast at boot if a
**required** variable is missing or malformed.

Generate strong secrets:
```bash
# RS256 JWT key pair
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private.pem -out public.pem
# 32+ char secrets (COOKIE_SECRET, ARGON2_PEPPER)
openssl rand -base64 48
```

## Required at boot (8)

Without these the backend will not start.

| Variable | Type | Notes |
|----------|------|-------|
| `FRONTEND_URL` | url | Public web app URL |
| `CORS_ORIGINS` | string | Comma-separated allowed origins (your Vercel domain) |
| `DATABASE_URL` | string | PostgreSQL connection string (Render auto-wires this) |
| `JWT_PRIVATE_KEY` | string | RS256 private key PEM (literal \n for newlines) |
| `JWT_PUBLIC_KEY` | string | RS256 public key PEM |
| `EMAIL_FROM` | email | Sender address for transactional email |
| `ARGON2_PEPPER` | string |  |
| `COOKIE_SECRET` | string | ≥32 chars; signs the refresh cookie (Render generates) |

## Optional (60)

Have safe defaults or gate an integration that stays inactive until set.

| Variable | Type | Default | Group |
|----------|------|---------|-------|
| `NODE_ENV` | enum: development, test, staging, production | `development` | Application |
| `PORT` | number | `3001` | Application |
| `API_PREFIX` | string | `api/v1` | Application |
| `APP_NAME` | string | `CE Board Master API` | Application |
| `APP_VERSION` | string | `1.0.0` | Application |
| `APP_URL` | url | `(optional)` | Application |
| `ADMIN_URL` | url | `(optional)` | Application |
| `DATABASE_POOL_URL` | string | `(optional)` | Application |
| `DATABASE_ANALYTICS_URL` | string | `(optional)` | Application |
| `REDIS_HOST` | string | `localhost` | Redis |
| `REDIS_PORT` | number | `6379` | Redis |
| `REDIS_PASSWORD` | string | `(optional)` | Redis |
| `REDIS_TLS` | boolean | `false` | Redis |
| `REDIS_DB_CACHE` | number | `0` | Redis |
| `REDIS_DB_QUEUE` | number | `1` | Redis |
| `REDIS_DB_SESSION` | number | `2` | Redis |
| `REDIS_DEFAULT_TTL` | number | `300` | Redis |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | number | `900` | JWT |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | number | `2592000` | JWT |
| `GOOGLE_CLIENT_ID` | string | `(optional)` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | string | `(optional)` | Google OAuth |
| `GOOGLE_CALLBACK_URL` | url | `(optional)` | Google OAuth |
| `AWS_REGION` | string | `ap-southeast-1` | AWS |
| `AWS_ACCESS_KEY_ID` | string | `(optional)` | AWS |
| `AWS_SECRET_ACCESS_KEY` | string | `(optional)` | AWS |
| `AWS_S3_BUCKET` | string | `(optional)` | AWS |
| `AWS_S3_PRESIGN_EXPIRY` | number | `900` | AWS |
| `CDN_DOMAIN` | url | `(optional)` | AWS |
| `STRIPE_SECRET_KEY` | string | `(optional)` | Stripe |
| `STRIPE_WEBHOOK_SECRET` | string | `(optional)` | Stripe |
| `STRIPE_PRICE_BASIC_MONTHLY` | string | `(optional)` | Stripe |
| `STRIPE_PRICE_BASIC_ANNUAL` | string | `(optional)` | Stripe |
| `STRIPE_PRICE_PRO_MONTHLY` | string | `(optional)` | Stripe |
| `STRIPE_PRICE_PRO_ANNUAL` | string | `(optional)` | Stripe |
| `PAYMONGO_SECRET_KEY` | string | `(optional)` | PayMongo |
| `PAYMONGO_PUBLIC_KEY` | string | `(optional)` | PayMongo |
| `PAYMONGO_WEBHOOK_SECRET` | string | `(optional)` | PayMongo |
| `XENDIT_SECRET_KEY` | string | `(optional)` | Xendit (Sprint 2.5) |
| `XENDIT_WEBHOOK_TOKEN` | string | `(optional)` | Xendit (Sprint 2.5) |
| `PAYMENT_DEFAULT_PROVIDER` | enum: paymongo, xendit, mock | `mock` | Payment provider selection (Sprint 2.5) |
| `PAYMENT_GRACE_PERIOD_DAYS` | number | `3` | Payment provider selection (Sprint 2.5) |
| `PAYMENT_CURRENCY` | string | `PHP` | Payment provider selection (Sprint 2.5) |
| `ANTHROPIC_API_KEY` | string | `(optional)` | Anthropic |
| `ANTHROPIC_MODEL` | string | `claude-sonnet-4-6` | Anthropic |
| `ANTHROPIC_MAX_TOKENS` | number | `4096` | Anthropic |
| `AI_TUTOR_DAILY_LIMIT` | number | `50` | Anthropic |
| `RESEND_API_KEY` | string | `(optional)` | Resend (Email) |
| `EMAIL_FROM_NAME` | string | `CE Board Master` | Resend (Email) |
| `RATE_LIMIT_GLOBAL` | number | `120` | Rate Limiting |
| `RATE_LIMIT_AUTH` | number | `10` | Rate Limiting |
| `RATE_LIMIT_PUBLIC` | number | `20` | Rate Limiting |
| `LOG_LEVEL` | enum: fatal, error, warn, info, debug, trace | `info` | Logging |
| `LOG_PRETTY` | boolean | `false` | Logging |
| `HEALTH_DB_THRESHOLD_MS` | number | `200` | Health Check |
| `HEALTH_REDIS_THRESHOLD_MS` | number | `50` | Health Check |
| `SWAGGER_ENABLED` | boolean | `true` | Swagger |
| `SWAGGER_PATH` | string | `docs` | Swagger |
| `QUEUE_CONCURRENCY_EMAIL` | number | `5` | Queue |
| `QUEUE_CONCURRENCY_ANALYTICS` | number | `10` | Queue |
| `QUEUE_CONCURRENCY_AI_CONTENT` | number | `3` | Queue |

## Frontend (Vercel)

| Variable | Purpose |
|----------|--------|
| `API_PROXY_TARGET` | Backend origin the Next.js rewrite proxies to (e.g. `https://ceboard-api.onrender.com`) |
| `NEXT_PUBLIC_API_URL` | Browser API base; keep as `/api/backend` (same-origin proxy) |
| `NEXT_PUBLIC_APP_NAME` | Display name (optional) |
