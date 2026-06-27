/**
 * @file practice.controller.ts
 * @module Student/Controllers
 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PracticeSessionService } from '../services/practice-session.service';
import { QuestionRecommendationService } from '../services/question-recommendation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import {
  StartPracticeSchema, SubmitAnswerSchema, PaginationSchema, RecommendationQuerySchema,
  StartPracticeDtoClass, SubmitAnswerDtoClass,
} from '../dto/student.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Student — Practice')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.STUDENT_PRACTICE)
@Controller('student/practice')
export class PracticeController {
  constructor(
    private readonly practice: PracticeSessionService,
    private readonly recommendations: QuestionRecommendationService,
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Start a practice session (by subject/topic/LO/blueprint/difficulty/recommended)' })
  @ApiBody({ type: StartPracticeDtoClass })
  async start(@Body(new ZodValidationPipe(StartPracticeSchema)) body: typeof StartPracticeSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.practice.start(user.id, body);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List the student\'s practice sessions' })
  async listSessions(@Query(new ZodValidationPipe(PaginationSchema)) q: typeof PaginationSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.practice.listSessions(user.id, q.limit, q.cursor);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a practice session (ownership-checked)' })
  @ApiParam({ name: 'id' })
  async getSession(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.practice.getSession(user.id, id);
  }

  @Post('sessions/:id/answers')
  @ApiOperation({ summary: 'Submit an answer within a session' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: SubmitAnswerDtoClass })
  async answerInSession(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(SubmitAnswerSchema)) body: typeof SubmitAnswerSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.practice.submitAnswer(user.id, id, body);
  }

  @Post('answers')
  @ApiOperation({ summary: 'Submit a standalone answer (no session)' })
  @ApiBody({ type: SubmitAnswerDtoClass })
  async answer(@Body(new ZodValidationPipe(SubmitAnswerSchema)) body: typeof SubmitAnswerSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.practice.submitAnswer(user.id, null, body);
  }

  @Post('sessions/:id/complete')
  @ApiOperation({ summary: 'Complete a practice session' })
  @ApiParam({ name: 'id' })
  async complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.practice.complete(user.id, id);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Personalized question recommendations' })
  async recommend(@Query(new ZodValidationPipe(RecommendationQuerySchema)) q: typeof RecommendationQuerySchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.recommendations.recommend(user.id, { limit: q.limit, subjectId: q.subjectId });
  }
}
