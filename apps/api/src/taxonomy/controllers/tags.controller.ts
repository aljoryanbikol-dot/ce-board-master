/**
 * @file tags.controller.ts — Admin CRUD for Tags.
 * Base path: /api/v1/admin/tags. Reads require cms.access; writes also require
 * questions.manage.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TagsService } from '../services/tags.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { CreateTagSchema, UpdateTagSchema, ListQuerySchema, BulkIdsSchema } from '../dto/taxonomy.dto';

@ApiTags('Admin — Tags')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/tags')
export class TagsController {
  constructor(private readonly service: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'List tags (search + pagination)' })
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: typeof ListQuerySchema._type) {
    return this.service.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tag' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Create a tag' })
  create(@Body(new ZodValidationPipe(CreateTagSchema)) body: typeof CreateTagSchema._type) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Update a tag' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateTagSchema)) body: typeof UpdateTagSchema._type) {
    return this.service.update(id, body);
  }

  @Post('bulk-delete')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Delete many tags' })
  bulkRemove(@Body(new ZodValidationPipe(BulkIdsSchema)) body: typeof BulkIdsSchema._type) {
    return this.service.bulkRemove(body.ids);
  }

  @Delete(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Delete a tag' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
