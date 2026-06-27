/**
 * @file cms-analytics.service.spec.ts
 * @module Cms/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CmsAnalyticsService } from '../services/cms-analytics.service';

const mockPrisma = {
  question: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  questionReviewWorkflow: { findMany: vi.fn() },
};
const mockCache = {
  buildKey: vi.fn((ns: string, k: string) => `${ns}:${k}`),
  remember: vi.fn(async (_k: string, _ttl: number, factory: () => unknown) => factory()),
};

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'free' as const };

const build = () => new CmsAnalyticsService(mockPrisma as never, mockCache as never);

describe('CmsAnalyticsService', () => {
  let service: CmsAnalyticsService;
  beforeEach(() => { vi.clearAllMocks(); service = build(); });

  describe('getStatusCounts()', () => {
    it('aggregates counts by status into a totals object', async () => {
      mockPrisma.question.groupBy.mockResolvedValue([
        { questionStatus: 'draft', _count: { _all: 5 } },
        { questionStatus: 'in_review', _count: { _all: 3 } },
        { questionStatus: 'published', _count: { _all: 10 } },
        { questionStatus: 'archived', _count: { _all: 2 } },
      ]);
      const counts = await service.getStatusCounts();
      expect(counts.draft).toBe(5);
      expect(counts.inReview).toBe(3);
      expect(counts.published).toBe(10);
      expect(counts.archived).toBe(2);
      expect(counts.total).toBe(20);
    });

    it('returns zeros when there are no questions', async () => {
      mockPrisma.question.groupBy.mockResolvedValue([]);
      const counts = await service.getStatusCounts();
      expect(counts.total).toBe(0);
    });
  });

  describe('getSubjectStatistics()', () => {
    it('rolls up counts per subject sorted by total desc', async () => {
      mockPrisma.question.groupBy.mockResolvedValue([
        { subjectId: 's-1', questionStatus: 'published', _count: { _all: 8 } },
        { subjectId: 's-1', questionStatus: 'draft', _count: { _all: 2 } },
        { subjectId: 's-2', questionStatus: 'published', _count: { _all: 3 } },
      ]);
      const stats = await service.getSubjectStatistics();
      expect(stats[0]!.id).toBe('s-1');
      expect(stats[0]!.total).toBe(10);
      expect(stats[0]!.published).toBe(8);
      expect(stats[0]!.draft).toBe(2);
      expect(stats[1]!.id).toBe('s-2');
    });
  });

  describe('getReviewerStatistics()', () => {
    it('maps null reviewer to "unassigned"', async () => {
      mockPrisma.question.groupBy.mockResolvedValue([
        { reviewerId: null, questionStatus: 'in_review', _count: { _all: 4 } },
      ]);
      const stats = await service.getReviewerStatistics();
      expect(stats[0]!.id).toBe('unassigned');
      expect(stats[0]!.inReview).toBe(4);
    });
  });

  describe('getReviewQueue()', () => {
    it('lists in_review questions oldest-first', async () => {
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 'q-1', questionCode: 'A-1', subjectId: 's', topicId: 't', authorId: 'au', reviewerId: null, currentVersion: 2, updatedAt: new Date('2026-01-01') },
      ]);
      const queue = await service.getReviewQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]!.waitingSince).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('getRecentActivity()', () => {
    it('returns recent workflow transitions', async () => {
      mockPrisma.questionReviewWorkflow.findMany.mockResolvedValue([
        { id: 'w1', questionId: 'q-1', fromStatus: 'draft', toStatus: 'in_review', actionType: 'submit', actionBy: 'u', occurredAt: new Date('2026-01-02') },
      ]);
      const activity = await service.getRecentActivity();
      expect(activity[0]!.action).toBe('submit');
    });
  });

  describe('getDashboardOverview()', () => {
    it('composes all sections and is served via cache.remember', async () => {
      mockPrisma.question.groupBy.mockResolvedValue([]);
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.questionReviewWorkflow.findMany.mockResolvedValue([]);
      const overview = await service.getDashboardOverview();
      expect(overview).toHaveProperty('counts');
      expect(overview).toHaveProperty('subjectStatistics');
      expect(overview).toHaveProperty('reviewQueue');
      expect(overview).toHaveProperty('recentActivity');
      expect(mockCache.remember).toHaveBeenCalled();
    });
  });

  describe('search()', () => {
    it('applies date-range filters and returns a cursor page', async () => {
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 'q-1', questionCode: 'A-1', subjectId: 's', topicId: 't', subtopicId: 'st', difficultyLevelId: 'd', stemText: 'x', questionStatus: 'draft', bloomLevel: 'apply', authorId: 'au', reviewerId: null, currentVersion: 1, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'), publishedAt: null },
      ]);
      mockPrisma.question.count.mockResolvedValue(1);
      const result = await service.search({ limit: 20, createdFrom: '2026-01-01T00:00:00.000Z' } as never, user);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
      const whereArg = mockPrisma.question.findMany.mock.calls[0]![0].where;
      expect(whereArg.createdAt).toBeDefined();
    });

    it('sets a cursor when results exceed the limit', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({
        id: `q-${i}`, questionCode: `A-${i}`, subjectId: 's', topicId: 't', subtopicId: 'st', difficultyLevelId: 'd',
        stemText: 'x', questionStatus: 'draft', bloomLevel: 'apply', authorId: 'au', reviewerId: null,
        currentVersion: 1, createdAt: new Date(), updatedAt: new Date(), publishedAt: null,
      }));
      mockPrisma.question.findMany.mockResolvedValue(rows);
      mockPrisma.question.count.mockResolvedValue(10);
      const result = await service.search({ limit: 2 } as never, user);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.cursor).toBe('q-1');
    });
  });
});
