/**
 * @file blueprint.controller.ts
 * @module Blueprints/Controllers
 *
 * BlueprintController — CRUD + lifecycle for Question Blueprints.
 * Base: /api/v1/admin/blueprints. Thin; guarded by auth + role + knowledge perms.
 */
import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BlueprintService } from '../services/blueprint.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { CreateBlueprintSchema, BlueprintSearchSchema, CreateBlueprintDtoClass } from '../dto/blueprint.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

const KNOWLEDGE_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — Blueprints')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...KNOWLEDGE_ROLES)
@Permissions(PERM.KNOWLEDGE_READ)
@Controller('admin/blueprints')
export class BlueprintController {
  constructor(private readonly blueprints: BlueprintService) {}

  @Get()
  @ApiOperation({ summary: 'Search blueprints' })
  async search(@Query(new ZodValidationPipe(BlueprintSearchSchema)) query: typeof BlueprintSearchSchema._type) {
    return this.blueprints.search(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Create a blueprint' })
  @ApiBody({ type: CreateBlueprintDtoClass })
  async create(
    @Body(new ZodValidationPipe(CreateBlueprintSchema)) body: typeof CreateBlueprintSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blueprints.create(body, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blueprint' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.blueprints.findById(id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Submit for review' })
  @ApiParam({ name: 'id' })
  async submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.blueprints.setStatus(id, 'in_review', ['draft']);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Approve' })
  @ApiParam({ name: 'id' })
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.blueprints.setStatus(id, 'approved', ['in_review']);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Publish (must be approved)' })
  @ApiParam({ name: 'id' })
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.blueprints.publish(id, user);
  }
}
