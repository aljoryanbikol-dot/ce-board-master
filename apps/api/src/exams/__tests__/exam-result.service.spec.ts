/**
 * @file exam-result.service.spec.ts
 * @module Exams/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExamResultService } from '../services/exam-result.service';
import { ExamScoringService } from '../services/exam-scoring.service';

const resultRow = {
  id: 'res-1', examId: 'ex-1', userId: 'u-1', resultCode: 'CEBM-EX-ABCD1234', status: 'pass',
  totalQuestions: 2, answeredCount: 2, correctCount: 2, incorrectCount: 0, skippedCount: 0,
  scorePercent: 100, passingScore: 70, timeSpentSec: 100, percentile: null, computedAt: new Date(),
  subjectScores: [{ subjectId: 's-1', total: 2, correct: 2, scorePercent: 100, weightPercent: null }],
  topicScores: [{ subjectId: 's-1', topicId: 't-1', total: 2, correct: 2, scorePercent: 100 }],
};

function mocks() {
  const tx = {
    examAnswer: { update: vi.fn().mockResolvedValue({}) },
    examResult: { create: vi.fn().mockResolvedValue({ id: 'res-1' }) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    examResult: { findUnique: vi.fn().mockResolvedValue(null), findUniqueOrThrow: vi.fn().mockResolvedValue(resultRow), count: vi.fn().mockResolvedValue(0) },
    examQuestion: { findMany: vi.fn().mockResolvedValue([
      { id: 'eq-1', subjectId: 's-1', topicId: 't-1', correctChoice: 'A', choiceOrder: ['A', 'B', 'C', 'D'], answer: { id: 'ea-1', selectedChoice: 'A' } },
      { id: 'eq-2', subjectId: 's-1', topicId: 't-1', correctChoice: 'B', choiceOrder: ['B', 'A', 'C', 'D'], answer: { id: 'ea-2', selectedChoice: 'A' } }, // presented A -> original B (correct)
    ]) },
    mockExam: { findUnique: vi.fn().mockResolvedValue({ passingScore: 70 }) },
  };
  const cache = { del: vi.fn() };
  const progress = { updateTopicMastery: vi.fn().mockResolvedValue({}) };
  const events = { emit: vi.fn() };
  const svc = new ExamResultService(prisma as never, cache as never, new ExamScoringService(), progress as never, events as never);
  return { prisma, cache, progress, events, tx, svc };
}

describe('ExamResultService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('computeAndPersist', () => {
    it('grades via presented→original mapping and persists the result', async () => {
      const view = await m.svc.computeAndPersist('ex-1', 'u-1', 100);
      // eq-2: presented 'A' maps to original 'B' which is correct → both correct → 100%
      expect(m.tx.examResult.create).toHaveBeenCalled();
      const createArg = m.tx.examResult.create.mock.calls[0]![0].data;
      expect(createArg.correctCount).toBe(2);
      expect(createArg.scorePercent).toBe(100);
      expect(createArg.status).toBe('pass');
      expect(view.resultCode).toMatch(/^CEBM-EX-/);
    });
    it('writes per-answer correctness for later review', async () => {
      await m.svc.computeAndPersist('ex-1', 'u-1', 100);
      expect(m.tx.examAnswer.update).toHaveBeenCalledTimes(2);
    });
    it('bridges to the student platform (updates topic mastery per graded answer)', async () => {
      await m.svc.computeAndPersist('ex-1', 'u-1', 100);
      expect(m.progress.updateTopicMastery).toHaveBeenCalled();
    });
    it('emits scored + passed events', async () => {
      await m.svc.computeAndPersist('ex-1', 'u-1', 100);
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('scored'), expect.any(Object));
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('passed'), expect.any(Object));
    });
    it('is idempotent — returns the existing result without re-grading', async () => {
      m.prisma.examResult.findUnique.mockResolvedValue({ id: 'res-1' });
      await m.svc.computeAndPersist('ex-1', 'u-1', 100);
      expect(m.tx.examResult.create).not.toHaveBeenCalled();
    });
    it('generates a certificate-ready result code', async () => {
      const view = await m.svc.computeAndPersist('ex-1', 'u-1', 100);
      expect(view.resultCode.length).toBeGreaterThan(8);
    });
    it('computes and persists a percentile against prior results', async () => {
      m.prisma.examResult.count.mockResolvedValueOnce(7).mockResolvedValueOnce(10); // 7 of 10 prior scored lower
      await m.svc.computeAndPersist('ex-1', 'u-1', 100);
      const createArg = m.tx.examResult.create.mock.calls[0]![0].data;
      expect(createArg.percentile).toBe(70);
    });
    it('leaves percentile null when there are no prior results to compare against', async () => {
      m.prisma.examResult.count.mockResolvedValue(0);
      await m.svc.computeAndPersist('ex-1', 'u-1', 100);
      const createArg = m.tx.examResult.create.mock.calls[0]![0].data;
      expect(createArg.percentile).toBeNull();
    });
  });

  describe('getResultByExam', () => {
    it('enforces ownership', async () => {
      m.prisma.examResult.findUnique.mockResolvedValue({ id: 'res-1', userId: 'other' });
      await expect(m.svc.getResultByExam('ex-1', 'u-1')).rejects.toThrow(ForbiddenException);
    });
    it('throws when no result exists yet', async () => {
      m.prisma.examResult.findUnique.mockResolvedValue(null);
      await expect(m.svc.getResultByExam('ex-1', 'u-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getResultByCode', () => {
    it('returns a result by code', async () => {
      m.prisma.examResult.findUnique.mockResolvedValue({ id: 'res-1' });
      const view = await m.svc.getResultByCode('CEBM-EX-ABCD1234');
      expect(view.resultCode).toBe('CEBM-EX-ABCD1234');
    });
    it('throws on an unknown code', async () => {
      m.prisma.examResult.findUnique.mockResolvedValue(null);
      await expect(m.svc.getResultByCode('NOPE')).rejects.toThrow(NotFoundException);
    });
  });
});
