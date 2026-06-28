/**
 * @file subjects.controller.ts — Admin CRUD for Subjects.
 * Base path: /api/v1/admin/subjects. Reads require cms.access; writes also
 * require questions.manage.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubjectsService } from '../services/subjects.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { CreateSubjectSchema, UpdateSubjectSchema, ListQuerySchema, BulkIdsSchema } from '../dto/taxonomy.dto';

@ApiTags('Admin — Subjects')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/subjects')
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List subjects (search + pagination)' })
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: typeof ListQuerySchema._type) {
    return this.service.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subject' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Create a subject' })
  create(@Body(new ZodValidationPipe(CreateSubjectSchema)) body: typeof CreateSubjectSchema._type) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Update a subject' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateSubjectSchema)) body: typeof UpdateSubjectSchema._type) {
    return this.service.update(id, body);
  }

  @Post('bulk-delete')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Soft-delete many subjects' })
  bulkRemove(@Body(new ZodValidationPipe(BulkIdsSchema)) body: typeof BulkIdsSchema._type) {
    return this.service.bulkRemove(body.ids);
  }

  @Delete(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a subject' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
