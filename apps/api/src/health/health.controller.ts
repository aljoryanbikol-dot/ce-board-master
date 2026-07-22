/**
 * @file health.controller.ts
 * @module Health
 *
 * Health check endpoints per API Contract (Phase 4, Group 26).
 *
 * Both endpoints are decorated with @Public() so they bypass JwtAuthGuard.
 * The /health/detailed endpoint would be IP-restricted at Cloudflare/ALB
 * level in production rather than requiring a JWT (health checks run before
 * auth infrastructure is confirmed healthy).
 *
 * GET /api/v1/health         — Public: for ALB + Pingdom uptime monitoring
 * GET /api/v1/health/detailed — Public + IP restricted: for Datadog dashboards
 */
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { AppEnvironment } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
// Render's platform probe hits /health every ~5s from a single internal IP.
// The global ThrottlerGuard was rate-limiting those probes to 429, which the
// platform treats as an unhealthy instance and responds by restarting the
// service — an up/down flap loop. Health checks must never be throttled.
//
// IMPORTANT: the throttlers are NAMED ('global' and 'auth' in app.module.ts),
// and a bare @SkipThrottle() only sets { default: true } — which matches no
// configured throttler and therefore skips nothing. Each named throttler must
// be exempted explicitly.
@SkipThrottle({ global: true, auth: true })
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memoryHealth: MemoryHealthIndicator,
    private readonly diskHealth: DiskHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnvironment>,
  ) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @HealthCheck()
  @ApiOperation({ summary: 'Basic health check — used by AWS ALB target group' })
  @ApiResponse({ status: 200, description: 'All critical systems healthy' })
  @ApiResponse({ status: 503, description: 'One or more critical systems unhealthy' })
  async check() {
    // The configured threshold assumes a warm, always-on instance. On a
    // serverless cold start the very first query also pays connection setup,
    // which routinely exceeds it — reporting the whole platform "down" while
    // every real endpoint answers fine. Give the ping a floor generous enough
    // to cover that one-off cost.
    const configured = this.config.get('HEALTH_DB_THRESHOLD_MS', { infer: true }) ?? 200;
    const dbThreshold = Math.max(configured, 5_000);
    const version = this.config.get('APP_VERSION', { infer: true });

    const result = await this.health.check([
      (): Promise<HealthIndicatorResult> =>
        this.prismaHealth.pingCheck('database', this.prisma, { timeout: dbThreshold }),
      (): Promise<HealthIndicatorResult> =>
        this.memoryHealth.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);

    return { ...result, version, timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  @HealthCheck()
  @ApiOperation({ summary: 'Detailed health check — for admin monitoring dashboards' })
  async checkDetailed() {
    const version = this.config.get('APP_VERSION', { infer: true });

    const result = await this.health.check([
      (): Promise<HealthIndicatorResult> =>
        this.prismaHealth.pingCheck('database', this.prisma, { timeout: 5_000 }),
      (): Promise<HealthIndicatorResult> =>
        this.memoryHealth.checkHeap('memory_heap', 512 * 1024 * 1024),
      (): Promise<HealthIndicatorResult> =>
        this.memoryHealth.checkRSS('memory_rss', 1024 * 1024 * 1024),
      (): Promise<HealthIndicatorResult> =>
        this.diskHealth.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
    ]);

    return {
      ...result,
      version,
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
