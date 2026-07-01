/**
 * @file progress.controller.ts
 * @module Student/Controllers
 */
import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProgressTrackingService } from '../services/progress-tracking.service';
import { StudentStatisticsService } from '../services/student-statistics.service';
import { LearningPathService } from '../services/learning-path.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { AnalyticsQuerySchema } from '../dto/student.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { FeatureAccessService } from '../../subscriptions/services/feature-access.service';

@ApiTags('Student — Progress & Analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.STUDENT_PROGRESS)
@Controller('student/progress')
export class ProgressController {
  constructor(
    private readonly progress: ProgressTrackingService,
    private readonly statistics: StudentStatisticsService,
    private readonly learningPath: LearningPathService,
    private readonly featureAccess: FeatureAccessService,
  ) {}

  @Get('mastery')
  @ApiOperation({ summary: 'Per-topic mastery for the student' })
  async mastery(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.progress.masteryForUser(user.id);
  }

  @Get('weak-topics')
  @ApiOperation({ summary: 'Weak topics (low accuracy)' })
  async weak(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.progress.weakTopics(user.id, 10);
  }

  @Get('strong-topics')
  @ApiOperation({ summary: 'Strong topics (high accuracy)' })
  async strong(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.progress.strongTopics(user.id, 10);
  }

  @Get('knowledge-gaps')
  @ApiOperation({ summary: 'Detected knowledge gaps' })
  async gaps(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.progress.getKnowledgeGaps(user.id);
  }

  @Get('learning-path')
  @ApiOperation({ summary: 'Active learning path' })
  async getPath(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.learningPath.getActive(user.id);
  }

  @Post('learning-path/generate')
  @ApiOperation({ summary: 'Generate a fresh personalized learning path' })
  async generatePath(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.learningPath.generate(user.id);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Time-bucketed progress analytics (daily/weekly/monthly)' })
  async stats(@Query(new ZodValidationPipe(AnalyticsQuerySchema)) q: typeof AnalyticsQuerySchema._type, @CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.statistics.progress(user.id, q);
  }

  @Get('statistics/accuracy-speed')
  @ApiOperation({ summary: 'Accuracy and speed summary' })
  async accuracySpeed(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.statistics.accuracyAndSpeed(user.id);
  }

  @Get('statistics/distribution')
  @ApiOperation({ summary: 'Question distribution by subject and outcome' })
  async distribution(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.statistics.distribution(user.id);
  }

  @Get('statistics/heatmap')
  @ApiOperation({ summary: 'Mastery heatmap' })
  async heatmap(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.statistics.masteryHeatmap(user.id);
  }

  @Get('statistics/performance-history')
  @ApiOperation({ summary: 'Per-day accuracy trend' })
  async performanceHistory(@CurrentUser() user: AuthenticatedUser) {
    await this.featureAccess.assertAnalyticsAccess(user.id);
    return this.statistics.performanceHistory(user.id, 30);
  }
}
