import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformAnalyticsService } from '../services/platform-analytics.service';

function mocks() {
  const prisma = {
    user: { count: vi.fn().mockResolvedValue(100), findMany: vi.fn().mockResolvedValue([]) },
    subscription: { count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]), findMany: vi.fn().mockResolvedValue([]) },
    subscriptionPlan: { findMany: vi.fn().mockResolvedValue([]) },
    payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 50000 } }) },
    questionAttempt: { count: vi.fn().mockResolvedValue(500), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    mockExam: { count: vi.fn().mockResolvedValue(10), findMany: vi.fn().mockResolvedValue([]) },
    tutorConversation: { count: vi.fn().mockResolvedValue(30), findMany: vi.fn().mockResolvedValue([]) },
    tutorMessage: { findMany: vi.fn().mockResolvedValue([]) },
    question: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, svc: new PlatformAnalyticsService(prisma as never) };
}

describe('PlatformAnalyticsService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('overview() aggregates users, tier split, usage totals, and revenue', async () => {
    m.prisma.subscription.count.mockResolvedValueOnce(20); // premiumUsers
    const result = await m.svc.overview();
    expect(result.totalUsers).toBe(100);
    expect(result.premiumUsers).toBe(20);
    expect(result.freeUsers).toBe(80);
    expect(result.totalQuestionsAnswered).toBe(500);
    expect(result.totalTutorConversations).toBe(30);
  });

  it('userGrowth() buckets user createdAt dates by period', async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([{ createdAt: new Date('2026-06-01') }, { createdAt: new Date('2026-06-01') }, { createdAt: new Date('2026-06-02') }]);
    const result = await m.svc.userGrowth({ period: 'daily', days: 30 });
    expect(result).toEqual([{ date: '2026-06-01', count: 2 }, { date: '2026-06-02', count: 1 }]);
  });

  it('activeUsers() dedupes distinct users per bucket', async () => {
    m.prisma.questionAttempt.findMany.mockResolvedValueOnce([
      { userId: 'u-1', attemptedAt: new Date('2026-06-01') },
      { userId: 'u-1', attemptedAt: new Date('2026-06-01') },
      { userId: 'u-2', attemptedAt: new Date('2026-06-01') },
    ]);
    const result = await m.svc.activeUsers({ period: 'daily', days: 30 });
    expect(result).toEqual([{ date: '2026-06-01', activeUsers: 2 }]);
  });

  it('tierSplit() excludes free-tier plans from premium count', async () => {
    m.prisma.subscription.groupBy.mockResolvedValueOnce([{ planId: 'p-pro', _count: { _all: 5 } }, { planId: 'p-free', _count: { _all: 3 } }]);
    m.prisma.subscriptionPlan.findMany.mockResolvedValueOnce([{ id: 'p-pro', tier: 'pro' }, { id: 'p-free', tier: 'free' }]);
    const result = await m.svc.tierSplit();
    expect(result.premiumUsers).toBe(5);
    expect(result.freeUsers).toBe(95);
  });

  it('revenue() computes MRR normalized to monthly-equivalent by interval', async () => {
    m.prisma.subscription.findMany.mockResolvedValueOnce([
      { planId: 'p1', plan: { id: 'p1', name: 'Monthly', tier: 'pro', interval: 'monthly', priceMinor: 19900 } },
      { planId: 'p2', plan: { id: 'p2', name: 'Quarterly', tier: 'pro', interval: 'quarterly', priceMinor: 49900 } },
    ]);
    const result = await m.svc.revenue(30);
    expect(result.mrrMinor).toBe(19900 + Math.round(49900 / 3));
    expect(result.activeSubscribers).toBe(2);
    expect(result.byPlan).toHaveLength(2);
  });

  it('hardestQuestions() ranks ascending by accuracy and joins question metadata', async () => {
    m.prisma.questionAttempt.groupBy
      .mockResolvedValueOnce([{ questionId: 'q-1', _count: { _all: 10 } }])
      .mockResolvedValueOnce([{ questionId: 'q-1', _count: { _all: 2 } }]);
    m.prisma.question.findMany.mockResolvedValueOnce([{ id: 'q-1', questionCode: 'Q-001', stemText: 'Hard question', subjectId: 's-1' }]);
    const result = await m.svc.hardestQuestions(10);
    expect(result[0].accuracy).toBeCloseTo(0.2);
    expect(result[0].questionCode).toBe('Q-001');
  });

  it('retention() reports 0 for empty cohorts without erroring', async () => {
    m.prisma.user.findMany.mockResolvedValue([]);
    const result = await m.svc.retention();
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.cohortSize === 0 && r.returnRate === 0)).toBe(true);
  });
});
