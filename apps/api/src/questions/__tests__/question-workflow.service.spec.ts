/**
 * @file question-workflow.service.spec.ts
 * @module Questions/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { QuestionWorkflowService } from '../services/question-workflow.service';
import { REVIEW_STAGES } from '../constants/questions.constants';

const author = { id: 'author-1', email: 'a@b.com', role: 'content_author', subscriptionTier: 'free' as const };
const reviewer = { id: 'rev-1', email: 'r@b.com', role: 'reviewer', subscriptionTier: 'free' as const };
const admin = { id: 'adm-1', email: 'adm@b.com', role: 'admin', subscriptionTier: 'pro' as const };
const superAdmin = { id: 'sa-1', email: 'sa@b.com', role: 'super_admin', subscriptionTier: 'pro' as const };

const tx = {
  question: { update: vi.fn().mockResolvedValue({}) },
  questionReviewWorkflow: { create: vi.fn().mockResolvedValue({}) },
};
const mockPrisma = {
  question: { findFirst: vi.fn() },
  questionReviewWorkflow: { findFirst: vi.fn(), findMany: vi.fn() },
  questionVersion: { updateMany: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};
const mockCache = { del: vi.fn(), invalidatePattern: vi.fn() };
const mockUserRole = { hasPermission: vi.fn().mockResolvedValue(false) };
const mockEvents = { emit: vi.fn() };

const build = () => new QuestionWorkflowService(
  mockPrisma as never, mockCache as never, mockUserRole as never, mockEvents as never,
);

const q = (over: Record<string, unknown> = {}) => ({
  id: 'q-1', authorId: 'author-1', questionStatus: 'draft', currentVersion: 1, ...over,
});

describe('QuestionWorkflowService', () => {
  let service: QuestionWorkflowService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
    mockUserRole.hasPermission.mockResolvedValue(false);
    mockPrisma.questionReviewWorkflow.findFirst.mockResolvedValue(null);
  });

  describe('submitForReview()', () => {
    it('moves draft → in_review at the technical stage', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'draft' }));
      const result = await service.submitForReview('q-1', author);
      expect(result.status).toBe('in_review');
      expect(result.reviewStage).toBe(REVIEW_STAGES.TECHNICAL);
      expect(tx.questionReviewWorkflow.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ toStatus: 'in_review', actionType: 'submit' }) }),
      );
    });

    it('rejects submit from a non-draft status', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'published' }));
      await expect(service.submitForReview('q-1', author)).rejects.toThrow(UnprocessableEntityException);
    });

    it('forbids a non-owner without manage permission', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ authorId: 'someone-else' }));
      await expect(service.submitForReview('q-1', author)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approve() — stage advancement', () => {
    beforeEach(() => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'in_review' }));
      mockUserRole.hasPermission.mockResolvedValue(true); // reviewer permission
    });

    it('advances technical → educational (stays in_review)', async () => {
      mockPrisma.questionReviewWorkflow.findFirst.mockResolvedValue({ notes: 'stage:technical' });
      const result = await service.approve('q-1', reviewer);
      expect(result.status).toBe('in_review');
      expect(result.reviewStage).toBe(REVIEW_STAGES.EDUCATIONAL);
    });

    it('advances educational → editorial', async () => {
      mockPrisma.questionReviewWorkflow.findFirst.mockResolvedValue({ notes: 'stage:educational' });
      const result = await service.approve('q-1', reviewer);
      expect(result.reviewStage).toBe(REVIEW_STAGES.EDITORIAL);
    });

    it('advances editorial → qa', async () => {
      mockPrisma.questionReviewWorkflow.findFirst.mockResolvedValue({ notes: 'stage:editorial' });
      const result = await service.approve('q-1', reviewer);
      expect(result.reviewStage).toBe(REVIEW_STAGES.QA);
    });

    it('final QA approval → status approved (publish-ready)', async () => {
      mockPrisma.questionReviewWorkflow.findFirst.mockResolvedValue({ notes: 'stage:qa' });
      const result = await service.approve('q-1', reviewer);
      expect(result.status).toBe('approved');
      expect(result.reviewStage).toBeNull();
      expect(mockEvents.emit).toHaveBeenCalledWith('question.approved', expect.objectContaining({ final: true }));
    });

    it('forbids approval by a non-reviewer', async () => {
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.approve('q-1', author)).rejects.toThrow(ForbiddenException);
    });

    it('allows super_admin to approve without explicit permission', async () => {
      mockUserRole.hasPermission.mockResolvedValue(false);
      mockPrisma.questionReviewWorkflow.findFirst.mockResolvedValue({ notes: 'stage:technical' });
      const result = await service.approve('q-1', superAdmin);
      expect(result.reviewStage).toBe(REVIEW_STAGES.EDUCATIONAL);
    });
  });

  describe('reject()', () => {
    it('returns an in_review question to draft with a reason', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'in_review' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      const result = await service.reject('q-1', reviewer, 'Ambiguous units', false);
      expect(result.status).toBe('draft');
      expect(mockEvents.emit).toHaveBeenCalledWith('question.rejected', expect.objectContaining({ reason: 'Ambiguous units' }));
    });

    it('records request_changes as the action when flagged', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'in_review' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      await service.reject('q-1', reviewer, 'Please clarify', true);
      expect(tx.questionReviewWorkflow.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ actionType: 'request_changes' }) }),
      );
    });
  });

  describe('publish()', () => {
    it('publishes an approved question', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'approved' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      const result = await service.publish('q-1', admin);
      expect(result.status).toBe('published');
      expect(mockPrisma.questionVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ publishedAt: expect.any(Date) }) }),
      );
    });

    it('refuses to publish a non-approved question', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'draft' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      const err = await service.publish('q-1', admin).catch((e) => e);
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect(err.getResponse().code).toBe('NOT_PUBLISHABLE');
    });

    it('reports already-published', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'published' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      const err = await service.publish('q-1', admin).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('ALREADY_PUBLISHED');
    });

    it('forbids publish without publish permission', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'approved' }));
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.publish('q-1', author)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('archive() / flag() / unflag()', () => {
    it('archives a published question', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'published' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      const result = await service.archive('q-1', admin);
      expect(result.status).toBe('archived');
    });

    it('flags a published question', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'published' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      const result = await service.flag('q-1', reviewer, 'Reported wrong key');
      expect(result.status).toBe('flagged');
    });

    it('unflags back to published', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'flagged' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      const result = await service.unflag('q-1', reviewer);
      expect(result.status).toBe('published');
    });

    it('rejects an illegal transition (archive from draft)', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'draft' }));
      mockUserRole.hasPermission.mockResolvedValue(true);
      await expect(service.archive('q-1', admin)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('getWorkflowHistory()', () => {
    it('returns the transition log ascending', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(q({ questionStatus: 'published' }));
      mockPrisma.questionReviewWorkflow.findMany.mockResolvedValue([
        { id: 'w1', versionNumber: 1, fromStatus: 'draft', toStatus: 'in_review', actionType: 'submit', actionBy: 'author-1', notes: 'stage:technical', occurredAt: new Date('2026-01-01') },
        { id: 'w2', versionNumber: 1, fromStatus: 'in_review', toStatus: 'approved', actionType: 'approve', actionBy: 'rev-1', notes: null, occurredAt: new Date('2026-01-02') },
      ]);
      const history = await service.getWorkflowHistory('q-1', author);
      expect(history).toHaveLength(2);
      expect(history[0]!.toStatus).toBe('in_review');
      expect(history[1]!.actionType).toBe('approve');
    });
  });
});
