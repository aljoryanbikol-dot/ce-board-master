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

const SymbolQuerySchema = z.object({ q: z.string().trim().max(60).optional() });

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

  @Get('symbols')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Searchable engineering symbol index (derived from formula variables)' })
  symbols(@Query(new ZodValidationPipe(SymbolQuerySchema)) q: typeof SymbolQuerySchema._type) {
    return this.handbook.symbols(q.q);
  }

  @Get('glossary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Searchable engineering glossary (published concepts)' })
  glossary(@Query(new ZodValidationPipe(ListQuerySchema)) q: typeof ListQuerySchema._type) {
    return this.handbook.glossary(q);
  }

  @Get('foundations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Engineering Foundations review pages, grouped by subject' })
  foundations() {
    return this.handbook.foundations();
  }

  @Get('foundations/:publicId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'One foundations page: review note + topic formulas + concepts' })
  async foundationPage(@Param('publicId') publicId: string) {
    const page = await this.handbook.foundationPage(publicId);
    if (!page) throw new NotFoundException('Foundations page not found');
    return page;
  }

  @Get('last-minute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Last Minute Review — top formulas, common mistakes, board tips' })
  lastMinute() {
    return this.handbook.lastMinute();
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
