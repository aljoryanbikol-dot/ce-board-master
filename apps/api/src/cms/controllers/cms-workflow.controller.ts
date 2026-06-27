/**
 * @file cms-workflow.controller.ts
 * @module Cms/Controllers
 *
 * CmsWorkflowController — workflow transitions + bulk operations from the CMS.
 * Base: /api/v1/admin/cms/workflow. Each single transition delegates to the
 * frozen Question Bank workflow; bulk operations are CMS-owned.
 *
 * Permissions are layered: cms.access (route group) plus the specific
 * permission per action (questions.review for approve/reject, questions.publish
 * for publish/archive). Ownership/transition legality enforced in services.
 */
import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { CmsWorkflowService } from '../services/cms-workflow.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import {
  SubmitForReviewSchema, ApproveSchema, RejectSchema, FlagSchema, NotesOnlySchema,
  SubmitForReviewDtoClass, ApproveDtoClass, RejectDtoClass, FlagDtoClass, NotesOnlyDtoClass,
} from '../../questions/dto/review.dto';
import {
  BulkOperationSchema, BulkOperationDtoClass, BulkOperationResultDto,
} from '../dto/cms.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';

const CMS_ROLES = [
  ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.CONTENT_ADMIN, ROLE_SLUGS.REVIEWER,
] as const;

@ApiTags('Admin — CMS Workflow')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard, PermissionGuard)
@Roles(...CMS_ROLES)
@Permissions(PERM.CMS_ACCESS)
@Controller('admin/cms/workflow')
export class CmsWorkflowController {
  constructor(private readonly workflow: CmsWorkflowService) {}

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_UPDATE)
  @ApiOperation({ summary: 'Submit a draft for review' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: SubmitForReviewDtoClass })
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SubmitForReviewSchema)) body: typeof SubmitForReviewSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.submit(id, user, body.notes);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Approve the current review stage' })
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
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Reject or request changes' })
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
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_PUBLISH)
  @ApiOperation({ summary: 'Publish an approved question' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: NotesOnlyDtoClass })
  @ApiResponse({ status: 422, description: 'NOT_PUBLISHABLE' })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NotesOnlySchema)) body: typeof NotesOnlySchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.publish(id, user, body.notes);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_PUBLISH)
  @ApiOperation({ summary: 'Archive a question' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: NotesOnlyDtoClass })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NotesOnlySchema)) body: typeof NotesOnlySchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.archive(id, user, body.notes);
  }

  @Post(':id/flag')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_REVIEW)
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
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Clear a flag' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: NotesOnlyDtoClass })
  async unflag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NotesOnlySchema)) body: typeof NotesOnlySchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.unflag(id, user, body.notes);
  }

  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workflow transition history' })
  @ApiParam({ name: 'id' })
  async history(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.history(id, user);
  }

  // ── Bulk ──────────────────────────────────────────────────────────────────────

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERM.CMS_ACCESS, PERM.QUESTIONS_REVIEW)
  @ApiOperation({ summary: 'Bulk workflow operation', description: 'submit | approve | reject | publish | archive | assign across many questions, with per-item accounting.' })
  @ApiBody({ type: BulkOperationDtoClass })
  @ApiResponse({ status: 200, type: BulkOperationResultDto })
  async bulk(
    @Body(new ZodValidationPipe(BulkOperationSchema)) body: typeof BulkOperationSchema._type,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.bulk(body, user);
  }
}
