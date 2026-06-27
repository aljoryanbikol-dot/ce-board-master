/**
 * @file recommendation.controller.ts
 * @module AITutor/Controllers
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecommendationService } from '../services/recommendation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { CoachingQuerySchema } from '../dto/tutor.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('AI Tutor — Recommendations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.TUTOR_COACHING)
@Controller('tutor/recommendations')
export class RecommendationController {
  constructor(private readonly recommendations: RecommendationService) {}

  @Get()
  @ApiOperation({ summary: 'Smart study/practice recommendations (weak-topic aware)' })
  async smart(@Query(new ZodValidationPipe(CoachingQuerySchema)) q: typeof CoachingQuerySchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.recommendations.smartRecommendations(user.id, { limit: q.limit });
  }
}
