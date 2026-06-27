/**
 * @file editorial.controller.ts
 * @module Editorial/Controllers
 *
 * EditorialController — read-only access to the governance/standards documents
 * (Books 1,3,5,6,7,8,9,10,14,15). Base: /api/v1/admin/editorial. Thin; guarded
 * by auth + role + knowledge.read.
 */
import { Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EditorialService } from '../services/editorial.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';

const KNOWLEDGE_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — Editorial Standards')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...KNOWLEDGE_ROLES)
@Permissions(PERM.KNOWLEDGE_READ)
@Controller('admin/editorial')
export class EditorialController {
  constructor(private readonly editorial: EditorialService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Which standards book governs which production concern' })
  catalog() {
    return this.editorial.getStandardsCatalog();
  }

  @Get('standards')
  @ApiOperation({ summary: 'List the ingested governance/standards documents' })
  async standards() {
    return this.editorial.listStandards();
  }

  @Get('standards/book/:bookNumber')
  @ApiOperation({ summary: 'Get a standards document by book number' })
  @ApiParam({ name: 'bookNumber', example: 15 })
  async byBook(@Param('bookNumber', ParseIntPipe) bookNumber: number) {
    return this.editorial.getStandardByBook(bookNumber);
  }

  @Get('documents/:id/sections')
  @ApiOperation({ summary: 'Table of contents (parsed sections) of a standards document' })
  @ApiParam({ name: 'id' })
  async sections(@Param('id', ParseUUIDPipe) id: string) {
    return this.editorial.getSections(id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Full-text search within the standards corpus' })
  @ApiQuery({ name: 'q', required: true })
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.editorial.searchStandards(q, limit ? Number(limit) : 20);
  }
}
