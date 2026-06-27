/**
 * @file dashboard.controller.spec.ts
 * @module Dashboard/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardController } from '../controllers/dashboard.controller';

const svc = {
  getOverview: vi.fn(), getCounts: vi.fn(), getSubjectStatistics: vi.fn(),
  getTopicStatistics: vi.fn(), getAuthorStatistics: vi.fn(), getReviewerStatistics: vi.fn(),
  getRecentActivity: vi.fn(), getReviewQueue: vi.fn(), getQueue: vi.fn(),
};
const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'free' };

describe('DashboardController', () => {
  let ctrl: DashboardController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new DashboardController(svc as never); });

  it('overview/counts/stats/activity/review-queue delegate', async () => {
    Object.values(svc).forEach((fn) => fn.mockResolvedValue({}));
    await ctrl.overview(user as never);
    await ctrl.counts();
    await ctrl.subjects();
    await ctrl.topics();
    await ctrl.authors();
    await ctrl.reviewers();
    await ctrl.activity();
    await ctrl.reviewQueue();
    expect(svc.getOverview).toHaveBeenCalledWith(user);
    expect(svc.getSubjectStatistics).toHaveBeenCalled();
    expect(svc.getReviewerStatistics).toHaveBeenCalled();
    expect(svc.getReviewQueue).toHaveBeenCalled();
  });

  it('queue() delegates for a valid queue', async () => {
    svc.getQueue.mockResolvedValue({ queue: 'draft' });
    await ctrl.queue('draft');
    expect(svc.getQueue).toHaveBeenCalledWith('draft');
  });

  it('queue() rejects an unknown queue', async () => {
    await expect(ctrl.queue('nonsense')).rejects.toThrow();
  });
});
