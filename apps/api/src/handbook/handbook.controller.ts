/**
 * @file handbook.controller.ts
 * @module Handbook
 *
 * Fundamentals Handbook endpoints — student-facing, read-only projections of
 * the Knowledge Library. Base path: /api/v1/handbook.
 */
import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { HandbookService } from './handbook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PERM } from '../rbac/rbac.constants';

const ListQuerySchema = z.object({
  subjectCode: z.string().trim().max(10).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

@ApiTags('Fundamentals Handbook')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.STUDENT_LEARN)
@Controller('handbook')
export class HandbookController {
  constructor(private readonly handbook: HandbookService) {}

  @Get('subjects')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subjects with formula counts (handbook nav)' })
  subjects() {
    return this.handbook.subjects();
  }

  @Get('formulas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search/browse the formula library' })
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: typeof ListQuerySchema._type) {
    return this.handbook.listFormulas(q);
  }

  @Get('formulas/must-memorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Most board-question-linked formulas per subject' })
  mustMemorize() {
    return this.handbook.mustMemorize();
  }

  @Get('daily')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Formula / Concept / Board Tip of the Day' })
  daily() {
    return this.handbook.daily();
  }

  @Get('formulas/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full formula page with related records' })
  async detail(@Param('slug') slug: string) {
    const f = await this.handbook.formulaDetail(slug);
    if (!f) throw new NotFoundException('Formula not found');
    return f;
  }
}
