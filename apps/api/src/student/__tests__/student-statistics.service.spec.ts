import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentStatisticsService } from '../services/student-statistics.service';

function mocks() {
  const prisma = {
    questionAttempt: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _count: { _all: 0 }, _avg: { timeSpentSec: 0 } }),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    topicMastery: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, svc: new StudentStatisticsService(prisma as never) };
}

describe('StudentStatisticsService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('progress bucketing', () => {
    it('buckets attempts by day', async () => {
      const now = new Date();
      m.prisma.questionAttempt.findMany.mockResolvedValue([
        { isCorrect: true, timeSpentSec: 60, attemptedAt: now },
        { isCorrect: false, timeSpentSec: 30, attemptedAt: now },
      ]);
      const result = await m.svc.progress('u-1', { period: 'daily', days: 30 } as never);
      expect(result.period).toBe('daily');
      expect(result.totals.answered).toBe(2);
      expect(result.totals.correct).toBe(1);
      expect(result.totals.accuracy).toBeCloseTo(0.5);
    });
    it('buckets by month', async () => {
      m.prisma.questionAttempt.findMany.mockResolvedValue([{ isCorrect: true, timeSpentSec: 60, attemptedAt: new Date('2026-06-15') }]);
      const result = await m.svc.progress('u-1', { period: 'monthly', days: 90 } as never);
      expect(result.buckets[0]!.date).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('accuracyAndSpeed', () => {
    it('returns all-time and last-7-days summaries', async () => {
      m.prisma.questionAttempt.aggregate.mockResolvedValue({ _count: { _all: 100 }, _avg: { timeSpentSec: 45 } });
      m.prisma.questionAttempt.count.mockResolvedValue(70);
      const result = await m.svc.accuracyAndSpeed('u-1');
      expect(result.allTime.answered).toBe(100);
      expect(result.allTime.accuracy).toBeCloseTo(0.7);
      expect(result.allTime.avgTimeSec).toBe(45);
    });
  });

  describe('distribution', () => {
    it('groups by subject and outcome', async () => {
      m.prisma.questionAttempt.groupBy
        .mockResolvedValueOnce([{ subjectId: 's-1', _count: { _all: 10 } }])
        .mockResolvedValueOnce([{ outcome: 'correct', _count: { _all: 7 } }]);
      const result = await m.svc.distribution('u-1');
      expect(result.bySubject[0]!.count).toBe(10);
      expect(result.byOutcome[0]!.outcome).toBe('correct');
    });
  });

  describe('masteryHeatmap', () => {
    it('returns one cell per practiced topic', async () => {
      m.prisma.topicMastery.findMany.mockResolvedValue([{ subjectId: 's-1', topicId: 't-1', masteryScore: 75, tier: 'proficient', attempts: 20 }]);
      const cells = await m.svc.masteryHeatmap('u-1');
      expect(cells).toHaveLength(1);
      expect(cells[0]!.tier).toBe('proficient');
    });
  });
});
