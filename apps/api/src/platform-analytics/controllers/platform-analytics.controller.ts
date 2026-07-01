/**
 * @file platform-analytics.controller.ts
 * @module PlatformAnalytics/Controllers
 *
 * PlatformAnalyticsController — admin-facing, platform-wide analytics.
 * Base path: /api/v1/admin/platform-analytics. Distinct from the existing
 * /admin/dashboard (content-ops stats) and /admin/analytics (being fixed
 * separately) routes — no overlap.
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAnalyticsService } from '../services/platform-analytics.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { PlatformAnalyticsQuerySchema, TopListQuerySchema } from '../dto/platform-analytics.dto';

const ADMIN_ROLES = [ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN] as const;

@ApiTags('Admin — Platform Analytics')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...ADMIN_ROLES)
@Permissions(PERM.ANALYTICS_VIEW)
@Controller('admin/platform-analytics')
export class PlatformAnalyticsController {
  constructor(private readonly analytics: PlatformAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform summary: users, tier split, usage totals, revenue' })
  async overview() {
    return this.analytics.overview();
  }

  @Get('user-growth')
  @ApiOperation({ summary: 'Signups over time' })
  async userGrowth(@Query(new ZodValidationPipe(PlatformAnalyticsQuerySchema)) q: typeof PlatformAnalyticsQuerySchema._type) {
    return this.analytics.userGrowth(q);
  }

  @Get('active-users')
  @ApiOperation({ summary: 'Active users over time (DAU/WAU/MAU depending on period)' })
  async activeUsers(@Query(new ZodValidationPipe(PlatformAnalyticsQuerySchema)) q: typeof PlatformAnalyticsQuerySchema._type) {
    return this.analytics.activeUsers(q);
  }

  @Get('tier-split')
  @ApiOperation({ summary: 'Free vs Premium user counts' })
  async tierSplit() {
    return this.analytics.tierSplit();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue: total (window), MRR, breakdown by plan' })
  async revenue(@Query('days') days?: string) {
    return this.analytics.revenue(days ? Number(days) : 30);
  }

  @Get('question-usage')
  @ApiOperation({ summary: 'Platform-wide question attempts over time' })
  async questionUsage(@Query(new ZodValidationPipe(PlatformAnalyticsQuerySchema)) q: typeof PlatformAnalyticsQuerySchema._type) {
    return this.analytics.questionUsage(q);
  }

  @Get('exam-usage')
  @ApiOperation({ summary: 'Platform-wide mock exams started/completed over time' })
  async examUsage(@Query(new ZodValidationPipe(PlatformAnalyticsQuerySchema)) q: typeof PlatformAnalyticsQuerySchema._type) {
    return this.analytics.examUsage(q);
  }

  @Get('ai-tutor-usage')
  @ApiOperation({ summary: 'Platform-wide AI Tutor conversations/messages over time' })
  async aiTutorUsage(@Query(new ZodValidationPipe(PlatformAnalyticsQuerySchema)) q: typeof PlatformAnalyticsQuerySchema._type) {
    return this.analytics.aiTutorUsage(q);
  }

  @Get('subject-performance')
  @ApiOperation({ summary: 'Aggregate accuracy per subject, all users' })
  async subjectPerformance() {
    return this.analytics.subjectPerformance();
  }

  @Get('hardest-questions')
  @ApiOperation({ summary: 'Lowest-accuracy questions platform-wide (min 5 attempts)' })
  async hardestQuestions(@Query(new ZodValidationPipe(TopListQuerySchema)) q: typeof TopListQuerySchema._type) {
    return this.analytics.hardestQuestions(q.limit);
  }

  @Get('hardest-topics')
  @ApiOperation({ summary: 'Lowest-accuracy topics platform-wide (min 10 attempts)' })
  async hardestTopics(@Query(new ZodValidationPipe(TopListQuerySchema)) q: typeof TopListQuerySchema._type) {
    return this.analytics.hardestTopics(q.limit);
  }

  @Get('retention')
  @ApiOperation({ summary: 'Day-1 / day-7 / day-30 return rate by signup cohort' })
  async retention() {
    return this.analytics.retention();
  }
}
