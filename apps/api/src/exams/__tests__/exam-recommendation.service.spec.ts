import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExamRecommendationService } from '../services/exam-recommendation.service';

function mocks() {
  const prisma = { examResult: { findUnique: vi.fn().mockResolvedValue({ examId: 'ex-1', userId: 'u-1', status: 'fail' }) } };
  const analytics = { weaknessStrength: vi.fn().mockResolvedValue({ weaknesses: [{ subjectId: 's-1', topicId: 't-1', scorePercent: 40 }, { subjectId: 's-1', scorePercent: 50 }], strengths: [] }) };
  const studentRecs = { recommend: vi.fn().mockResolvedValue([{ questionId: 'q-1' }]) };
  return { prisma, analytics, studentRecs, svc: new ExamRecommendationService(prisma as never, analytics as never, studentRecs as never) };
}

describe('ExamRecommendationService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('suggests a focused retake on weak subjects + practice questions', async () => {
    const res = await m.svc.afterExam('u-1', 'ex-1');
    expect(res.weakSubjects).toContain('s-1');
    expect(res.suggestedExam.kind).toBe('custom');
    expect(m.studentRecs.recommend).toHaveBeenCalledWith('u-1', { limit: 10, subjectId: 's-1' });
    expect(res.practiceQuestions).toHaveLength(1);
  });

  it('suggests a full-board maintenance exam when no weaknesses', async () => {
    m.analytics.weaknessStrength.mockResolvedValue({ weaknesses: [], strengths: [] });
    const res = await m.svc.afterExam('u-1', 'ex-1');
    expect(res.suggestedExam.kind).toBe('full_board');
  });

  it('rejects when result not ready', async () => {
    m.prisma.examResult.findUnique.mockResolvedValue(null);
    await expect(m.svc.afterExam('u-1', 'ex-1')).rejects.toThrow(BadRequestException);
  });

  it('enforces ownership', async () => {
    m.prisma.examResult.findUnique.mockResolvedValue({ examId: 'ex-1', userId: 'other', status: 'pass' });
    await expect(m.svc.afterExam('u-1', 'ex-1')).rejects.toThrow(ForbiddenException);
  });
});
