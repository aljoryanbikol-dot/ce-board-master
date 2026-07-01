import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExamAnalyticsService } from '../services/exam-analytics.service';

const resultWithScores = {
  userId: 'u-1', examId: 'ex-1',
  subjectScores: [{ subjectId: 's-1', total: 10, correct: 5, scorePercent: 50, weightPercent: 30 }, { subjectId: 's-2', total: 10, correct: 9, scorePercent: 90, weightPercent: 70 }],
  topicScores: [{ subjectId: 's-1', topicId: 't-1', total: 5, correct: 2, scorePercent: 40 }, { subjectId: 's-2', topicId: 't-2', total: 5, correct: 5, scorePercent: 100 }],
};

function mocks() {
  const prisma = {
    examResult: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(resultWithScores) },
    examQuestion: { findMany: vi.fn().mockResolvedValue([{ learningObjective: 'LO-1', answer: { isCorrect: true } }, { learningObjective: 'LO-1', answer: { isCorrect: false } }]) },
  };
  const cache = { remember: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()), del: vi.fn() };
  return { prisma, cache, svc: new ExamAnalyticsService(prisma as never, cache as never) };
}

describe('ExamAnalyticsService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('history', () => {
    it('paginates exam results', async () => {
      m.prisma.examResult.findMany.mockResolvedValue([{ id: 'r-1', resultCode: 'C1', examId: 'ex-1', scorePercent: 80, status: 'pass', computedAt: new Date(), exam: { title: 'T', kind: 'subject' } }]);
      const res = await m.svc.history('u-1', 20);
      expect(res.data).toHaveLength(1);
      expect(res.data[0]!.passed).toBe(true);
      expect(res.pagination.hasMore).toBe(false);
    });
    it('caches the first (cursor-less) page per user', async () => {
      await m.svc.history('u-1', 20);
      expect(m.cache.remember).toHaveBeenCalledWith(expect.stringContaining('u-1'), expect.any(Number), expect.any(Function));
    });
    it('does not use the cache for a cursor-paginated request', async () => {
      m.cache.remember.mockClear();
      await m.svc.history('u-1', 20, 'cursor-abc');
      expect(m.cache.remember).not.toHaveBeenCalled();
    });
    it('serves from cache without hitting Prisma again on a second call', async () => {
      m.cache.remember.mockImplementationOnce((_k: string, _t: number, fn: () => unknown) => fn());
      m.cache.remember.mockImplementationOnce(() => ({ data: [], pagination: { cursor: null, hasMore: false } }));
      await m.svc.history('u-1', 20);
      m.prisma.examResult.findMany.mockClear();
      await m.svc.history('u-1', 20);
      expect(m.prisma.examResult.findMany).not.toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('returns subject/topic/LO breakdowns', async () => {
      const res = await m.svc.performance('u-1', 'ex-1');
      expect(res!.bySubject).toHaveLength(2);
      expect(res!.byTopic).toHaveLength(2);
      expect(res!.byLearningObjective[0]!.learningObjective).toBe('LO-1');
      expect(res!.byLearningObjective[0]!.scorePercent).toBe(50); // 1 of 2
    });
    it('returns null for a non-owned result', async () => {
      m.prisma.examResult.findUnique.mockResolvedValue({ ...resultWithScores, userId: 'other' });
      expect(await m.svc.performance('u-1', 'ex-1')).toBeNull();
    });
  });

  describe('weaknessStrength', () => {
    it('classifies weak (<60) and strong (>=80) topics/subjects', async () => {
      const ws = await m.svc.weaknessStrength('u-1', 'ex-1');
      expect(ws!.weaknesses.some((w) => w.topicId === 't-1')).toBe(true); // 40%
      expect(ws!.strengths.some((s) => s.topicId === 't-2')).toBe(true);  // 100%
      expect(ws!.weaknesses.some((w) => w.subjectId === 's-1' && !w.topicId)).toBe(true); // 50%
    });
    it('sorts weaknesses ascending by score', async () => {
      const ws = await m.svc.weaknessStrength('u-1', 'ex-1');
      const scores = ws!.weaknesses.map((w) => w.scorePercent);
      expect(scores).toEqual([...scores].sort((a, b) => a - b));
    });
  });

  describe('leaderboard', () => {
    it('ranks by score desc then time asc', async () => {
      m.prisma.examResult.findMany.mockResolvedValue([{ userId: 'a', scorePercent: 90, timeSpentSec: 1000, resultCode: 'A' }, { userId: 'b', scorePercent: 80, timeSpentSec: 900, resultCode: 'B' }]);
      const board = await m.svc.leaderboard(undefined, 10);
      expect(board[0]!.rank).toBe(1);
      expect(board[0]!.userId).toBe('a');
    });
    it('caches distinctly per template + limit', async () => {
      await m.svc.leaderboard('tpl-1', 10);
      await m.svc.leaderboard('tpl-2', 10);
      const keys = m.cache.remember.mock.calls.map((c: unknown[]) => c[0]);
      expect(new Set(keys).size).toBe(keys.length); // every call used a distinct key
    });
  });
});
