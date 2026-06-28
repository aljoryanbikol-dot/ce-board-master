/**
 * @file topics.controller.ts — Admin CRUD for Topics (Categories).
 * Base path: /api/v1/admin/topics.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TopicsService } from '../services/topics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { CreateTopicSchema, UpdateTopicSchema, ListQuerySchema, BulkIdsSchema } from '../dto/taxonomy.dto';

@ApiTags('Admin — Topics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/topics')
export class TopicsController {
  constructor(private readonly service: TopicsService) {}

  @Get()
  @ApiOperation({ summary: 'List topics (filter by subjectId, search, pagination)' })
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: typeof ListQuerySchema._type) {
    return this.service.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a topic' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Create a topic' })
  create(@Body(new ZodValidationPipe(CreateTopicSchema)) body: typeof CreateTopicSchema._type) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Update a topic' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateTopicSchema)) body: typeof UpdateTopicSchema._type) {
    return this.service.update(id, body);
  }

  @Post('bulk-delete')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Soft-delete many topics' })
  bulkRemove(@Body(new ZodValidationPipe(BulkIdsSchema)) body: typeof BulkIdsSchema._type) {
    return this.service.bulkRemove(body.ids);
  }

  @Delete(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a topic' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
