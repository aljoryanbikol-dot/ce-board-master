/**
 * @file exam-session.controller.ts
 * @module Exams/Controllers
 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ExamSessionService } from '../services/exam-session.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { SaveAnswerSchema, BookmarkExamQuestionSchema, SaveAnswerDtoClass, BookmarkExamQuestionDtoClass } from '../dto/exam.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Exams — Session')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.EXAM_TAKE)
@Controller('exams')
export class ExamSessionController {
  constructor(private readonly session: ExamSessionService) {}

  @Get('resume')
  @ApiOperation({ summary: 'Resume the most recent interrupted (in-progress/paused) exam' })
  async resumeInterrupted(@CurrentUser() user: AuthenticatedUser) {
    return this.session.resumeInterrupted(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exam header + timer state' })
  @ApiParam({ name: 'id' })
  async getExam(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.session.getExam(user.id, id);
  }

  @Get(':id/questions')
  @ApiOperation({ summary: 'Get the presented exam questions (randomized choices)' })
  @ApiParam({ name: 'id' })
  async getQuestions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.session.getQuestions(user.id, id);
  }

  @Post(':id/begin')
  @ApiOperation({ summary: 'Begin the exam (start the timer)' })
  @ApiParam({ name: 'id' })
  async begin(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.session.begin(user.id, id);
  }

  @Post(':id/answers')
  @ApiOperation({ summary: 'Autosave an answer' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: SaveAnswerDtoClass })
  async saveAnswer(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(SaveAnswerSchema)) body: typeof SaveAnswerSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.session.saveAnswer(user.id, id, body);
  }

  @Post(':id/bookmark')
  @ApiOperation({ summary: 'Bookmark/unbookmark an exam question' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: BookmarkExamQuestionDtoClass })
  async bookmark(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(BookmarkExamQuestionSchema)) body: typeof BookmarkExamQuestionSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.session.bookmark(user.id, id, body.examQuestionId, body.bookmarked);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause the exam' })
  @ApiParam({ name: 'id' })
  async pause(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.session.pause(user.id, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused exam' })
  @ApiParam({ name: 'id' })
  async resume(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.session.resume(user.id, id);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit the exam (grades and returns the result)' })
  @ApiParam({ name: 'id' })
  async submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.session.submit(user.id, id);
  }
}
