/**
 * @file misconception.controller.ts
 * @module Misconceptions/Controllers
 *
 * MisconceptionController — CRUD + lifecycle for Misconceptions.
 * Base: /api/v1/admin/misconceptions. Thin; guarded by auth + role + knowledge perms.
 */
import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { MisconceptionService } from '../services/misconception.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { CreateMisconceptionSchema, MisconceptionSearchSchema, CreateMisconceptionDtoClass } from '../dto/misconception.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

const KNOWLEDGE_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — Misconceptions')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...KNOWLEDGE_ROLES)
@Permissions(PERM.KNOWLEDGE_READ)
@Controller('admin/misconceptions')
export class MisconceptionController {
  constructor(private readonly misconceptions: MisconceptionService) {}

  @Get()
  @ApiOperation({ summary: 'Search misconceptions' })
  async search(@Query(new ZodValidationPipe(MisconceptionSearchSchema)) query: typeof MisconceptionSearchSchema._type) {
    return this.misconceptions.search(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Create a misconception' })
  @ApiBody({ type: CreateMisconceptionDtoClass })
  async create(
    @Body(new ZodValidationPipe(CreateMisconceptionSchema)) body: typeof CreateMisconceptionSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.misconceptions.create(body, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a misconception' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.misconceptions.findById(id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Submit for review' })
  @ApiParam({ name: 'id' })
  async submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.misconceptions.setStatus(id, 'in_review', ['draft']);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Approve' })
  @ApiParam({ name: 'id' })
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.misconceptions.setStatus(id, 'approved', ['in_review']);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Publish (must be approved)' })
  @ApiParam({ name: 'id' })
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.misconceptions.publish(id, user);
  }
}
