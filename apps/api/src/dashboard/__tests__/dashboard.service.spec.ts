/**
 * @file dashboard.service.spec.ts
 * @module Dashboard/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../services/dashboard.service';

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'free' as const };

const mockAnalytics = {
  getDashboardOverview: vi.fn(), getStatusCounts: vi.fn(),
  getSubjectStatistics: vi.fn(), getTopicStatistics: vi.fn(),
  getAuthorStatistics: vi.fn(), getReviewerStatistics: vi.fn(),
  getRecentActivity: vi.fn(), getReviewQueue: vi.fn(),
};
const mockPrisma = { question: { findMany: vi.fn() } };

const build = () => new DashboardService(mockAnalytics as never, mockPrisma as never);

describe('DashboardService', () => {
  let service: DashboardService;
  beforeEach(() => { vi.clearAllMocks(); service = build(); });

  it('getOverview delegates to analytics', async () => {
    mockAnalytics.getDashboardOverview.mockResolvedValue({ counts: {} });
    await service.getOverview(user);
    expect(mockAnalytics.getDashboardOverview).toHaveBeenCalled();
  });

  it('stat getters delegate to analytics', async () => {
    mockAnalytics.getStatusCounts.mockResolvedValue({});
    mockAnalytics.getSubjectStatistics.mockResolvedValue([]);
    mockAnalytics.getTopicStatistics.mockResolvedValue([]);
    mockAnalytics.getAuthorStatistics.mockResolvedValue([]);
    mockAnalytics.getReviewerStatistics.mockResolvedValue([]);
    mockAnalytics.getRecentActivity.mockResolvedValue([]);
    mockAnalytics.getReviewQueue.mockResolvedValue([]);
    await service.getCounts();
    await service.getSubjectStatistics();
    await service.getTopicStatistics();
    await service.getAuthorStatistics();
    await service.getReviewerStatistics();
    await service.getRecentActivity();
    await service.getReviewQueue();
    expect(mockAnalytics.getStatusCounts).toHaveBeenCalled();
    expect(mockAnalytics.getSubjectStatistics).toHaveBeenCalled();
    expect(mockAnalytics.getReviewerStatistics).toHaveBeenCalled();
  });

  describe('getQueue()', () => {
    beforeEach(() => {
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 'q-1', questionCode: 'A-1', subjectId: 's', topicId: 't', authorId: 'au', reviewerId: null, currentVersion: 1, updatedAt: new Date('2026-01-02'), createdAt: new Date('2026-01-01') },
      ]);
    });

    it('maps draft queue to draft status', async () => {
      const r = await service.getQueue('draft');
      expect(r.status).toBe('draft');
      expect(r.count).toBe(1);
    });

    it('maps review queue to in_review status', async () => {
      const r = await service.getQueue('review');
      expect(r.status).toBe('in_review');
    });

    it('maps publish queue to APPROVED status (awaiting publish)', async () => {
      const r = await service.getQueue('publish');
      expect(r.status).toBe('approved');
    });

    it('maps archive queue to archived status', async () => {
      const r = await service.getQueue('archive');
      expect(r.status).toBe('archived');
    });
  });
});
