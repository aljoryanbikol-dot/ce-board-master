import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExamReviewService } from '../services/exam-review.service';

const eqRow = (over = {}) => ({
  id: 'eq-1', position: 0, questionId: 'q-1', choiceOrder: ['A', 'B', 'C', 'D'], correctChoice: 'A',
  answer: { selectedChoice: 'B', isCorrect: false, isBookmarked: false },
  question: { stemText: 'Stem?', correctChoice: 'A', explanationText: 'Because.', choices: [{ choiceLetter: 'A', choiceText: 'a' }, { choiceLetter: 'B', choiceText: 'b' }, { choiceLetter: 'C', choiceText: 'c' }, { choiceLetter: 'D', choiceText: 'd' }] },
  ...over,
});

function mocks() {
  const prisma = {
    mockExam: { findUnique: vi.fn().mockResolvedValue({ id: 'ex-1', userId: 'u-1', status: 'submitted' }) },
    examQuestion: { findMany: vi.fn().mockResolvedValue([eqRow()]) },
  };
  return { prisma, svc: new ExamReviewService(prisma as never) };
}

describe('ExamReviewService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('returns all questions with correctness + explanation', async () => {
    const res = await m.svc.review('u-1', 'ex-1', { filter: 'all' } as never);
    expect(res.count).toBe(1);
    expect(res.items[0]!.explanation).toBe('Because.');
    expect(res.items[0]!.isCorrect).toBe(false);
  });

  it('filters to incorrect answers', async () => {
    m.prisma.examQuestion.findMany.mockResolvedValue([eqRow(), eqRow({ id: 'eq-2', answer: { selectedChoice: 'A', isCorrect: true, isBookmarked: false } })]);
    const res = await m.svc.review('u-1', 'ex-1', { filter: 'incorrect' } as never);
    expect(res.count).toBe(1);
    expect(res.items[0]!.examQuestionId).toBe('eq-1');
  });

  it('filters to bookmarked', async () => {
    m.prisma.examQuestion.findMany.mockResolvedValue([eqRow({ answer: { selectedChoice: 'B', isCorrect: false, isBookmarked: true } })]);
    const res = await m.svc.review('u-1', 'ex-1', { filter: 'bookmarked' } as never);
    expect(res.count).toBe(1);
  });

  it('filters to skipped', async () => {
    m.prisma.examQuestion.findMany.mockResolvedValue([eqRow({ answer: null })]);
    const res = await m.svc.review('u-1', 'ex-1', { filter: 'skipped' } as never);
    expect(res.count).toBe(1);
  });

  it('rejects review before submission', async () => {
    m.prisma.mockExam.findUnique.mockResolvedValue({ id: 'ex-1', userId: 'u-1', status: 'in_progress' });
    await expect(m.svc.review('u-1', 'ex-1', { filter: 'all' } as never)).rejects.toThrow(BadRequestException);
  });

  it('enforces ownership', async () => {
    m.prisma.mockExam.findUnique.mockResolvedValue({ id: 'ex-1', userId: 'other', status: 'submitted' });
    await expect(m.svc.review('u-1', 'ex-1', { filter: 'all' } as never)).rejects.toThrow(ForbiddenException);
  });

  it('throws on missing exam', async () => {
    m.prisma.mockExam.findUnique.mockResolvedValue(null);
    await expect(m.svc.review('u-1', 'ex-1', { filter: 'all' } as never)).rejects.toThrow(NotFoundException);
  });
});
