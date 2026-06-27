import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentDashboardService } from '../services/student-dashboard.service';

function mocks() {
  const prisma = {
    practiceSession: { findFirst: vi.fn().mockResolvedValue(null) },
    studyGoal: { findUnique: vi.fn().mockResolvedValue({ targetQuestions: 20 }) },
    studentXp: { findUnique: vi.fn().mockResolvedValue({ totalXp: 250, currentStreak: 4, longestStreak: 7, lastActivityDate: new Date() }) },
    questionAttempt: { aggregate: vi.fn().mockResolvedValue({ _count: { _all: 100 } }), count: vi.fn().mockResolvedValue(70) },
    topicMastery: { count: vi.fn().mockResolvedValue(3) },
    studentAchievement: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const cache = { remember: vi.fn((_k: string, _ttl: number, fn: () => unknown) => fn()) };
  const progress = { weakTopics: vi.fn().mockResolvedValue([{ topicId: 't-1' }]), strongTopics: vi.fn().mockResolvedValue([{ topicId: 't-2' }]) };
  const achievements = { levelProgress: vi.fn().mockReturnValue({ level: 2, xpIntoLevel: 50, xpForNextLevel: 300 }) };
  return { prisma, cache, progress, achievements, svc: new StudentDashboardService(prisma as never, cache as never, progress as never, achievements as never) };
}

describe('StudentDashboardService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('aggregates the dashboard from progress + achievements + stats (via cache.remember)', async () => {
    const dash = await m.svc.getDashboard('u-1');
    expect(m.cache.remember).toHaveBeenCalled();
    expect(dash.xp.totalXp).toBe(250);
    expect(dash.xp.level).toBe(2);
    expect(dash.streak.current).toBe(4);
    expect(dash.progress.totalAnswered).toBe(100);
    expect(dash.progress.overallAccuracy).toBeCloseTo(0.7);
    expect(dash.progress.topicsMastered).toBe(3);
    expect(dash.weakTopics).toHaveLength(1);
    expect(dash.strongTopics).toHaveLength(1);
  });

  it('computes the daily goal percentage', async () => {
    m.prisma.questionAttempt.count.mockResolvedValueOnce(70).mockResolvedValueOnce(10); // correct, then answeredToday
    const dash = await m.svc.getDashboard('u-1');
    expect(dash.dailyGoal?.target).toBe(20);
    expect(dash.dailyGoal?.percent).toBeGreaterThanOrEqual(0);
  });

  it('reports no active session when none exists', async () => {
    const dash = await m.svc.getDashboard('u-1');
    expect(dash.continueLearning).toBeNull();
  });
});
