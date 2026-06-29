/**
 * @file learning-objective.controller.ts
 * @module LearningObjectives/Controllers
 *
 * LearningObjectiveController — CRUD + lifecycle + version history for the
 * educational spine. Base: /api/v1/admin/learning-objectives. Thin; guarded by
 * auth + role + knowledge permissions.
 */
import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { LearningObjectiveService } from '../services/learning-objective.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import {
  CreateLearningObjectiveSchema, UpdateLearningObjectiveSchema, LoSearchSchema, BulkSyncLoSchema,
  CreateLearningObjectiveDtoClass, UpdateLearningObjectiveDtoClass,
} from '../dto/learning-objective.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

const KNOWLEDGE_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — Learning Objectives')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...KNOWLEDGE_ROLES)
@Permissions(PERM.KNOWLEDGE_READ)
@Controller('admin/learning-objectives')
export class LearningObjectiveController {
  constructor(private readonly los: LearningObjectiveService) {}

  @Get()
  @ApiOperation({ summary: 'Search learning objectives' })
  async search(@Query(new ZodValidationPipe(LoSearchSchema)) query: typeof LoSearchSchema._type) {
    return this.los.search(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Create a learning objective' })
  @ApiBody({ type: CreateLearningObjectiveDtoClass })
  async create(
    @Body(new ZodValidationPipe(CreateLearningObjectiveSchema)) body: typeof CreateLearningObjectiveSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.los.create(body, user);
  }

  @Post('bulk-import')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Sync learning objectives from the Knowledge Library', description: 'Idempotent upsert by publicId; synced objectives are published for tutor grounding.' })
  async bulkImport(
    @Body(new ZodValidationPipe(BulkSyncLoSchema)) body: typeof BulkSyncLoSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.los.bulkSync(body.objectives, user);
  }

  @Get('by-public-id/:publicId')
  @ApiOperation({ summary: 'Get a learning objective by its public LO ID' })
  @ApiParam({ name: 'publicId', example: 'LO-STR-001-003-001' })
  async byPublicId(@Param('publicId') publicId: string) {
    return this.los.findByPublicId(publicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a learning objective' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.los.findById(id);
  }

  @Patch(':id')
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Update a learning objective (new version)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateLearningObjectiveDtoClass })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateLearningObjectiveSchema)) body: typeof UpdateLearningObjectiveSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.los.update(id, body, user);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Submit for review' })
  @ApiParam({ name: 'id' })
  async submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.los.submitForReview(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Approve' })
  @ApiParam({ name: 'id' })
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.los.approve(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Publish (must be approved)' })
  @ApiParam({ name: 'id' })
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.los.publish(id, user);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Version history' })
  @ApiParam({ name: 'id' })
  async versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.los.getVersions(id);
  }
}
