/**
 * @file coaching.controller.ts
 * @module AITutor/Controllers
 */
import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { LearningCoachService } from '../services/learning-coach.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { CoachingQuerySchema } from '../dto/tutor.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('AI Tutor — Learning Coach')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.TUTOR_COACHING)
@Controller('tutor/coaching')
export class CoachingController {
  constructor(private readonly coach: LearningCoachService) {}

  @Get()
  @ApiOperation({ summary: 'List coaching notes (prioritized)' })
  async list(@Query(new ZodValidationPipe(CoachingQuerySchema)) q: typeof CoachingQuerySchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.coach.listCoaching(user.id, { unreadOnly: q.unreadOnly, limit: q.limit });
  }

  @Post('generate')
  @ApiOperation({ summary: 'Regenerate coaching from the latest weak topics & gaps' })
  async generate(@CurrentUser() user: AuthenticatedUser) {
    return this.coach.generateCoaching(user.id);
  }

  @Post('from-exam/:examId')
  @ApiOperation({ summary: 'Generate coaching from a specific exam\'s mistakes' })
  @ApiParam({ name: 'examId' })
  async fromExam(@Param('examId', ParseUUIDPipe) examId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coach.coachFromExam(user.id, examId);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a coaching note as read' })
  @ApiParam({ name: 'id' })
  async markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coach.markRead(user.id, id);
  }

  @Post(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss a coaching note' })
  @ApiParam({ name: 'id' })
  async dismiss(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coach.dismiss(user.id, id);
  }
}
