/**
 * @file question-workflow.service.ts
 * @module Questions/Services
 *
 * QuestionWorkflowService — owns every status transition and the multi-stage
 * review pipeline. Each transition:
 *   1. loads the question + asserts permission/ownership
 *   2. validates the transition against the status machine (TRANSITIONS)
 *   3. applies the new status (and stage, for in_review)
 *   4. appends an immutable QuestionReviewWorkflow row (audit)
 *   5. invalidates caches + emits an event
 *
 * The 6-stage editorial pipeline (technical → educational → editorial → qa)
 * lives under the single `in_review` status. `approve` advances the stage;
 * approving the final stage (qa) moves status to `approved`. The active stage
 * is recorded in the workflow note as "stage:<name>" and read back by
 * QuestionService.resolveReviewStage — no schema change.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuestionStatus, ReviewAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { UserRoleService } from '../../rbac/services/user-role.service';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { EVENTS } from '../../common/constants';
import { QuestionErrors } from '../questions.errors';
import { findTransition, type QStatus } from '../constants/status-machine';
import {
  REVIEW_STAGE_ORDER,
  REVIEW_STAGES,
  QUESTION_CACHE_PREFIX,
  QUESTION_LIST_CACHE_PREFIX,
  type ReviewStage,
} from '../constants/questions.constants';
import type { WorkflowEntry } from '../types/questions.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class QuestionWorkflowService {
  private readonly logger = new Logger(QuestionWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly userRoleService: UserRoleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Submit for review (draft → in_review @ technical) ───────────────────────

  async submitForReview(id: string, requester: AuthenticatedUser, notes?: string) {
    const q = await this.load(id);
    await this.assertOwnerOrManage(q.authorId, requester);
    this.assertTransition(q.questionStatus, ReviewAction.submit);

    await this.transition({
      id, from: q.questionStatus, to: QuestionStatus.in_review, action: ReviewAction.submit,
      actorId: requester.id, version: q.currentVersion,
      note: this.stageNote(REVIEW_STAGES.TECHNICAL, notes),
    });

    this.eventEmitter.emit(EVENTS.QUESTION_SUBMITTED, { questionId: id, actorId: requester.id, stage: REVIEW_STAGES.TECHNICAL, timestamp: new Date().toISOString() });
    return this.statusResult(id, QuestionStatus.in_review, REVIEW_STAGES.TECHNICAL);
  }

  // ── Approve (advance stage, or in_review → approved at final stage) ──────────

  async approve(id: string, requester: AuthenticatedUser, notes?: string) {
    const q = await this.load(id);
    await this.assertReviewer(requester);
    this.assertTransition(q.questionStatus, ReviewAction.approve);

    const currentStage = await this.currentStage(id);
    const idx = REVIEW_STAGE_ORDER.indexOf(currentStage);
    const isFinalStage = idx === REVIEW_STAGE_ORDER.length - 1;

    if (!isFinalStage) {
      // Advance to the next review stage; status stays in_review.
      const nextStage = REVIEW_STAGE_ORDER[idx + 1]!;
      await this.transition({
        id, from: QuestionStatus.in_review, to: QuestionStatus.in_review, action: ReviewAction.approve,
        actorId: requester.id, version: q.currentVersion, note: this.stageNote(nextStage, notes),
        setReviewer: requester.id,
      });
      this.eventEmitter.emit(EVENTS.QUESTION_APPROVED, { questionId: id, actorId: requester.id, stage: nextStage, final: false, timestamp: new Date().toISOString() });
      return this.statusResult(id, QuestionStatus.in_review, nextStage);
    }

    // Final stage (qa) approved → status approved (publish-ready).
    await this.transition({
      id, from: QuestionStatus.in_review, to: QuestionStatus.approved, action: ReviewAction.approve,
      actorId: requester.id, version: q.currentVersion, note: notes ?? 'QA approved — ready to publish',
      setReviewer: requester.id,
    });
    this.eventEmitter.emit(EVENTS.QUESTION_APPROVED, { questionId: id, actorId: requester.id, stage: REVIEW_STAGES.QA, final: true, timestamp: new Date().toISOString() });
    return this.statusResult(id, QuestionStatus.approved, null);
  }

  // ── Reject / request changes (→ draft) ──────────────────────────────────────

  async reject(id: string, requester: AuthenticatedUser, reason: string, requestChanges: boolean) {
    const q = await this.load(id);
    await this.assertReviewer(requester);
    const action = requestChanges ? ReviewAction.request_changes : ReviewAction.reject;
    this.assertTransition(q.questionStatus, action);

    await this.transition({
      id, from: q.questionStatus, to: QuestionStatus.draft, action,
      actorId: requester.id, version: q.currentVersion, note: reason,
    });
    this.eventEmitter.emit(EVENTS.QUESTION_REJECTED, { questionId: id, actorId: requester.id, reason, requestChanges, timestamp: new Date().toISOString() });
    return this.statusResult(id, QuestionStatus.draft, null);
  }

  // ── Publish (approved → published) ──────────────────────────────────────────

  async publish(id: string, requester: AuthenticatedUser, notes?: string) {
    const q = await this.load(id);
    await this.assertPermission(requester, PERM.QUESTIONS_PUBLISH);

    if (q.questionStatus === QuestionStatus.published) throw QuestionErrors.alreadyPublished();
    if (q.questionStatus !== QuestionStatus.approved) throw QuestionErrors.notPublishable(q.questionStatus);

    await this.transition({
      id, from: q.questionStatus, to: QuestionStatus.published, action: ReviewAction.publish,
      actorId: requester.id, version: q.currentVersion, note: notes ?? 'Published',
      setPublished: requester.id,
    });
    // Mark the current version as published
    await this.prisma.questionVersion.updateMany({ where: { questionId: id, isCurrent: true }, data: { publishedAt: new Date() } });

    this.eventEmitter.emit(EVENTS.QUESTION_PUBLISHED, { questionId: id, actorId: requester.id, timestamp: new Date().toISOString() });
    return this.statusResult(id, QuestionStatus.published, null);
  }

  // ── Archive ──────────────────────────────────────────────────────────────────

  async archive(id: string, requester: AuthenticatedUser, notes?: string) {
    const q = await this.load(id);
    await this.assertPermission(requester, PERM.QUESTIONS_PUBLISH);
    this.assertTransition(q.questionStatus, ReviewAction.archive);

    await this.transition({
      id, from: q.questionStatus, to: QuestionStatus.archived, action: ReviewAction.archive,
      actorId: requester.id, version: q.currentVersion, note: notes ?? 'Archived',
    });
    this.eventEmitter.emit(EVENTS.QUESTION_ARCHIVED, { questionId: id, actorId: requester.id, timestamp: new Date().toISOString() });
    return this.statusResult(id, QuestionStatus.archived, null);
  }

  // ── Admin direct status set (CMS shortcut) ──────────────────────────────────
  // The formal pipeline is draft→in_review→approved→published. Admins managing
  // the question bank need a one-click Publish/Unpublish/Archive that bypasses
  // the review stages. Requires questions.publish; reuses the transition + audit
  // primitive so history and cache invalidation are consistent.

  async adminSetStatus(id: string, requester: AuthenticatedUser, to: QuestionStatus, notes?: string) {
    const q = await this.load(id);
    await this.assertPermission(requester, PERM.QUESTIONS_PUBLISH);
    if (q.questionStatus === to) return this.statusResult(id, to, null);

    const action =
      to === QuestionStatus.published ? ReviewAction.publish
      : to === QuestionStatus.archived ? ReviewAction.archive
      : ReviewAction.reject;

    await this.transition({
      id, from: q.questionStatus, to, action,
      actorId: requester.id, version: q.currentVersion,
      note: notes ?? `Status set to ${to} (admin)`,
      ...(to === QuestionStatus.published ? { setPublished: requester.id } : {}),
    });
    if (to === QuestionStatus.published) {
      await this.prisma.questionVersion.updateMany({ where: { questionId: id, isCurrent: true }, data: { publishedAt: new Date() } });
    }
    return this.statusResult(id, to, null);
  }

  // ── Flag / unflag ────────────────────────────────────────────────────────────

  async flag(id: string, requester: AuthenticatedUser, reason: string) {
    const q = await this.load(id);
    await this.assertPermission(requester, PERM.QUESTIONS_REVIEW);
    this.assertTransition(q.questionStatus, ReviewAction.flag);

    await this.transition({
      id, from: q.questionStatus, to: QuestionStatus.flagged, action: ReviewAction.flag,
      actorId: requester.id, version: q.currentVersion, note: reason,
    });
    this.eventEmitter.emit(EVENTS.QUESTION_FLAGGED, { questionId: id, actorId: requester.id, reason, timestamp: new Date().toISOString() });
    return this.statusResult(id, QuestionStatus.flagged, null);
  }

  async unflag(id: string, requester: AuthenticatedUser, notes?: string) {
    const q = await this.load(id);
    await this.assertPermission(requester, PERM.QUESTIONS_REVIEW);
    this.assertTransition(q.questionStatus, ReviewAction.unflag);

    await this.transition({
      id, from: q.questionStatus, to: QuestionStatus.published, action: ReviewAction.unflag,
      actorId: requester.id, version: q.currentVersion, note: notes ?? 'Flag cleared',
    });
    return this.statusResult(id, QuestionStatus.published, null);
  }

  // ── Workflow history ────────────────────────────────────────────────────────

  async getWorkflowHistory(id: string, requester: AuthenticatedUser): Promise<WorkflowEntry[]> {
    const q = await this.load(id);
    // Anyone who can read the question can see its history; managers always can.
    if (
      q.questionStatus !== QuestionStatus.published &&
      requester.id !== q.authorId &&
      requester.role !== ROLE_SLUGS.SUPER_ADMIN
    ) {
      const canReview = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_REVIEW);
      const canManage = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_MANAGE);
      if (!canReview && !canManage) throw QuestionErrors.forbiddenOwnership();
    }

    const rows = await this.prisma.questionReviewWorkflow.findMany({
      where: { questionId: id },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((r: (typeof rows)[number]) => ({
      id: r.id, versionNumber: r.versionNumber, fromStatus: r.fromStatus, toStatus: r.toStatus,
      actionType: r.actionType, actionBy: r.actionBy, notes: r.notes, occurredAt: r.occurredAt.toISOString(),
    }));
  }

  // ── Core transition primitive ────────────────────────────────────────────────

  private async transition(params: {
    id: string; from: QuestionStatus; to: QuestionStatus; action: ReviewAction;
    actorId: string; version: number; note: string;
    setReviewer?: string; setPublished?: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.question.update({
        where: { id: params.id },
        data: {
          questionStatus: params.to,
          ...(params.setReviewer && { reviewerId: params.setReviewer }),
          ...(params.setPublished && { publishedBy: params.setPublished, publishedAt: new Date() }),
        },
      });
      await tx.questionReviewWorkflow.create({
        data: {
          questionId: params.id, versionNumber: params.version,
          fromStatus: params.from, toStatus: params.to, actionType: params.action,
          actionBy: params.actorId, notes: params.note,
        },
      });
    });
    await this.invalidateCaches(params.id);
    this.logger.log({ message: 'Question transition', questionId: params.id, from: params.from, to: params.to, action: params.action, actorId: params.actorId });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async load(id: string) {
    const q = await this.prisma.question.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, questionStatus: true, currentVersion: true },
    });
    if (!q) throw QuestionErrors.notFound(id);
    return q;
  }

  private assertTransition(from: string, action: ReviewAction): void {
    const rule = findTransition(from as QStatus, action);
    if (!rule) throw QuestionErrors.invalidTransition(from, action);
  }

  private async currentStage(id: string): Promise<ReviewStage> {
    const latest = await this.prisma.questionReviewWorkflow.findFirst({
      where: { questionId: id, toStatus: QuestionStatus.in_review },
      orderBy: { occurredAt: 'desc' },
      select: { notes: true },
    });
    const stage = latest?.notes?.match(/stage:(\w+)/)?.[1];
    return (stage as ReviewStage) ?? REVIEW_STAGES.TECHNICAL;
  }

  private stageNote(stage: ReviewStage, notes?: string): string {
    return notes ? `stage:${stage} ${notes}` : `stage:${stage}`;
  }

  private async statusResult(id: string, status: QuestionStatus, stage: ReviewStage | null) {
    return { id, status, reviewStage: stage };
  }

  private async assertOwnerOrManage(authorId: string, requester: AuthenticatedUser): Promise<void> {
    if (requester.id === authorId) return;
    if (requester.role === ROLE_SLUGS.SUPER_ADMIN) return;
    const hasManage = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_MANAGE);
    if (!hasManage) throw QuestionErrors.forbiddenOwnership();
  }

  private async assertReviewer(requester: AuthenticatedUser): Promise<void> {
    if (requester.role === ROLE_SLUGS.SUPER_ADMIN) return;
    const hasReview = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_REVIEW);
    const hasManage = await this.userRoleService.hasPermission(requester.id, PERM.QUESTIONS_MANAGE);
    if (!hasReview && !hasManage) throw QuestionErrors.forbiddenOwnership();
  }

  private async assertPermission(requester: AuthenticatedUser, permission: string): Promise<void> {
    if (requester.role === ROLE_SLUGS.SUPER_ADMIN) return;
    const has = await this.userRoleService.hasPermission(requester.id, permission);
    if (!has) throw QuestionErrors.forbiddenOwnership();
  }

  private async invalidateCaches(id: string): Promise<void> {
    await Promise.all([
      this.cache.del(`${QUESTION_CACHE_PREFIX}${id}`),
      this.cache.invalidatePattern(`${QUESTION_LIST_CACHE_PREFIX}*`),
    ]);
  }
}
