/**
 * @file exam-result.controller.ts
 * @module Exams/Controllers
 */
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ExamResultService } from '../services/exam-result.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PERM } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

@ApiTags('Exams — Results & Scoring')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.EXAM_RESULTS)
@Controller('exams')
export class ExamResultController {
  constructor(private readonly result: ExamResultService) {}

  @Get(':id/result')
  @ApiOperation({ summary: 'Get the detailed score breakdown for a submitted exam' })
  @ApiParam({ name: 'id' })
  async getResult(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.result.getResultByExam(id, user.id);
  }

  @Get('results/code/:code')
  @ApiOperation({ summary: 'Get a result by its certificate-ready result code' })
  @ApiParam({ name: 'code' })
  async getByCode(@Param('code') code: string) {
    return this.result.getResultByCode(code);
  }
}
