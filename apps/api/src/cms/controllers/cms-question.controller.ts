/**
 * @file cms-question.controller.ts
 * @module Cms/Controllers
 *
 * CmsQuestionController — CMS question management: advanced search, detail,
 * version history, activity timeline, locking, review assignment, comments,
 * and editorial notes. Base: /api/v1/admin/cms/questions.
 *
 * Guarded by auth + role + permission. Ownership is enforced in the services.
 * Thin controller: zero Prisma, zero business logic.
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { CmsQuestionService } from '../services/cms-question.service';
import { CmsAnalyticsService } from '../services/cms-analytics.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { CmsSearchSchema } from '../dto/cms-search.dto';
import {
  AcquireLockSchema, AssignReviewSchema, UpdateAssignmentSchema, CreateCommentSchema, CreateNoteSchema,
  AcquireLockDtoClass, AssignReviewDtoClass, UpdateAssignmentDtoClass, CreateCommentDtoClass, CreateNoteDtoClass,
} from '../dto/cms.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

const CMS_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — CMS Questions')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...CMS_ROLES)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/cms/questions')
export class CmsQuestionController {
  constructor(
    private readonly cms: CmsQuestionService,
    private readonly analytics: CmsAnalyticsService,
  ) {}

  // ── Advanced search ───────────────────────────────────────────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advanced CMS search', description: 'All Question Bank filters plus created/updated date ranges.' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'authorId', required: false })
  @ApiQuery({ name: 'reviewerId', required: false })
  @ApiQuery({ name: 'createdFrom', required: false })
  @ApiQuery({ name: 'createdTo', required: false })
  async search(
    @Query(new ZodValidationPipe(CmsSearchSchema)) query: typeof CmsSearchSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analytics.search(query, user);
  }

  // ── Detail / history / timeline ────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Full question detail (delegated to Question Bank)' })
  @ApiParam({ name: 'id' })
  async detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cms.getQuestionDetail(id, user);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Version history' })
  @ApiParam({ name: 'id' })
  async versions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cms.getVersionHistory(id, user);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Activity timeline (workflow + comments + assignments + locks + notes)' })
  @ApiParam({ name: 'id' })
  async timeline(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cms.getActivityTimeline(id, user);
  }

  // ── Locking ─────────────────────────────────────────────────────────────────

  @Get(':id/lock')
  @ApiOperation({ summary: 'Get the active lock (if any)' })
  @ApiParam({ name: 'id' })
  async getLock(@Param('id', ParseUUIDPipe) id: string) {
    return this.cms.getLock(id);
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_UPDATE)
  @ApiOperation({ summary: 'Acquire (or extend) an editing lock' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: AcquireLockDtoClass })
  @ApiResponse({ status: 409, description: 'QUESTION_LOCKED' })
  async acquireLock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AcquireLockSchema)) body: typeof AcquireLockSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cms.acquireLock(id, body, user);
  }

  @Delete(':id/lock')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_UPDATE)
  @ApiOperation({ summary: 'Release the editing lock' })
  @ApiParam({ name: 'id' })
  async releaseLock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.cms.releaseLock(id, user);
  }

  // ── Review assignment ────────────────────────────────────────────────────────

  @Get(':id/assignments')
  @ApiOperation({ summary: 'List review assignments for a question' })
  @ApiParam({ name: 'id' })
  async assignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.cms.listAssignments(id);
  }

  @Post(':id/assignments')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Assign a reviewer to a stage' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: AssignReviewDtoClass })
  @ApiResponse({ status: 409, description: 'ASSIGNMENT_EXISTS' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssignReviewSchema)) body: typeof AssignReviewSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cms.assignReview(id, body, user);
  }

  @Post('assignments/:assignmentId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an assignment status (accept/complete/decline)' })
  @ApiParam({ name: 'assignmentId' })
  @ApiBody({ type: UpdateAssignmentDtoClass })
  async updateAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body(new ZodValidationPipe(UpdateAssignmentSchema)) body: typeof UpdateAssignmentSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cms.updateAssignment(assignmentId, body, user);
  }

  // ── Review comments ──────────────────────────────────────────────────────────

  @Get(':id/comments')
  @ApiOperation({ summary: 'List threaded review comments' })
  @ApiParam({ name: 'id' })
  async comments(@Param('id', ParseUUIDPipe) id: string) {
    return this.cms.listComments(id);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a review comment (optionally threaded / stage-scoped)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CreateCommentDtoClass })
  async addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateCommentSchema)) body: typeof CreateCommentSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cms.addComment(id, body, user);
  }

  @Post('comments/:commentId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a review comment' })
  @ApiParam({ name: 'commentId' })
  async resolveComment(@Param('commentId', ParseUUIDPipe) commentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cms.resolveComment(commentId, user);
  }

  // ── Editorial notes ──────────────────────────────────────────────────────────

  @Get(':id/notes')
  @ApiOperation({ summary: 'List editorial notes (pinned first)' })
  @ApiParam({ name: 'id' })
  async notes(@Param('id', ParseUUIDPipe) id: string) {
    return this.cms.listNotes(id);
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an editorial note' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CreateNoteDtoClass })
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateNoteSchema)) body: typeof CreateNoteSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cms.addNote(id, body, user);
  }

  @Delete('notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an editorial note' })
  @ApiParam({ name: 'noteId' })
  async deleteNote(@Param('noteId', ParseUUIDPipe) noteId: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.cms.deleteNote(noteId, user);
  }
}
