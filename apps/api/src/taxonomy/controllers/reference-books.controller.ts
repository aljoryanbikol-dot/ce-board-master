/**
 * @file reference-books.controller.ts — Admin CRUD for Reference Books.
 * Base path: /api/v1/admin/reference-books. Reads require cms.access; writes also
 * require questions.manage.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReferenceBooksService } from '../services/reference-books.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM } from '../../rbac/rbac.constants';
import { CreateReferenceBookSchema, UpdateReferenceBookSchema, ListQuerySchema, BulkIdsSchema } from '../dto/taxonomy.dto';

@ApiTags('Admin — Reference Books')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/reference-books')
export class ReferenceBooksController {
  constructor(private readonly service: ReferenceBooksService) {}

  @Get()
  @ApiOperation({ summary: 'List reference books (search + pagination)' })
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: typeof ListQuerySchema._type) {
    return this.service.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a reference book' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Create a reference book' })
  create(@Body(new ZodValidationPipe(CreateReferenceBookSchema)) body: typeof CreateReferenceBookSchema._type) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Update a reference book' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateReferenceBookSchema)) body: typeof UpdateReferenceBookSchema._type) {
    return this.service.update(id, body);
  }

  @Post('bulk-delete')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Delete many reference books' })
  bulkRemove(@Body(new ZodValidationPipe(BulkIdsSchema)) body: typeof BulkIdsSchema._type) {
    return this.service.bulkRemove(body.ids);
  }

  @Delete(':id')
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_MANAGE)
  @ApiOperation({ summary: 'Delete a reference book' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
