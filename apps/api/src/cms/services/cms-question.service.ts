/**
 * @file cms-question.service.ts
 * @module Cms/Services
 *
 * CmsQuestionService — the CMS coordination layer over the Question Bank.
 *
 * RESPONSIBILITY BOUNDARY (important):
 *  - Question CRUD + version history are DELEGATED to the Sprint 2.6
 *    QuestionService / QuestionSearchService. This service NEVER mutates
 *    question content directly — it composes the frozen services so business
 *    rules (validation, versioning, ownership) live in exactly one place.
 *  - This service OWNS the new CMS collaboration entities: locks, review
 *    assignments, review comments, and editorial notes. Those are genuinely
 *    new persistence introduced by Sprint 2.7.
 *
 * Locking model: pessimistic, time-boxed. Acquiring a lock requires no existing
 * active lock (DB partial-unique index is the final guard). Edits through the
 * CMS should hold the lock; the lock auto-expires so abandoned edits free up.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { UserRoleService } from '../../rbac/services/user-role.service';
import { QuestionService } from '../../questions/services/question.service';
import { QuestionSearchService } from '../../questions/services/question-search.service';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { EVENTS } from '../../common/constants';
import { CmsErrors } from '../cms.errors';
import { LOCK_TTL_SECONDS } from '../constants/cms.constants';
import type {
  AcquireLockDto, AssignReviewDto, UpdateAssignmentDto, CreateCommentDto, CreateNoteDto,
} from '../dto/cms.dto';
import type {
  LockView, AssignmentView, CommentView, EditorialNoteView,
} from '../types/cms.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class CmsQuestionService {
  private readonly logger = new Logger(CmsQuestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userRoleService: UserRoleService,
    private readonly questionService: QuestionService,
    private readonly searchService: QuestionSearchService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Locking ─────────────────────────────────────────────────────────────────

  async acquireLock(questionId: string, dto: AcquireLockDto, user: AuthenticatedUser): Promise<LockView> {
    await this.assertQuestionExists(questionId);

    // Release any expired lock first so a stale lock never blocks forever.
    await this.prisma.questionLock.updateMany({
      where: { questionId, releasedAt: null, expiresAt: { lt: new Date() } },
      data: { releasedAt: new Date() },
    });

    const active = await this.prisma.questionLock.findFirst({
      where: { questionId, releasedAt: null },
    });
    if (active) {
      if (active.lockedBy !== user.id) throw CmsErrors.questionLocked(active.lockedBy);
      // Caller already holds it — extend.
      const extended = await this.prisma.questionLock.update({
        where: { id: active.id },
        data: { expiresAt: this.lockExpiry(dto.ttlSeconds) },
      });
      return this.toLockView(extended);
    }

    const ttl = dto.ttlSeconds ?? LOCK_TTL_SECONDS;
    const lock = await this.prisma.questionLock.create({
      data: {
        questionId, lockedBy: user.id, reason: dto.reason ?? null,
        expiresAt: this.lockExpiry(ttl),
      },
    });
    this.eventEmitter.emit(EVENTS.QUESTION_LOCKED, { questionId, lockedBy: user.id, timestamp: new Date().toISOString() });
    this.logger.log({ message: 'Question locked', questionId, lockedBy: user.id });
    return this.toLockView(lock);
  }

  async releaseLock(questionId: string, user: AuthenticatedUser): Promise<void> {
    const active = await this.prisma.questionLock.findFirst({ where: { questionId, releasedAt: null } });
    if (!active) throw CmsErrors.lockNotFound();
    const isHolder = active.lockedBy === user.id;
    const canOverride = user.role === ROLE_SLUGS.SUPER_ADMIN || await this.userRoleService.hasPermission(user.id, PERM.QUESTIONS_MANAGE);
    if (!isHolder && !canOverride) throw CmsErrors.lockNotHeld();

    await this.prisma.questionLock.update({ where: { id: active.id }, data: { releasedAt: new Date() } });
    this.eventEmitter.emit(EVENTS.QUESTION_UNLOCKED, { questionId, releasedBy: user.id, timestamp: new Date().toISOString() });
    this.logger.log({ message: 'Question unlocked', questionId, releasedBy: user.id });
  }

  async getLock(questionId: string): Promise<LockView | null> {
    const active = await this.prisma.questionLock.findFirst({ where: { questionId, releasedAt: null } });
    if (!active) return null;
    if (active.expiresAt.getTime() < Date.now()) return null;
    return this.toLockView(active);
  }

  // ── Review assignment ────────────────────────────────────────────────────────

  async assignReview(questionId: string, dto: AssignReviewDto, user: AuthenticatedUser): Promise<AssignmentView> {
    await this.assertQuestionExists(questionId);
    await this.assertReviewManage(user);

    const existing = await this.prisma.reviewAssignment.findFirst({
      where: { questionId, stage: dto.stage as never, completedAt: null },
    });
    if (existing) throw CmsErrors.assignmentExists(dto.stage);

    const assignment = await this.prisma.reviewAssignment.create({
      data: {
        questionId, assigneeId: dto.assigneeId, assignedBy: user.id,
        stage: dto.stage as never, dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
    });
    this.eventEmitter.emit(EVENTS.REVIEW_ASSIGNED, { questionId, assigneeId: dto.assigneeId, stage: dto.stage, assignedBy: user.id, timestamp: new Date().toISOString() });
    this.logger.log({ message: 'Review assigned', questionId, assigneeId: dto.assigneeId, stage: dto.stage });
    return this.toAssignmentView(assignment);
  }

  async updateAssignment(assignmentId: string, dto: UpdateAssignmentDto, user: AuthenticatedUser): Promise<AssignmentView> {
    const assignment = await this.prisma.reviewAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw CmsErrors.assignmentNotFound(assignmentId);

    // The assignee may update their own assignment status; managers may update any.
    const isAssignee = assignment.assigneeId === user.id;
    const canManage = user.role === ROLE_SLUGS.SUPER_ADMIN || await this.userRoleService.hasPermission(user.id, PERM.QUESTIONS_MANAGE);
    if (!isAssignee && !canManage) throw CmsErrors.forbidden('Only the assignee or a manager can update this assignment.');

    const completing = dto.status === 'completed' || dto.status === 'declined' || dto.status === 'reassigned';
    const updated = await this.prisma.reviewAssignment.update({
      where: { id: assignmentId },
      data: { status: dto.status as never, ...(completing && { completedAt: new Date() }) },
    });
    return this.toAssignmentView(updated);
  }

  async listAssignments(questionId: string): Promise<AssignmentView[]> {
    const rows = await this.prisma.reviewAssignment.findMany({
      where: { questionId }, orderBy: { assignedAt: 'desc' },
    });
    return rows.map((r: (typeof rows)[number]) => this.toAssignmentView(r));
  }

  // ── Review comments ──────────────────────────────────────────────────────────

  async addComment(questionId: string, dto: CreateCommentDto, user: AuthenticatedUser): Promise<CommentView> {
    await this.assertQuestionExists(questionId);
    const comment = await this.prisma.reviewComment.create({
      data: {
        questionId, authorId: user.id, body: dto.body,
        stage: (dto.stage ?? null) as never, parentId: dto.parentId ?? null,
      },
    });
    this.eventEmitter.emit(EVENTS.REVIEW_COMMENT_ADDED, { questionId, commentId: comment.id, authorId: user.id, timestamp: new Date().toISOString() });
    return this.toCommentView(comment);
  }

  async resolveComment(commentId: string, user: AuthenticatedUser): Promise<CommentView> {
    const comment = await this.prisma.reviewComment.findFirst({ where: { id: commentId, deletedAt: null } });
    if (!comment) throw CmsErrors.commentNotFound(commentId);
    const updated = await this.prisma.reviewComment.update({
      where: { id: commentId },
      data: { isResolved: true, resolvedBy: user.id, resolvedAt: new Date() },
    });
    this.eventEmitter.emit(EVENTS.REVIEW_COMMENT_RESOLVED, { questionId: comment.questionId, commentId, resolvedBy: user.id, timestamp: new Date().toISOString() });
    return this.toCommentView(updated);
  }

  async listComments(questionId: string): Promise<CommentView[]> {
    const rows = await this.prisma.reviewComment.findMany({
      where: { questionId, deletedAt: null, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: { replies: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
    });
    return rows.map((r: (typeof rows)[number]) => ({
      ...this.toCommentView(r),
      replies: (r.replies ?? []).map((rep: (typeof r.replies)[number]) => this.toCommentView(rep)),
    }));
  }

  // ── Editorial notes ──────────────────────────────────────────────────────────

  async addNote(questionId: string, dto: CreateNoteDto, user: AuthenticatedUser): Promise<EditorialNoteView> {
    await this.assertQuestionExists(questionId);
    const note = await this.prisma.editorialNote.create({
      data: {
        questionId, authorId: user.id, body: dto.body,
        category: dto.category as never, isPinned: dto.isPinned,
      },
    });
    this.eventEmitter.emit(EVENTS.EDITORIAL_NOTE_ADDED, { questionId, noteId: note.id, authorId: user.id, timestamp: new Date().toISOString() });
    return this.toNoteView(note);
  }

  async listNotes(questionId: string): Promise<EditorialNoteView[]> {
    const rows = await this.prisma.editorialNote.findMany({
      where: { questionId, deletedAt: null },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r: (typeof rows)[number]) => this.toNoteView(r));
  }

  async deleteNote(noteId: string, user: AuthenticatedUser): Promise<void> {
    const note = await this.prisma.editorialNote.findFirst({ where: { id: noteId, deletedAt: null } });
    if (!note) throw CmsErrors.noteNotFound(noteId);
    const isAuthor = note.authorId === user.id;
    const canManage = user.role === ROLE_SLUGS.SUPER_ADMIN || await this.userRoleService.hasPermission(user.id, PERM.QUESTIONS_MANAGE);
    if (!isAuthor && !canManage) throw CmsErrors.forbidden('Only the note author or a manager can delete this note.');
    await this.prisma.editorialNote.update({ where: { id: noteId }, data: { deletedAt: new Date() } });
  }

  // ── Delegated reads (compose Sprint 2.6 services — no direct content access) ──

  /** Full question detail, delegated to the Question Bank. */
  async getQuestionDetail(questionId: string, user: AuthenticatedUser) {
    return this.questionService.findById(questionId, user);
  }

  /** Version history, delegated to the Question Bank search service. */
  async getVersionHistory(questionId: string, user: AuthenticatedUser) {
    return this.searchService.getVersions(questionId, user);
  }

  /**
   * Activity timeline: a merged, time-ordered view of workflow transitions,
   * comments, assignments, locks, and editorial notes for one question. This is
   * a CMS read concern, so it lives here; it reads the audit/collaboration rows
   * directly (these tables are owned by this module).
   */
  async getActivityTimeline(questionId: string, _user: AuthenticatedUser) {
    await this.assertQuestionExists(questionId);
    const [workflow, comments, assignments, locks, notes] = await Promise.all([
      this.prisma.questionReviewWorkflow.findMany({ where: { questionId }, orderBy: { occurredAt: 'desc' }, take: 50 }),
      this.prisma.reviewComment.findMany({ where: { questionId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.reviewAssignment.findMany({ where: { questionId }, orderBy: { assignedAt: 'desc' }, take: 50 }),
      this.prisma.questionLock.findMany({ where: { questionId }, orderBy: { acquiredAt: 'desc' }, take: 20 }),
      this.prisma.editorialNote.findMany({ where: { questionId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    const entries = [
      ...workflow.map((w: (typeof workflow)[number]) => ({ type: 'workflow', questionId, actorId: w.actionBy, summary: `${w.actionType}: ${w.fromStatus ?? '∅'} → ${w.toStatus}`, occurredAt: w.occurredAt.toISOString(), meta: { notes: w.notes } })),
      ...comments.map((c: (typeof comments)[number]) => ({ type: 'comment', questionId, actorId: c.authorId, summary: c.isResolved ? 'Comment (resolved)' : 'Comment', occurredAt: c.createdAt.toISOString(), meta: { stage: c.stage } })),
      ...assignments.map((a: (typeof assignments)[number]) => ({ type: 'assignment', questionId, actorId: a.assignedBy, summary: `Assigned ${a.stage} → ${a.assigneeId} (${a.status})`, occurredAt: a.assignedAt.toISOString() })),
      ...locks.map((l: (typeof locks)[number]) => ({ type: 'lock', questionId, actorId: l.lockedBy, summary: l.releasedAt ? 'Lock released' : 'Lock acquired', occurredAt: l.acquiredAt.toISOString() })),
      ...notes.map((n: (typeof notes)[number]) => ({ type: 'note', questionId, actorId: n.authorId, summary: `Editorial note (${n.category})`, occurredAt: n.createdAt.toISOString() })),
    ];
    entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return entries;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private lockExpiry(ttlSeconds?: number): Date {
    return new Date(Date.now() + (ttlSeconds ?? LOCK_TTL_SECONDS) * 1000);
  }

  private async assertQuestionExists(questionId: string): Promise<void> {
    const q = await this.prisma.question.findFirst({ where: { id: questionId, deletedAt: null }, select: { id: true } });
    if (!q) {
      // Reuse the Question Bank's canonical not-found shape via its service-less check.
      throw CmsErrors.forbidden(`Question not found or inaccessible: ${questionId}`);
    }
  }

  private async assertReviewManage(user: AuthenticatedUser): Promise<void> {
    if (user.role === ROLE_SLUGS.SUPER_ADMIN) return;
    const canReview = await this.userRoleService.hasPermission(user.id, PERM.QUESTIONS_REVIEW);
    const canManage = await this.userRoleService.hasPermission(user.id, PERM.QUESTIONS_MANAGE);
    if (!canReview && !canManage) throw CmsErrors.forbidden('Assigning reviews requires review or manage permission.');
  }

  private toLockView(l: { id: string; questionId: string; lockedBy: string; reason: string | null; acquiredAt: Date; expiresAt: Date; releasedAt: Date | null }): LockView {
    return {
      id: l.id, questionId: l.questionId, lockedBy: l.lockedBy, reason: l.reason,
      acquiredAt: l.acquiredAt.toISOString(), expiresAt: l.expiresAt.toISOString(),
      isActive: l.releasedAt === null && l.expiresAt.getTime() >= Date.now(),
    };
  }

  private toAssignmentView(a: { id: string; questionId: string; assigneeId: string; assignedBy: string; stage: string; status: string; dueAt: Date | null; assignedAt: Date; completedAt: Date | null }): AssignmentView {
    return {
      id: a.id, questionId: a.questionId, assigneeId: a.assigneeId, assignedBy: a.assignedBy,
      stage: a.stage, status: a.status, dueAt: a.dueAt?.toISOString() ?? null,
      assignedAt: a.assignedAt.toISOString(), completedAt: a.completedAt?.toISOString() ?? null,
    };
  }

  private toCommentView(c: { id: string; questionId: string; authorId: string; parentId: string | null; stage: string | null; body: string; isResolved: boolean; resolvedBy: string | null; resolvedAt: Date | null; createdAt: Date }): CommentView {
    return {
      id: c.id, questionId: c.questionId, authorId: c.authorId, parentId: c.parentId,
      stage: c.stage, body: c.body, isResolved: c.isResolved, resolvedBy: c.resolvedBy,
      resolvedAt: c.resolvedAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(),
    };
  }

  private toNoteView(n: { id: string; questionId: string; authorId: string; category: string; body: string; isPinned: boolean; createdAt: Date; updatedAt: Date }): EditorialNoteView {
    return {
      id: n.id, questionId: n.questionId, authorId: n.authorId, category: n.category,
      body: n.body, isPinned: n.isPinned, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString(),
    };
  }
}
