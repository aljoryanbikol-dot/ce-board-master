/**
 * @file formula.controller.ts
 * @module Formulas/Controllers
 *
 * FormulaController — CRUD + search for the Formula Library (reuses the existing
 * FormulaLibrary model). Base: /api/v1/admin/formulas. Uses the existing
 * formulas.manage permission. Thin; guarded by auth + role + permission.
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FormulaService } from '../services/formula.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import {
  CreateFormulaSchema, UpdateFormulaSchema, FormulaSearchSchema,
  CreateFormulaDtoClass, UpdateFormulaDtoClass,
} from '../dto/formula.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

const KNOWLEDGE_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — Formulas')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...KNOWLEDGE_ROLES)
@Permissions(PERM.KNOWLEDGE_READ)
@Controller('admin/formulas')
export class FormulaController {
  constructor(private readonly formulas: FormulaService) {}

  @Get()
  @ApiOperation({ summary: 'Search the formula library' })
  async search(@Query(new ZodValidationPipe(FormulaSearchSchema)) query: typeof FormulaSearchSchema._type) {
    return this.formulas.search(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.FORMULAS_MANAGE)
  @ApiOperation({ summary: 'Create a formula' })
  @ApiBody({ type: CreateFormulaDtoClass })
  async create(
    @Body(new ZodValidationPipe(CreateFormulaSchema)) body: typeof CreateFormulaSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formulas.create(body, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a formula' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.formulas.findById(id);
  }

  @Patch(':id')
  @Permissions(PERM.FORMULAS_MANAGE)
  @ApiOperation({ summary: 'Update a formula' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateFormulaDtoClass })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateFormulaSchema)) body: typeof UpdateFormulaSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formulas.update(id, body, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERM.FORMULAS_MANAGE)
  @ApiOperation({ summary: 'Deactivate a formula' })
  @ApiParam({ name: 'id' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.formulas.deactivate(id);
  }
}
