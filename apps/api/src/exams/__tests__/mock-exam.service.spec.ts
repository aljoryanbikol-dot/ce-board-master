/**
 * @file mock-exam.service.spec.ts
 * @module Exams/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnprocessableEntityException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MockExamService } from '../services/mock-exam.service';

function pool(n: number, subjectId = 's-1') {
  return Array.from({ length: n }, (_, i) => ({
    id: `q-${subjectId}-${i}`, subjectId, topicId: `t-${i % 3}`, difficultyLevelId: 'd-1', learningObjective: 'LO-1',
    correctChoice: 'A', choices: [{ choiceLetter: 'A' }, { choiceLetter: 'B' }, { choiceLetter: 'C' }, { choiceLetter: 'D' }],
  }));
}

function mocks() {
  const prisma = {
    examTemplate: { create: vi.fn().mockResolvedValue({ id: 'tpl-1' }), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    question: { findMany: vi.fn().mockResolvedValue(pool(20)), count: vi.fn().mockResolvedValue(20) },
    subject: { findMany: vi.fn().mockResolvedValue([{ id: 's-1', prcWeightPercent: 30 }, { id: 's-2', prcWeightPercent: 70 }]) },
    topicMastery: { findMany: vi.fn().mockResolvedValue([]) },
    questionAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    difficultyLevel: { findMany: vi.fn().mockResolvedValue([{ id: 'd-found', code: 1 }, { id: 'd-inter', code: 2 }, { id: 'd-adv', code: 3 }]) },
  };
  return { prisma, svc: new MockExamService(prisma as never) };
}

describe('MockExamService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('createTemplate', () => {
    it('persists a template with the summed total', async () => {
      await m.svc.createTemplate('u-1', { code: 'FB100', name: 'Full Board', kind: 'full_board', durationMinutes: 180, passingScore: 70, randomizeQuestions: true, randomizeChoices: true, composition: [{ subjectId: 's-1', count: 50 }, { subjectId: 's-2', count: 50 }] } as never);
      expect(m.prisma.examTemplate.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalQuestions: 100 }) }));
    });
  });

  describe('getTemplate', () => {
    it('throws when missing', async () => {
      m.prisma.examTemplate.findUnique.mockResolvedValue(null);
      await expect(m.svc.getTemplate('tpl-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('buildQuestions', () => {
    it('builds the requested count with positions 0..n-1', async () => {
      const built = await m.svc.buildQuestions({ kind: 'subject', composition: [{ subjectId: 's-1', count: 10 }], randomizeChoices: true });
      expect(built).toHaveLength(10);
      const positions = built.map((b) => b.position).sort((a, b) => a - b);
      expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    it('snapshots a choiceOrder permutation of the original letters', async () => {
      const built = await m.svc.buildQuestions({ kind: 'subject', composition: [{ subjectId: 's-1', count: 5 }], randomizeChoices: true });
      for (const q of built) {
        expect([...q.choiceOrder].sort()).toEqual(['A', 'B', 'C', 'D']);
        expect(q.correctChoice).toBe('A');
      }
    });
    it('keeps original order when randomizeChoices is false', async () => {
      const built = await m.svc.buildQuestions({ kind: 'subject', composition: [{ subjectId: 's-1', count: 3 }], randomizeChoices: false });
      for (const q of built) expect(q.choiceOrder).toEqual(['A', 'B', 'C', 'D']);
    });
    it('throws when the pool is too small', async () => {
      m.prisma.question.findMany.mockResolvedValue(pool(3));
      await expect(m.svc.buildQuestions({ kind: 'subject', composition: [{ subjectId: 's-1', count: 10 }], randomizeChoices: true })).rejects.toThrow(UnprocessableEntityException);
    });
    it('combines multiple composition entries', async () => {
      m.prisma.question.findMany.mockResolvedValueOnce(pool(20, 's-1')).mockResolvedValueOnce(pool(20, 's-2'));
      const built = await m.svc.buildQuestions({ kind: 'custom', composition: [{ subjectId: 's-1', count: 5 }, { subjectId: 's-2', count: 5 }], randomizeChoices: true });
      expect(built).toHaveLength(10);
    });
  });

  describe('fullBoardComposition', () => {
    it('weights counts by PRC subject weighting', async () => {
      const comp = await m.svc.fullBoardComposition(100);
      const s1 = comp.find((c) => c.subjectId === 's-1')!;
      const s2 = comp.find((c) => c.subjectId === 's-2')!;
      expect(s1.count).toBe(30); // 30% weight
      expect(s2.count).toBe(70); // 70% weight
    });
    it('throws when there are no active subjects', async () => {
      m.prisma.subject.findMany.mockResolvedValue([]);
      await expect(m.svc.fullBoardComposition(100)).rejects.toThrow(BadRequestException);
    });
  });

  describe('subjectComposition', () => {
    it('produces a single-subject composition', () => {
      expect(m.svc.subjectComposition('s-1', 25)).toEqual([{ subjectId: 's-1', count: 25 }]);
    });
  });

  describe('adaptiveComposition', () => {
    it('falls back to full-board when the student has no mastery history', async () => {
      const comp = await m.svc.adaptiveComposition('u-1', 100);
      expect(m.prisma.subject.findMany).toHaveBeenCalled(); // fullBoardComposition path
      expect(comp.length).toBeGreaterThan(0);
    });

    it('weights a weak subject with more questions than a strong one, banded by difficulty', async () => {
      m.prisma.topicMastery.findMany.mockResolvedValue([
        { subjectId: 's-1', masteryScore: 20 }, // weak
        { subjectId: 's-2', masteryScore: 90 }, // strong
      ]);
      m.prisma.question.count.mockResolvedValue(20); // both pools large enough for difficulty banding
      const comp = await m.svc.adaptiveComposition('u-1', 100);
      const s1Total = comp.filter((c) => c.subjectId === 's-1').reduce((s, c) => s + c.count, 0);
      const s2Total = comp.filter((c) => c.subjectId === 's-2').reduce((s, c) => s + c.count, 0);
      expect(s1Total).toBeGreaterThan(s2Total);
      // Difficulty banding applied since pool is large enough.
      expect(comp.every((c) => c.difficultyLevelId)).toBe(true);
    });

    it('skews toward harder difficulty when recent accuracy is high', async () => {
      m.prisma.topicMastery.findMany.mockResolvedValue([{ subjectId: 's-1', masteryScore: 50 }]);
      m.prisma.questionAttempt.findMany.mockResolvedValue(Array.from({ length: 5 }, () => ({ isCorrect: true })));
      const comp = await m.svc.adaptiveComposition('u-1', 100);
      const advanced = comp.filter((c) => c.difficultyLevelId === 'd-adv').reduce((s, c) => s + c.count, 0);
      const foundational = comp.filter((c) => c.difficultyLevelId === 'd-found').reduce((s, c) => s + c.count, 0);
      expect(advanced).toBeGreaterThan(foundational);
    });

    it('falls back to a flat (non-banded) entry when the subject pool is too small to split by difficulty', async () => {
      m.prisma.topicMastery.findMany.mockResolvedValue([{ subjectId: 's-1', masteryScore: 20 }]);
      m.prisma.question.count.mockResolvedValue(3); // below MIN_POOL_FOR_DIFFICULTY_SPLIT
      const comp = await m.svc.adaptiveComposition('u-1', 100);
      expect(comp).toEqual([{ subjectId: 's-1', count: 3 }]);
    });

    it('excludes subjects with zero published inventory entirely', async () => {
      m.prisma.topicMastery.findMany.mockResolvedValue([{ subjectId: 's-empty', masteryScore: 10 }]);
      m.prisma.question.count.mockResolvedValue(0);
      const comp = await m.svc.adaptiveComposition('u-1', 100);
      // No usable weighted subject → falls back to full-board.
      expect(m.prisma.subject.findMany).toHaveBeenCalled();
    });
  });

  describe('aiGeneratedComposition', () => {
    it('falls back to full-board when the student has no mastery history', async () => {
      const comp = await m.svc.aiGeneratedComposition('u-1', 100);
      expect(comp.length).toBeGreaterThan(0);
    });

    it('boosts a stale (long-unpracticed) topic over a freshly-practiced one at equal mastery', async () => {
      const now = Date.now();
      m.prisma.topicMastery.findMany.mockResolvedValue([
        { subjectId: 's-1', masteryScore: 50, lastPracticedAt: new Date(now - 60 * 86_400_000) }, // 60 days ago
        { subjectId: 's-2', masteryScore: 50, lastPracticedAt: new Date(now - 1 * 86_400_000) }, // 1 day ago
      ]);
      const comp = await m.svc.aiGeneratedComposition('u-1', 100);
      const s1Total = comp.filter((c) => c.subjectId === 's-1').reduce((s, c) => s + c.count, 0);
      const s2Total = comp.filter((c) => c.subjectId === 's-2').reduce((s, c) => s + c.count, 0);
      expect(s1Total).toBeGreaterThan(s2Total);
    });
  });
});
