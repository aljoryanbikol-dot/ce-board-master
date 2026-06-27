import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionRecommendationService } from '../services/question-recommendation.service';

function mocks() {
  const prisma = {
    topicMastery: { findMany: vi.fn().mockResolvedValue([]) },
    questionAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    question: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, svc: new QuestionRecommendationService(prisma as never) };
}

describe('QuestionRecommendationService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('prioritizes weak-topic questions the student has not answered', async () => {
    m.prisma.topicMastery.findMany.mockResolvedValue([{ topicId: 't-1', subjectId: 's-1', accuracy: 0.3 }]);
    m.prisma.questionAttempt.findMany.mockResolvedValue([{ questionId: 'q-answered' }]);
    m.prisma.question.findMany.mockResolvedValueOnce([{ id: 'q-1', subjectId: 's-1', topicId: 't-1', difficultyLevelId: 'd-1' }]).mockResolvedValue([]);
    const recs = await m.svc.recommend('u-1', { limit: 5 });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.reason).toMatch(/weak topic/i);
    expect(recs[0]!.priority).toBeGreaterThan(10);
  });

  it('backfills with fresh questions when few weak topics', async () => {
    m.prisma.topicMastery.findMany.mockResolvedValue([]);
    m.prisma.question.findMany.mockResolvedValue([{ id: 'q-2', subjectId: 's-1', topicId: 't-2', difficultyLevelId: null }]);
    const recs = await m.svc.recommend('u-1', { limit: 5 });
    expect(recs.length).toBe(1);
    expect(recs[0]!.reason).toMatch(/broaden|new/i);
  });

  it('respects the limit', async () => {
    m.prisma.topicMastery.findMany.mockResolvedValue([]);
    m.prisma.question.findMany.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: `q-${i}`, subjectId: 's-1', topicId: 't-1', difficultyLevelId: null })));
    const recs = await m.svc.recommend('u-1', { limit: 5 });
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it('excludes already-answered questions from backfill', async () => {
    m.prisma.topicMastery.findMany.mockResolvedValue([]);
    m.prisma.questionAttempt.findMany.mockResolvedValue([{ questionId: 'q-answered' }]);
    m.prisma.question.findMany.mockResolvedValue([]);
    await m.svc.recommend('u-1', { limit: 5 });
    // The backfill query must include a notIn filter (answered ids).
    const call = m.prisma.question.findMany.mock.calls.at(-1)![0];
    expect(JSON.stringify(call)).toContain('notIn');
  });
});
