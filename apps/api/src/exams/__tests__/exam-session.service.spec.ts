/**
 * @file exam-session.service.spec.ts
 * @module Exams/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExamSessionService } from '../services/exam-session.service';
import { ExamTimerService } from '../services/exam-timer.service';

function mocks() {
  const tx = {
    mockExam: { create: vi.fn().mockResolvedValue({ id: 'ex-1', status: 'created', totalQuestions: 10, durationMinutes: 60, passingScore: 70 }), update: vi.fn().mockResolvedValue({}) },
    examQuestion: { createMany: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) },
    examAnswer: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    mockExam: {
      create: vi.fn().mockResolvedValue({ id: 'ex-1', status: 'created', totalQuestions: 10, durationMinutes: 60, passingScore: 70 }),
      findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), update: vi.fn().mockResolvedValue({ status: 'in_progress', durationMinutes: 60, startedAt: new Date(), expiresAt: new Date(Date.now() + 3.6e6), elapsedSeconds: 0 }),
    },
    examQuestion: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    examAnswer: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({}) },
  };
  const cache = { del: vi.fn() };
  const mockExam = { buildQuestions: vi.fn().mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ questionId: `q-${i}`, position: i, subjectId: 's-1', topicId: 't-1', difficultyLevelId: 'd-1', learningObjective: 'LO', choiceOrder: ['A', 'B', 'C', 'D'], correctChoice: 'A' }))), getTemplate: vi.fn(), fullBoardComposition: vi.fn().mockResolvedValue([{ subjectId: 's-1', count: 10 }]), subjectComposition: vi.fn().mockReturnValue([{ subjectId: 's-1', count: 10 }]) };
  const timer = new ExamTimerService();
  const result = { computeAndPersist: vi.fn().mockResolvedValue({ resultCode: 'CEBM-EX-XXXX', passed: true }) };
  const events = { emit: vi.fn() };
  const diagrams = { resolveMany: vi.fn().mockResolvedValue(new Map()), resolveOne: vi.fn().mockResolvedValue(null), publicIdFor: vi.fn() };
  const featureAccess = { enforceMockExamQuota: vi.fn().mockResolvedValue(undefined) };
  const svc = new ExamSessionService(prisma as never, cache as never, mockExam as never, timer, result as never, events as never, diagrams as never, featureAccess as never);
  return { prisma, cache, mockExam, timer, result, events, diagrams, featureAccess, tx, svc };
}

const inProgress = (over = {}) => ({ id: 'ex-1', userId: 'u-1', status: 'in_progress', durationMinutes: 60, startedAt: new Date(), expiresAt: new Date(Date.now() + 3.6e6), pausedAt: null, elapsedSeconds: 0, answeredCount: 0, ...over });

describe('ExamSessionService (the hub)', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('start', () => {
    it('builds questions and persists the exam + questions', async () => {
      const res = await m.svc.start('u-1', { kind: 'subject', subjectId: 's-1' } as never);
      expect(m.mockExam.buildQuestions).toHaveBeenCalled();
      expect(m.tx.examQuestion.createMany).toHaveBeenCalled();
      expect(res.examId).toBe('ex-1');
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('created'), expect.any(Object));
    });
    it('resolves a full-board composition', async () => {
      await m.svc.start('u-1', { kind: 'full_board' } as never);
      expect(m.mockExam.fullBoardComposition).toHaveBeenCalled();
    });
    it('resolves a template composition when templateId given', async () => {
      m.mockExam.getTemplate.mockResolvedValue({ id: 'tpl-1', isActive: true, composition: [{ subjectId: 's-1', count: 10 }], durationMinutes: 90, passingScore: 75, randomizeChoices: true, name: 'T' });
      await m.svc.start('u-1', { kind: 'custom', templateId: 'tpl-1' } as never);
      expect(m.mockExam.getTemplate).toHaveBeenCalledWith('tpl-1');
    });
  });

  describe('begin', () => {
    it('transitions created → in_progress and sets expiry', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue({ id: 'ex-1', userId: 'u-1', status: 'created', durationMinutes: 60 });
      const res = await m.svc.begin('u-1', 'ex-1');
      expect(m.prisma.mockExam.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'in_progress' }) }));
      expect(res.status).toBe('in_progress');
    });
    it('rejects beginning an already-started exam', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue({ id: 'ex-1', userId: 'u-1', status: 'in_progress' });
      await expect(m.svc.begin('u-1', 'ex-1')).rejects.toThrow(ConflictException);
    });
    it('enforces ownership', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue({ id: 'ex-1', userId: 'other', status: 'created' });
      await expect(m.svc.begin('u-1', 'ex-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('saveAnswer (autosave)', () => {
    it('saves an answer and marks the question answered', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress());
      m.prisma.examQuestion.findFirst.mockResolvedValue({ id: 'eq-1', examId: 'ex-1', choiceOrder: ['A', 'B', 'C', 'D'] });
      const res = await m.svc.saveAnswer('u-1', 'ex-1', { examQuestionId: 'eq-1', selectedChoice: 'B', timeSpentSec: 30 } as never);
      expect(res.saved).toBe(true);
      expect(res.state).toBe('answered');
      expect(m.cache.del).toHaveBeenCalled();
    });
    it('marks skipped when no choice', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress());
      m.prisma.examQuestion.findFirst.mockResolvedValue({ id: 'eq-1', examId: 'ex-1', choiceOrder: ['A', 'B', 'C', 'D'] });
      const res = await m.svc.saveAnswer('u-1', 'ex-1', { examQuestionId: 'eq-1', selectedChoice: null, timeSpentSec: 5 } as never);
      expect(res.state).toBe('skipped');
    });
    it('rejects saving to a non-in-progress exam', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress({ status: 'paused' }));
      await expect(m.svc.saveAnswer('u-1', 'ex-1', { examQuestionId: 'eq-1', selectedChoice: 'A', timeSpentSec: 1 } as never)).rejects.toThrow(BadRequestException);
    });
    it('rejects an out-of-range choice', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress());
      m.prisma.examQuestion.findFirst.mockResolvedValue({ id: 'eq-1', examId: 'ex-1', choiceOrder: ['A', 'B'] });
      await expect(m.svc.saveAnswer('u-1', 'ex-1', { examQuestionId: 'eq-1', selectedChoice: 'D', timeSpentSec: 1 } as never)).rejects.toThrow(BadRequestException);
    });
    it('auto-submits and rejects when expired', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress({ expiresAt: new Date(Date.now() - 60_000) }));
      await expect(m.svc.saveAnswer('u-1', 'ex-1', { examQuestionId: 'eq-1', selectedChoice: 'A', timeSpentSec: 1 } as never)).rejects.toThrow(BadRequestException);
      expect(m.result.computeAndPersist).toHaveBeenCalled(); // auto-submit fired
    });
  });

  describe('pause / resume', () => {
    it('pause folds elapsed and clears startedAt', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress({ startedAt: new Date(Date.now() - 120_000), elapsedSeconds: 0 }));
      m.prisma.mockExam.update.mockResolvedValue({ status: 'paused' });
      const res = await m.svc.pause('u-1', 'ex-1');
      expect(res.status).toBe('paused');
      expect(res.elapsedSeconds).toBeGreaterThanOrEqual(120);
    });
    it('resume recomputes expiry from remaining time', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue({ id: 'ex-1', userId: 'u-1', status: 'paused', durationMinutes: 60, elapsedSeconds: 600, startedAt: null, expiresAt: null, pausedAt: new Date() });
      m.prisma.mockExam.update.mockResolvedValue({ status: 'in_progress', durationMinutes: 60, startedAt: new Date(), expiresAt: new Date(Date.now() + 3e6), elapsedSeconds: 600 });
      const res = await m.svc.resume('u-1', 'ex-1');
      expect(res.status).toBe('in_progress');
    });
    it('rejects resuming a non-paused exam', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress());
      await expect(m.svc.resume('u-1', 'ex-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit', () => {
    it('finalizes and returns the scored result', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress());
      const res = await m.svc.submit('u-1', 'ex-1');
      expect(m.result.computeAndPersist).toHaveBeenCalled();
      expect((res as any).resultCode).toBe('CEBM-EX-XXXX');
    });
    it('rejects double submission', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress({ status: 'submitted' }));
      await expect(m.svc.submit('u-1', 'ex-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('resumeInterrupted', () => {
    it('returns null when nothing is in progress', async () => {
      m.prisma.mockExam.findFirst.mockResolvedValue(null);
      expect(await m.svc.resumeInterrupted('u-1')).toBeNull();
    });
    it('returns the most recent interrupted exam', async () => {
      m.prisma.mockExam.findFirst.mockResolvedValue(inProgress());
      m.prisma.mockExam.findUnique.mockResolvedValue(inProgress());
      const res = await m.svc.resumeInterrupted('u-1');
      expect(res?.examId).toBe('ex-1');
    });
  });

  describe('ownership', () => {
    it('getExam rejects a non-owner', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue({ id: 'ex-1', userId: 'other', status: 'created' });
      await expect(m.svc.getExam('u-1', 'ex-1')).rejects.toThrow(ForbiddenException);
    });
    it('getExam throws on missing exam', async () => {
      m.prisma.mockExam.findUnique.mockResolvedValue(null);
      await expect(m.svc.getExam('u-1', 'ex-1')).rejects.toThrow(NotFoundException);
    });
  });
});
