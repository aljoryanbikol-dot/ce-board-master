/**
 * @file exam-analytics.controller.ts
 * @module Exams/Controllers
 */
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ExamAnalyticsService } from '../services/exam-analytics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { PaginationSchema, LeaderboardQuerySchema } from '../dto/exam.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Exams — Analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.EXAM_RESULTS)
@Controller('exams')
export class ExamAnalyticsController {
  constructor(private readonly analytics: ExamAnalyticsService) {}

  @Get('history')
  @ApiOperation({ summary: 'Exam history (paginated)' })
  async history(@Query(new ZodValidationPipe(PaginationSchema)) q: typeof PaginationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.history(user.id, q.limit, q.cursor);
  }

  @Get(':id/performance')
  @ApiOperation({ summary: 'Performance breakdown by subject/topic/learning objective' })
  @ApiParam({ name: 'id' })
  async performance(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.performance(user.id, id);
  }

  @Get(':id/analysis')
  @ApiOperation({ summary: 'Weakness & strength analysis' })
  @ApiParam({ name: 'id' })
  async analysis(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.weaknessStrength(user.id, id);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Leaderboard by exam score (optionally within a template)' })
  async leaderboard(@Query(new ZodValidationPipe(LeaderboardQuerySchema)) q: typeof LeaderboardQuerySchema._type) {
    return this.analytics.leaderboard(q.templateId, q.limit);
  }
}
