/**
 * @file cms-question.service.spec.ts
 * @module Cms/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CmsQuestionService } from '../services/cms-question.service';

const holder = { id: 'holder-1', email: 'h@b.com', role: 'content_admin', subscriptionTier: 'free' as const };
const other  = { id: 'other-1', email: 'o@b.com', role: 'content_author', subscriptionTier: 'free' as const };
const superAdmin = { id: 'sa-1', email: 'sa@b.com', role: 'super_admin', subscriptionTier: 'pro' as const };

const mockPrisma = {
  question: { findFirst: vi.fn().mockResolvedValue({ id: 'q-1' }) },
  questionLock: { updateMany: vi.fn().mockResolvedValue({}), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  reviewAssignment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  reviewComment: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  editorialNote: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  questionReviewWorkflow: { findMany: vi.fn().mockResolvedValue([]) },
};
const mockUserRole = { hasPermission: vi.fn().mockResolvedValue(false) };
const mockQuestionService = { findById: vi.fn() };
const mockSearchService = { getVersions: vi.fn() };
const mockEvents = { emit: vi.fn() };

const build = () => new CmsQuestionService(
  mockPrisma as never, mockUserRole as never, mockQuestionService as never, mockSearchService as never, mockEvents as never,
);

const future = new Date(Date.now() + 600_000);

describe('CmsQuestionService', () => {
  let service: CmsQuestionService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
    mockPrisma.question.findFirst.mockResolvedValue({ id: 'q-1' });
    mockUserRole.hasPermission.mockResolvedValue(false);
  });

  describe('acquireLock()', () => {
    it('creates a lock when none is active', async () => {
      mockPrisma.questionLock.findFirst.mockResolvedValue(null);
      mockPrisma.questionLock.create.mockResolvedValue({ id: 'l-1', questionId: 'q-1', lockedBy: 'holder-1', reason: null, acquiredAt: new Date(), expiresAt: future, releasedAt: null });
      const lock = await service.acquireLock('q-1', {}, holder);
      expect(lock.lockedBy).toBe('holder-1');
      expect(lock.isActive).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith('cms.question.locked', expect.anything());
    });

    it('rejects when another user holds the lock', async () => {
      mockPrisma.questionLock.findFirst.mockResolvedValue({ id: 'l-1', lockedBy: 'someone-else', expiresAt: future, releasedAt: null });
      const err = await service.acquireLock('q-1', {}, holder).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('QUESTION_LOCKED');
    });

    it('extends the lock when the same user re-acquires', async () => {
      mockPrisma.questionLock.findFirst.mockResolvedValue({ id: 'l-1', lockedBy: 'holder-1', expiresAt: future, releasedAt: null });
      mockPrisma.questionLock.update.mockResolvedValue({ id: 'l-1', questionId: 'q-1', lockedBy: 'holder-1', reason: null, acquiredAt: new Date(), expiresAt: future, releasedAt: null });
      const lock = await service.acquireLock('q-1', {}, holder);
      expect(mockPrisma.questionLock.update).toHaveBeenCalled();
      expect(lock.lockedBy).toBe('holder-1');
    });

    it('auto-releases expired locks before checking', async () => {
      mockPrisma.questionLock.findFirst.mockResolvedValue(null);
      mockPrisma.questionLock.create.mockResolvedValue({ id: 'l-2', questionId: 'q-1', lockedBy: 'holder-1', reason: null, acquiredAt: new Date(), expiresAt: future, releasedAt: null });
      await service.acquireLock('q-1', {}, holder);
      expect(mockPrisma.questionLock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ releasedAt: null, expiresAt: expect.objectContaining({ lt: expect.any(Date) }) }) }),
      );
    });
  });

  describe('releaseLock()', () => {
    it('releases when the caller holds the lock', async () => {
      mockPrisma.questionLock.findFirst.mockResolvedValue({ id: 'l-1', lockedBy: 'holder-1', releasedAt: null });
      mockPrisma.questionLock.update.mockResolvedValue({});
      await service.releaseLock('q-1', holder);
      expect(mockPrisma.questionLock.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ releasedAt: expect.any(Date) }) }));
    });

    it('forbids a non-holder without manage permission', async () => {
      mockPrisma.questionLock.findFirst.mockResolvedValue({ id: 'l-1', lockedBy: 'someone-else', releasedAt: null });
      const err = await service.releaseLock('q-1', other).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.getResponse().code).toBe('LOCK_NOT_HELD');
    });

    it('lets a super_admin force-release', async () => {
      mockPrisma.questionLock.findFirst.mockResolvedValue({ id: 'l-1', lockedBy: 'someone-else', releasedAt: null });
      mockPrisma.questionLock.update.mockResolvedValue({});
      await service.releaseLock('q-1', superAdmin);
      expect(mockPrisma.questionLock.update).toHaveBeenCalled();
    });

    it('throws when there is no active lock', async () => {
      mockPrisma.questionLock.findFirst.mockResolvedValue(null);
      await expect(service.releaseLock('q-1', holder)).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignReview()', () => {
    beforeEach(() => mockUserRole.hasPermission.mockResolvedValue(true));

    it('creates an assignment for a stage', async () => {
      mockPrisma.reviewAssignment.findFirst.mockResolvedValue(null);
      mockPrisma.reviewAssignment.create.mockResolvedValue({ id: 'a-1', questionId: 'q-1', assigneeId: 'rev-1', assignedBy: 'holder-1', stage: 'technical', status: 'pending', dueAt: null, assignedAt: new Date(), completedAt: null });
      const a = await service.assignReview('q-1', { assigneeId: 'rev-1', stage: 'technical' } as never, holder);
      expect(a.stage).toBe('technical');
      expect(mockEvents.emit).toHaveBeenCalledWith('cms.review.assigned', expect.anything());
    });

    it('rejects a duplicate active assignment for the same stage', async () => {
      mockPrisma.reviewAssignment.findFirst.mockResolvedValue({ id: 'a-existing' });
      const err = await service.assignReview('q-1', { assigneeId: 'rev-1', stage: 'technical' } as never, holder).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('ASSIGNMENT_EXISTS');
    });

    it('forbids assignment without review/manage permission', async () => {
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.assignReview('q-1', { assigneeId: 'rev-1', stage: 'technical' } as never, other)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateAssignment()', () => {
    it('lets the assignee complete their assignment', async () => {
      mockPrisma.reviewAssignment.findUnique.mockResolvedValue({ id: 'a-1', assigneeId: 'holder-1' });
      mockPrisma.reviewAssignment.update.mockResolvedValue({ id: 'a-1', questionId: 'q-1', assigneeId: 'holder-1', assignedBy: 'x', stage: 'technical', status: 'completed', dueAt: null, assignedAt: new Date(), completedAt: new Date() });
      const a = await service.updateAssignment('a-1', { status: 'completed' } as never, holder);
      expect(a.status).toBe('completed');
      expect(a.completedAt).not.toBeNull();
    });

    it('forbids a stranger from updating an assignment', async () => {
      mockPrisma.reviewAssignment.findUnique.mockResolvedValue({ id: 'a-1', assigneeId: 'someone-else' });
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.updateAssignment('a-1', { status: 'accepted' } as never, other)).rejects.toThrow(ForbiddenException);
    });

    it('throws when the assignment is missing', async () => {
      mockPrisma.reviewAssignment.findUnique.mockResolvedValue(null);
      await expect(service.updateAssignment('ghost', { status: 'accepted' } as never, holder)).rejects.toThrow(NotFoundException);
    });
  });

  describe('comments', () => {
    it('adds a comment and emits an event', async () => {
      mockPrisma.reviewComment.create.mockResolvedValue({ id: 'c-1', questionId: 'q-1', authorId: 'holder-1', parentId: null, stage: null, body: 'hi', isResolved: false, resolvedBy: null, resolvedAt: null, createdAt: new Date() });
      const c = await service.addComment('q-1', { body: 'hi' } as never, holder);
      expect(c.body).toBe('hi');
      expect(mockEvents.emit).toHaveBeenCalledWith('cms.review.comment_added', expect.anything());
    });

    it('resolves a comment', async () => {
      mockPrisma.reviewComment.findFirst.mockResolvedValue({ id: 'c-1', questionId: 'q-1' });
      mockPrisma.reviewComment.update.mockResolvedValue({ id: 'c-1', questionId: 'q-1', authorId: 'a', parentId: null, stage: null, body: 'x', isResolved: true, resolvedBy: 'holder-1', resolvedAt: new Date(), createdAt: new Date() });
      const c = await service.resolveComment('c-1', holder);
      expect(c.isResolved).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith('cms.review.comment_resolved', expect.anything());
    });

    it('lists threaded comments with replies', async () => {
      mockPrisma.reviewComment.findMany.mockResolvedValue([
        { id: 'c-1', questionId: 'q-1', authorId: 'a', parentId: null, stage: null, body: 'root', isResolved: false, resolvedBy: null, resolvedAt: null, createdAt: new Date(),
          replies: [{ id: 'c-2', questionId: 'q-1', authorId: 'b', parentId: 'c-1', stage: null, body: 'reply', isResolved: false, resolvedBy: null, resolvedAt: null, createdAt: new Date() }] },
      ]);
      const comments = await service.listComments('q-1');
      expect(comments[0]!.replies).toHaveLength(1);
      expect(comments[0]!.replies![0]!.body).toBe('reply');
    });

    it('throws resolving a missing comment', async () => {
      mockPrisma.reviewComment.findFirst.mockResolvedValue(null);
      await expect(service.resolveComment('ghost', holder)).rejects.toThrow(NotFoundException);
    });
  });

  describe('editorial notes', () => {
    it('adds a note', async () => {
      mockPrisma.editorialNote.create.mockResolvedValue({ id: 'n-1', questionId: 'q-1', authorId: 'holder-1', category: 'general', body: 'note', isPinned: false, createdAt: new Date(), updatedAt: new Date() });
      const n = await service.addNote('q-1', { body: 'note', category: 'general', isPinned: false } as never, holder);
      expect(n.body).toBe('note');
      expect(mockEvents.emit).toHaveBeenCalledWith('cms.editorial.note_added', expect.anything());
    });

    it('lists notes pinned-first', async () => {
      mockPrisma.editorialNote.findMany.mockResolvedValue([
        { id: 'n-1', questionId: 'q-1', authorId: 'a', category: 'warning', body: 'pinned', isPinned: true, createdAt: new Date(), updatedAt: new Date() },
      ]);
      const notes = await service.listNotes('q-1');
      expect(notes[0]!.isPinned).toBe(true);
      const orderArg = mockPrisma.editorialNote.findMany.mock.calls[0]![0].orderBy;
      expect(orderArg[0]).toEqual({ isPinned: 'desc' });
    });

    it('forbids deleting another author note without manage', async () => {
      mockPrisma.editorialNote.findFirst.mockResolvedValue({ id: 'n-1', authorId: 'someone-else' });
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.deleteNote('n-1', other)).rejects.toThrow(ForbiddenException);
    });

    it('lets the author delete their own note', async () => {
      mockPrisma.editorialNote.findFirst.mockResolvedValue({ id: 'n-1', authorId: 'holder-1' });
      mockPrisma.editorialNote.update.mockResolvedValue({});
      await service.deleteNote('n-1', holder);
      expect(mockPrisma.editorialNote.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }));
    });
  });

  describe('getActivityTimeline()', () => {
    it('merges sources and sorts descending by time', async () => {
      mockPrisma.questionReviewWorkflow.findMany.mockResolvedValue([
        { actionBy: 'u', actionType: 'submit', fromStatus: 'draft', toStatus: 'in_review', notes: null, occurredAt: new Date('2026-01-01') },
      ]);
      mockPrisma.reviewComment.findMany.mockResolvedValue([
        { authorId: 'u', isResolved: false, stage: null, createdAt: new Date('2026-01-03') },
      ]);
      mockPrisma.reviewAssignment.findMany.mockResolvedValue([
        { assignedBy: 'u', stage: 'technical', assigneeId: 'r', status: 'pending', assignedAt: new Date('2026-01-02') },
      ]);
      mockPrisma.questionLock.findMany.mockResolvedValue([]);
      mockPrisma.editorialNote.findMany.mockResolvedValue([]);
      const timeline = await service.getActivityTimeline('q-1', holder);
      expect(timeline).toHaveLength(3);
      // newest first
      expect(timeline[0]!.type).toBe('comment');
      expect(timeline[2]!.type).toBe('workflow');
    });
  });

  describe('delegated reads', () => {
    it('getQuestionDetail delegates to QuestionService', async () => {
      mockQuestionService.findById.mockResolvedValue({ id: 'q-1' });
      await service.getQuestionDetail('q-1', holder);
      expect(mockQuestionService.findById).toHaveBeenCalledWith('q-1', holder);
    });

    it('getVersionHistory delegates to QuestionSearchService', async () => {
      mockSearchService.getVersions.mockResolvedValue([]);
      await service.getVersionHistory('q-1', holder);
      expect(mockSearchService.getVersions).toHaveBeenCalledWith('q-1', holder);
    });
  });
});
