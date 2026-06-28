/**
 * @file subtopics.controller.ts — Admin CRUD for Subtopics.
 * Base path: /api/v1/admin/subtopics.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubtopicsService } from '../services/subtopics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { CreateSubtopicSchema, UpdateSubtopicSchema, ListQuerySchema, BulkIdsSchema } from '../dto/taxonomy.dto';

@ApiTags('Admin — Subtopics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/subtopics')
export class SubtopicsController {
  constructor(private readonly service: SubtopicsService) {}

  @Get()
  @ApiOperation({ summary: 'List subtopics (filter by topicId/subjectId, search, pagination)' })
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: typeof ListQuerySchema._type) {
    return this.service.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subtopic' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Create a subtopic' })
  create(@Body(new ZodValidationPipe(CreateSubtopicSchema)) body: typeof CreateSubtopicSchema._type) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Update a subtopic' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateSubtopicSchema)) body: typeof UpdateSubtopicSchema._type) {
    return this.service.update(id, body);
  }

  @Post('bulk-delete')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Soft-delete many subtopics' })
  bulkRemove(@Body(new ZodValidationPipe(BulkIdsSchema)) body: typeof BulkIdsSchema._type) {
    return this.service.bulkRemove(body.ids);
  }

  @Delete(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a subtopic' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
