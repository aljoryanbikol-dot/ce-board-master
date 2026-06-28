/**
 * @file question-workflow.controller.ts
 * @module Questions/Controllers
 *
 * QuestionWorkflowController — the review/publish/archive lifecycle endpoints.
 * Base path: /api/v1/questions/:id/…
 *
 * Each endpoint maps to a single workflow transition validated by the status
 * machine in the service. Both role and permission are enforced; the specific
 * permission per action is additionally checked inside the service against the
 * status-machine rules.
 */
import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { QuestionWorkflowService } from '../services/question-workflow.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  SubmitForReviewSchema, ApproveSchema, RejectSchema, FlagSchema, NotesOnlySchema,
  SubmitForReviewDtoClass, ApproveDtoClass, RejectDtoClass, FlagDtoClass, NotesOnlyDtoClass,
  WorkflowEntryDto,
} from '../dto/review.dto';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { QuestionStatus } from '@prisma/client';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../auth/auth.types';

/** Admin direct status set (CMS one-click publish/unpublish/archive). */
const SetStatusSchema = z.object({
  status: z.enum(['published', 'archived', 'draft']),
  notes: z.string().trim().max(500).optional(),
});

const AUTHORS = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.CONTENT_AUTHOR,
] as const;
const REVIEWERS = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Questions — Workflow')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Controller('questions')
export class QuestionWorkflowController {
  constructor(private readonly workflow: QuestionWorkflowService) {}

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles(...AUTHORS)
  @Permissions(PERM.QUESTIONS_UPDATE)
  @ApiOperation({ summary: 'Submit a draft for review', description: 'draft → in_review (technical stage).' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: SubmitForReviewDtoClass })
  @ApiResponse({ status: 422, description: 'INVALID_TRANSITION' })
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SubmitForReviewSchema)) body: typeof SubmitForReviewSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.submitForReview(id, user, body.notes);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(...REVIEWERS)
  @Permissions(PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Approve current review stage', description: 'Advances technical → educational → editorial → qa; final approval → approved.' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ApproveDtoClass })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ApproveSchema)) body: typeof ApproveSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.approve(id, user, body.notes);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(...REVIEWERS)
  @Permissions(PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Reject or request changes', description: 'Returns the question to draft with a reason.' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: RejectDtoClass })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RejectSchema)) body: typeof RejectSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.reject(id, user, body.reason, body.requestChanges);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN)
  @Permissions(PERM.QUESTIONS_PUBLISH)
  @ApiOperation({ summary: 'Publish an approved question', description: 'approved → published.' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: NotesOnlyDtoClass })
  @ApiResponse({ status: 422, description: 'NOT_PUBLISHABLE' })
  @ApiResponse({ status: 409, description: 'ALREADY_PUBLISHED' })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NotesOnlySchema)) body: typeof NotesOnlySchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.publish(id, user, body.notes);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN)
  @Permissions(PERM.QUESTIONS_PUBLISH)
  @ApiOperation({ summary: 'Archive a question', description: 'published/flagged → archived.' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: NotesOnlyDtoClass })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NotesOnlySchema)) body: typeof NotesOnlySchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.archive(id, user, body.notes);
  }

  @Post(':id/set-status')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN)
  @Permissions(PERM.QUESTIONS_PUBLISH)
  @ApiOperation({ summary: 'Admin: set status directly', description: 'One-click publish/unpublish/archive (bypasses the review stages).' })
  @ApiParam({ name: 'id' })
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SetStatusSchema)) body: typeof SetStatusSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.adminSetStatus(id, user, body.status as QuestionStatus, body.notes);
  }

  @Post(':id/flag')
  @HttpCode(HttpStatus.OK)
  @Roles(...REVIEWERS)
  @Permissions(PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Flag a published question' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: FlagDtoClass })
  async flag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(FlagSchema)) body: typeof FlagSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.flag(id, user, body.reason);
  }

  @Post(':id/unflag')
  @HttpCode(HttpStatus.OK)
  @Roles(...REVIEWERS)
  @Permissions(PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Clear a flag', description: 'flagged → published.' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: NotesOnlyDtoClass })
  async unflag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NotesOnlySchema)) body: typeof NotesOnlySchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.unflag(id, user, body.notes);
  }

  @Get(':id/workflow')
  @HttpCode(HttpStatus.OK)
  @Roles(...AUTHORS, ROLE_SLUGS.REVIEWER)
  @Permissions(PERM.QUESTIONS_READ)
  @ApiOperation({ summary: 'Get the workflow/transition history' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: [WorkflowEntryDto] })
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.getWorkflowHistory(id, user);
  }
}
