/**
 * @file dashboard.controller.ts
 * @module Dashboard/Controllers
 *
 * DashboardController — Admin CMS dashboard endpoints. Base: /api/v1/admin/dashboard.
 * Guarded by auth + role + permission (cms.access). Thin: delegates to
 * DashboardService; zero Prisma, zero business logic.
 */
import { Controller, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DashboardService } from '../services/dashboard.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { CMS_QUEUES, type CmsQueue } from '../../cms/constants/cms.constants';
import { CmsErrors } from '../../cms/cms.errors';
import type { AuthenticatedUser } from '../../auth/auth.types';

const CMS_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...CMS_ROLES)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full dashboard overview (counts, stats, queue, activity)' })
  async overview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getOverview(user);
  }

  @Get('counts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Question status counts' })
  async counts() {
    return this.dashboard.getCounts();
  }

  @Get('statistics/subjects')
  @ApiOperation({ summary: 'Per-subject question statistics' })
  async subjects() { return this.dashboard.getSubjectStatistics(); }

  @Get('statistics/topics')
  @ApiOperation({ summary: 'Per-topic question statistics' })
  async topics() { return this.dashboard.getTopicStatistics(); }

  @Get('statistics/authors')
  @ApiOperation({ summary: 'Per-author question statistics' })
  async authors() { return this.dashboard.getAuthorStatistics(); }

  @Get('statistics/reviewers')
  @ApiOperation({ summary: 'Per-reviewer question statistics' })
  async reviewers() { return this.dashboard.getReviewerStatistics(); }

  @Get('activity')
  @ApiOperation({ summary: 'Recent workflow activity' })
  async activity() { return this.dashboard.getRecentActivity(); }

  @Get('review-queue')
  @ApiOperation({ summary: 'Questions awaiting review (oldest first)' })
  async reviewQueue() { return this.dashboard.getReviewQueue(); }

  @Get('queues/:queue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'A CMS work queue', description: 'queue ∈ draft | review | publish | archive.' })
  @ApiParam({ name: 'queue', enum: Object.values(CMS_QUEUES) })
  async queue(@Param('queue') queue: string) {
    const valid = Object.values(CMS_QUEUES) as string[];
    if (!valid.includes(queue)) throw CmsErrors.bulkInvalid(`Unknown queue '${queue}'.`);
    return this.dashboard.getQueue(queue as CmsQueue);
  }
}
