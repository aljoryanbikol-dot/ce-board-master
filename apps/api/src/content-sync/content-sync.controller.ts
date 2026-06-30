/**
 * @file content-sync.controller.ts — admin endpoints for Knowledge Library sync.
 * Base: /api/v1/admin/sync. One generic controller drives every content type.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ContentSyncService } from './content-sync.service';
import { SYNC_CONFIGS } from './content-sync.registry';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PERM } from '../rbac/rbac.constants';
import type { AuthenticatedUser } from '../auth/auth.types';

const SyncBodySchema = z.object({
  items: z.array(z.unknown()).min(1, 'At least one item is required.').max(5000),
  atomic: z.boolean().default(true),
});
const ListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

@ApiTags('Admin — Knowledge Sync')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('admin/sync')
export class ContentSyncController {
  constructor(private readonly engine: ContentSyncService) {}

  @Get('kinds')
  @Permissions(PERM.KNOWLEDGE_READ)
  @ApiOperation({ summary: 'List syncable content types' })
  kinds() {
    return Object.values(SYNC_CONFIGS).map((c) => ({ kind: c.kind, label: c.label, entityType: c.entityType }));
  }

  @Get(':kind/items')
  @Permissions(PERM.KNOWLEDGE_READ)
  @ApiOperation({ summary: 'List synced items for a content type' })
  @ApiParam({ name: 'kind' })
  list(@Param('kind') kind: string, @Query(new ZodValidationPipe(ListQuerySchema)) q: typeof ListQuerySchema._type) {
    return this.engine.list(this.config(kind), q);
  }

  @Post(':kind')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Sync a content type from the Knowledge Library', description: 'Idempotent upsert by publicId with content-hash change detection, version history, sync report, and atomic rollback.' })
  @ApiParam({ name: 'kind' })
  sync(
    @Param('kind') kind: string,
    @Body(new ZodValidationPipe(SyncBodySchema)) body: typeof SyncBodySchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engine.sync(this.config(kind), body.items, { atomic: body.atomic, actorId: user.id });
  }

  private config(kind: string) {
    const cfg = SYNC_CONFIGS[kind];
    if (!cfg) throw new NotFoundException(`Unknown content type '${kind}'. Known: ${Object.keys(SYNC_CONFIGS).join(', ')}.`);
    return cfg;
  }
}
