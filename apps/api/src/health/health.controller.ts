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
import type { AppEnvironment } from '@/config/configuration';
import { PrismaService } from '@/database/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
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
    const dbThreshold = this.config.get('HEALTH_DB_THRESHOLD_MS', { infer: true });
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
        this.prismaHealth.pingCheck('database', this.prisma, { timeout: 500 }),
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
