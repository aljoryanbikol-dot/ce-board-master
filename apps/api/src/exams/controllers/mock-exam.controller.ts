/**
 * @file mock-exam.controller.ts
 * @module Exams/Controllers
 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { MockExamService } from '../services/mock-exam.service';
import { ExamSessionService } from '../services/exam-session.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { CreateTemplateSchema, StartExamSchema, CreateTemplateDtoClass, StartExamDtoClass } from '../dto/exam.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Exams — Mock Exam & Templates')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('exams')
export class MockExamController {
  constructor(
    private readonly mockExam: MockExamService,
    private readonly session: ExamSessionService,
  ) {}

  @Post('templates')
  @Permissions(PERM.EXAM_MANAGE)
  @ApiOperation({ summary: 'Create a reusable exam template (composition blueprint)' })
  @ApiBody({ type: CreateTemplateDtoClass })
  async createTemplate(@Body(new ZodValidationPipe(CreateTemplateSchema)) body: typeof CreateTemplateSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.mockExam.createTemplate(user.id, body);
  }

  @Get('templates')
  @Permissions(PERM.EXAM_TAKE)
  @ApiOperation({ summary: 'List active exam templates' })
  async listTemplates() {
    return this.mockExam.listTemplates();
  }

  @Get('templates/:id')
  @Permissions(PERM.EXAM_TAKE)
  @ApiOperation({ summary: 'Get an exam template' })
  @ApiParam({ name: 'id' })
  async getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.mockExam.getTemplate(id);
  }

  @Post()
  @Permissions(PERM.EXAM_TAKE)
  @ApiOperation({ summary: 'Create a new mock exam (full-board/subject/custom/adaptive/AI-generated)' })
  @ApiBody({ type: StartExamDtoClass })
  async create(@Body(new ZodValidationPipe(StartExamSchema)) body: typeof StartExamSchema._type, @CurrentUser() user: AuthenticatedUser) {
    return this.session.start(user.id, body);
  }
}
