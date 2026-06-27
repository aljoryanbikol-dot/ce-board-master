/**
 * @file exam-review.controller.ts
 * @module Exams/Controllers
 */
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ExamReviewService } from '../services/exam-review.service';
import { ExamRecommendationService } from '../services/exam-recommendation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { ReviewQuerySchema } from '../dto/exam.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Exams — Review')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.EXAM_REVIEW)
@Controller('exams')
export class ExamReviewController {
  constructor(
    private readonly review: ExamReviewService,
    private readonly recommendations: ExamRecommendationService,
  ) {}

  @Get(':id/review')
  @ApiOperation({ summary: 'Review exam answers (all/incorrect/bookmarked/skipped)' })
  @ApiParam({ name: 'id' })
  async getReview(@Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(ReviewQuerySchema)) q: typeof ReviewQuerySchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.review.review(user.id, id, q);
  }

  @Get(':id/recommendations')
  @ApiOperation({ summary: 'Post-exam recommendations (focused retake + practice)' })
  @ApiParam({ name: 'id' })
  async getRecommendations(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.recommendations.afterExam(user.id, id);
  }
}
