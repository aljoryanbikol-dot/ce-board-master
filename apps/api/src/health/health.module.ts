/**
 * HealthModule — System health checks for load balancer and monitoring.
 *
 * Endpoints (per API Contract Phase 4, Group 26):
 *   GET /api/v1/health          — Public: basic ALB health check
 *   GET /api/v1/health/detailed — Admin: full component status
 *
 * Uses @nestjs/terminus which provides:
 * - PrismaHealthIndicator: database connectivity check
 * - MemoryHealthIndicator: heap and RSS memory checks
 * - DiskHealthIndicator: storage availability check
 *
 * DatabaseModule is @Global() and auto-available — no re-import needed.
 *
 * Per Software Architecture (Phase 3B, Section 27):
 * - /health checked every 60 seconds by Pingdom from Singapore PoP
 * - Returns 503 if any critical check fails
 * - ALB removes ECS task from rotation on 2 consecutive 503 responses
 */
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TerminusModule.forRoot({
      // Log health check errors as structured JSON so they're queryable in
      // the log pipeline (Datadog/CloudWatch) rather than pretty-printed.
      errorLogStyle: 'json',
      // Grace period: allow 30s for the app to fully initialize before
      // health checks are considered authoritative
      gracefulShutdownTimeoutMs: 5_000,
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
