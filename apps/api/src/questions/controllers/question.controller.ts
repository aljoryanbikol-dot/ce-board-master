/**
 * @file question.controller.ts
 * @module Questions/Controllers
 *
 * QuestionController — CRUD, clone, search, version history, bulk import/export.
 * Base path: /api/v1/questions.
 *
 * Every endpoint enforces BOTH role (@Roles) and permission (@Permissions) via
 * the reused RolesGuard + PermissionGuard. Ownership is resolved in services.
 * Clean Architecture: zero Prisma, zero business logic here.
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe,
  ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { QuestionService } from '../services/question.service';
import { QuestionSearchService } from '../services/question-search.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CreateQuestionSchema, UpdateQuestionSchema,
  CreateQuestionDtoClass, UpdateQuestionDtoClass, QuestionDetailDto,
} from '../dto/question.dto';
import { SearchQuestionsSchema } from '../dto/search.dto';
import { BulkImportSchema, BulkExportSchema, BulkImportDtoClass, BulkImportResultDto } from '../dto/bulk.dto';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../../auth/auth.types';

const READERS = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN,
  ROLE_SLUGS.CONTENT_AUTHOR, ROLE_SLUGS.REVIEWER, ROLE_SLUGS.SUBSCRIBER, ROLE_SLUGS.FREE_USER,
] as const;
const AUTHORS = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR,
] as const;

@ApiTags('Questions')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Controller('questions')
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly searchService: QuestionSearchService,
  ) {}

  // ── Search / list ───────────────────────────────────────────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(...READERS)
  @Permissions(PERM.QUESTIONS_READ)
  @ApiOperation({ summary: 'Search/list questions', description: 'Cursor-paginated search with rich filters. Non-privileged callers see published questions plus their own drafts.' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'topicId', required: false })
  @ApiQuery({ name: 'subtopicId', required: false })
  @ApiQuery({ name: 'difficultyLevelId', required: false })
  @ApiQuery({ name: 'bloomLevel', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'authorId', required: false })
  @ApiQuery({ name: 'reviewerId', required: false })
  @ApiQuery({ name: 'learningObjective', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'isAiGenerated', required: false, type: Boolean })
  async search(
    @Query(new ZodValidationPipe(SearchQuestionsSchema)) query: typeof SearchQuestionsSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.searchService.search(query, user);
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(...AUTHORS)
  @Permissions(PERM.QUESTIONS_CREATE)
  @ApiOperation({ summary: 'Create a question (draft)' })
  @ApiBody({ type: CreateQuestionDtoClass })
  @ApiResponse({ status: 201, type: QuestionDetailDto })
  @ApiResponse({ status: 409, description: 'QUESTION_CODE_TAKEN' })
  @ApiResponse({ status: 422, description: 'VALIDATION_ERROR | CHOICES_INVALID' })
  async create(
    @Body(new ZodValidationPipe(CreateQuestionSchema)) body: typeof CreateQuestionSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionService.create(body, user);
  }

  // ── Bulk import / export (placed before :id to avoid route clash) ───────────

  @Post('bulk/import')
  @HttpCode(HttpStatus.OK)
  @Roles(...AUTHORS)
  @Permissions(PERM.QUESTIONS_CREATE)
  @ApiOperation({ summary: 'Bulk import questions', description: 'Atomic (all-or-nothing) by default, or partial with per-row error reporting.' })
  @ApiBody({ type: BulkImportDtoClass })
  @ApiResponse({ status: 200, type: BulkImportResultDto })
  @ApiResponse({ status: 400, description: 'BULK_IMPORT_INVALID' })
  async bulkImport(
    @Body(new ZodValidationPipe(BulkImportSchema)) body: typeof BulkImportSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.searchService.bulkImport(body, user);
  }

  @Get('bulk/export')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN)
  @Permissions(PERM.QUESTIONS_READ)
  @ApiOperation({ summary: 'Bulk export questions' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async bulkExport(
    @Query(new ZodValidationPipe(BulkExportSchema)) query: typeof BulkExportSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.searchService.bulkExport(query, user);
  }

  // ── Read one ──────────────────────────────────────────────────────────────────

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(...READERS)
  @Permissions(PERM.QUESTIONS_READ)
  @ApiOperation({ summary: 'Get a question by ID' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiResponse({ status: 200, type: QuestionDetailDto })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OWNERSHIP' })
  @ApiResponse({ status: 404, description: 'QUESTION_NOT_FOUND' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionService.findById(id, user);
  }

  // ── Version history ───────────────────────────────────────────────────────────

  @Get(':id/versions')
  @HttpCode(HttpStatus.OK)
  @Roles(...READERS)
  @Permissions(PERM.QUESTIONS_READ)
  @ApiOperation({ summary: 'List version history of a question' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  async versions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.searchService.getVersions(id, user);
  }

  @Get(':id/versions/:n')
  @HttpCode(HttpStatus.OK)
  @Roles(...READERS)
  @Permissions(PERM.QUESTIONS_READ)
  @ApiOperation({ summary: 'Get a specific version snapshot' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiParam({ name: 'n', description: 'Version number', type: Number })
  async versionSnapshot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('n', ParseIntPipe) n: number,
  ) {
    return this.searchService.getVersionSnapshot(id, n);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(...AUTHORS)
  @Permissions(PERM.QUESTIONS_UPDATE)
  @ApiOperation({ summary: 'Update a question (optimistic-locked, versioned)' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiBody({ type: UpdateQuestionDtoClass })
  @ApiResponse({ status: 200, type: QuestionDetailDto })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OWNERSHIP' })
  @ApiResponse({ status: 409, description: 'VERSION_CONFLICT' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateQuestionSchema)) body: typeof UpdateQuestionSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionService.update(id, body, user);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...AUTHORS)
  @Permissions(PERM.QUESTIONS_DELETE)
  @ApiOperation({ summary: 'Soft-delete a question', description: 'Published questions cannot be deleted — archive instead.' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_OWNERSHIP | CANNOT_DELETE_PUBLISHED' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.questionService.softDelete(id, user);
  }

  // ── Clone ──────────────────────────────────────────────────────────────────────

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...AUTHORS)
  @Permissions(PERM.QUESTIONS_CREATE)
  @ApiOperation({ summary: 'Clone a question into a new draft owned by the caller' })
  @ApiParam({ name: 'id', description: 'Source question UUID' })
  @ApiResponse({ status: 201, type: QuestionDetailDto })
  async clone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionService.clone(id, user);
  }
}
