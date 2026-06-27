/**
 * @file knowledge.controller.ts
 * @module Knowledge/Controllers
 *
 * KnowledgeController — the core knowledge-base API: document ingestion +
 * versioning, full-text search, and the cross-reference / dependency-graph
 * engine. Base: /api/v1/admin/knowledge. Thin: delegates to services; zero
 * Prisma, zero business logic. Guarded by auth + role + knowledge permissions.
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { KnowledgeIngestionService } from '../services/knowledge-ingestion.service';
import { KnowledgeSearchService } from '../services/knowledge-search.service';
import { CrossReferenceService } from '../services/cross-reference.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import {
  IngestDocumentSchema, CreateCrossReferenceSchema, KnowledgeSearchSchema,
  IngestDocumentDtoClass, CreateCrossReferenceDtoClass,
} from '../dto/knowledge.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

const KNOWLEDGE_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — Knowledge Base')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...KNOWLEDGE_ROLES)
@Permissions(PERM.KNOWLEDGE_READ)
@Controller('admin/knowledge')
export class KnowledgeController {
  constructor(
    private readonly ingestion: KnowledgeIngestionService,
    private readonly searchService: KnowledgeSearchService,
    private readonly crossRef: CrossReferenceService,
  ) {}

  // ── Documents ─────────────────────────────────────────────────────────────────

  @Post('documents/ingest')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.KNOWLEDGE_INGEST)
  @ApiOperation({ summary: 'Ingest or re-version an enterprise document (Books 1–15)' })
  @ApiBody({ type: IngestDocumentDtoClass })
  async ingest(
    @Body(new ZodValidationPipe(IngestDocumentSchema)) body: typeof IngestDocumentSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingestion.ingest(body, user);
  }

  @Post('documents/:id/publish')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.KNOWLEDGE_PUBLISH)
  @ApiOperation({ summary: 'Publish a document version as authoritative' })
  @ApiParam({ name: 'id' })
  async publishDocument(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ingestion.publishDocument(id, user);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List all ingested documents' })
  async listDocuments() {
    return this.ingestion.listDocuments();
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get one document' })
  @ApiParam({ name: 'id' })
  async getDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingestion.getDocument(id);
  }

  @Get('documents/:id/versions')
  @ApiOperation({ summary: 'Version history of a document' })
  @ApiParam({ name: 'id' })
  async listVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingestion.listVersions(id);
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full-text search across the knowledge base' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'types', required: false, description: 'Comma-separated entity types.' })
  async search(@Query(new ZodValidationPipe(KnowledgeSearchSchema)) query: typeof KnowledgeSearchSchema._type) {
    return this.searchService.search(query);
  }

  // ── Cross-references / dependency graph ─────────────────────────────────────

  @Post('cross-references')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Create a cross-reference edge' })
  @ApiBody({ type: CreateCrossReferenceDtoClass })
  async createCrossRef(
    @Body(new ZodValidationPipe(CreateCrossReferenceSchema)) body: typeof CreateCrossReferenceSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crossRef.create(body, user);
  }

  @Delete('cross-references/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERM.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Delete a cross-reference edge' })
  @ApiParam({ name: 'id' })
  async removeCrossRef(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.crossRef.remove(id);
  }

  @Get('entities/:type/:id/cross-references')
  @ApiOperation({ summary: 'List incoming + outgoing cross-references for an entity' })
  @ApiParam({ name: 'type' })
  @ApiParam({ name: 'id' })
  async entityCrossRefs(@Param('type') type: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.crossRef.listForEntity(type, id);
  }

  @Get('entities/:type/:id/graph')
  @ApiOperation({ summary: 'Build the dependency graph rooted at an entity' })
  @ApiParam({ name: 'type' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'depth', required: false, type: Number })
  async entityGraph(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('depth') depth?: string,
  ) {
    const d = depth ? Number(depth) : undefined;
    return this.crossRef.buildGraph(type, id, d);
  }
}
