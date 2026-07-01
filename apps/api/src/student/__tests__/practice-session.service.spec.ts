/**
 * @file practice-session.service.spec.ts
 * @module Student/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PracticeSessionService } from '../services/practice-session.service';

const publishedQuestion = { id: 'q-1', correctChoice: 'B', questionStatus: 'published', subjectId: 's-1', topicId: 't-1', subtopicId: null, difficultyLevelId: 'd-1', bloomLevel: 'apply' };

function mocks() {
  const tx = {
    questionAttempt: { create: vi.fn().mockResolvedValue({ id: 'att-1' }) },
    practiceSession: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    question: { findFirst: vi.fn().mockResolvedValue(publishedQuestion), findMany: vi.fn().mockResolvedValue([{ id: 'q-1', questionCode: 'Q-1', choices: [] }, { id: 'q-2', questionCode: 'Q-2', choices: [] }]) },
    practiceSession: { findUnique: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'sess-1', mode: 'subject', targetCount: 10 }), update: vi.fn().mockResolvedValue({ status: 'completed', answeredCount: 5, correctCount: 4 }), findMany: vi.fn().mockResolvedValue([]) },
    questionAttempt: { count: vi.fn().mockResolvedValue(0), aggregate: vi.fn().mockResolvedValue({ _count: { _all: 10 } }) },
    studentXp: { findUnique: vi.fn().mockResolvedValue({ currentStreak: 2 }) },
    topicMastery: { count: vi.fn().mockResolvedValue(0) },
  };
  const cache = { del: vi.fn() };
  const progress = { updateTopicMastery: vi.fn().mockResolvedValue({ topicId: 't-1', tier: 'developing', tierChanged: false }), recordDailyActivity: vi.fn().mockResolvedValue({ currentStreak: 2 }) };
  const achievements = { answerXpBreakdown: vi.fn().mockReturnValue({ base: 10 }), awardXp: vi.fn().mockResolvedValue({ awardedXp: 10, totalXp: 100, level: 2, leveledUp: false, breakdown: { base: 10 } }), evaluateAchievements: vi.fn().mockResolvedValue([]) };
  const recommendations = { recommend: vi.fn().mockResolvedValue([{ questionId: 'q-9' }]) };
  const events = { emit: vi.fn() };
  const diagrams = { resolveMany: vi.fn().mockResolvedValue(new Map()), resolveOne: vi.fn().mockResolvedValue(null), publicIdFor: vi.fn() };
  const svc = new PracticeSessionService(prisma as never, cache as never, progress as never, achievements as never, recommendations as never, events as never, diagrams as never);
  return { prisma, cache, progress, achievements, recommendations, events, diagrams, tx, svc };
}

describe('PracticeSessionService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('start', () => {
    it('starts a subject-mode session with selected questions', async () => {
      const result = await m.svc.start('u-1', { mode: 'subject', subjectId: 's-1', targetCount: 10 } as never);
      expect(result.sessionId).toBe('sess-1');
      expect(m.prisma.practiceSession.create).toHaveBeenCalled();
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('session'), expect.any(Object));
    });
    it('delegates to the recommender in recommended mode', async () => {
      await m.svc.start('u-1', { mode: 'recommended', targetCount: 5 } as never);
      expect(m.recommendations.recommend).toHaveBeenCalled();
    });
    it('throws when no questions match the target', async () => {
      m.prisma.question.findMany.mockResolvedValue([]);
      m.recommendations.recommend.mockResolvedValue([]);
      await expect(m.svc.start('u-1', { mode: 'topic', topicId: 't-9', targetCount: 10 } as never)).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitAnswer (the hub)', () => {
    it('grades a correct answer and drives the full progress chain', async () => {
      const result = await m.svc.submitAnswer('u-1', null, { questionId: 'q-1', selectedChoice: 'B', timeSpentSec: 25, skipped: false } as never);
      expect(result.isCorrect).toBe(true);
      expect(result.outcome).toBe('correct');
      expect(m.tx.questionAttempt.create).toHaveBeenCalled();
      expect(m.progress.updateTopicMastery).toHaveBeenCalled();
      expect(m.progress.recordDailyActivity).toHaveBeenCalled();
      expect(m.achievements.awardXp).toHaveBeenCalled();
      expect(m.achievements.evaluateAchievements).toHaveBeenCalled();
      expect(m.cache.del).toHaveBeenCalled();
    });
    it('grades an incorrect answer', async () => {
      const result = await m.svc.submitAnswer('u-1', null, { questionId: 'q-1', selectedChoice: 'A', timeSpentSec: 25, skipped: false } as never);
      expect(result.isCorrect).toBe(false);
      expect(result.outcome).toBe('incorrect');
    });
    it('treats a skipped answer as skipped (no mastery update)', async () => {
      const result = await m.svc.submitAnswer('u-1', null, { questionId: 'q-1', selectedChoice: null, timeSpentSec: 5, skipped: true } as never);
      expect(result.outcome).toBe('skipped');
      expect(m.progress.updateTopicMastery).not.toHaveBeenCalled();
    });
    it('rejects an unpublished question', async () => {
      m.prisma.question.findFirst.mockResolvedValue({ ...publishedQuestion, questionStatus: 'draft' });
      await expect(m.svc.submitAnswer('u-1', null, { questionId: 'q-1', selectedChoice: 'B', timeSpentSec: 1, skipped: false } as never)).rejects.toThrow(BadRequestException);
    });
    it('rejects a missing question', async () => {
      m.prisma.question.findFirst.mockResolvedValue(null);
      await expect(m.svc.submitAnswer('u-1', null, { questionId: 'q-x', selectedChoice: 'B', timeSpentSec: 1, skipped: false } as never)).rejects.toThrow(NotFoundException);
    });
    it('enforces session ownership', async () => {
      m.prisma.practiceSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'someone-else', status: 'active', answeredCount: 0, correctCount: 0, targetCount: 10 });
      await expect(m.svc.submitAnswer('u-1', 'sess-1', { questionId: 'q-1', selectedChoice: 'B', timeSpentSec: 1, skipped: false } as never)).rejects.toThrow(ForbiddenException);
    });
    it('updates session counters and completes when target reached', async () => {
      m.prisma.practiceSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'u-1', status: 'active', answeredCount: 9, correctCount: 5, targetCount: 10 });
      const result = await m.svc.submitAnswer('u-1', 'sess-1', { questionId: 'q-1', selectedChoice: 'B', timeSpentSec: 20, skipped: false } as never);
      expect(result.sessionProgress?.completed).toBe(true);
      expect(result.sessionProgress?.answeredCount).toBe(10);
    });
  });

  describe('complete', () => {
    it('completes an active session and awards XP', async () => {
      m.prisma.practiceSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'u-1', status: 'active' });
      const result = await m.svc.complete('u-1', 'sess-1');
      expect(result.status).toBe('completed');
      expect(m.achievements.awardXp).toHaveBeenCalled();
    });
    it('rejects completing a non-active session', async () => {
      m.prisma.practiceSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'u-1', status: 'completed' });
      await expect(m.svc.complete('u-1', 'sess-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSession', () => {
    it('throws for a non-owned session', async () => {
      m.prisma.practiceSession.findUnique.mockResolvedValue({ id: 'sess-1', userId: 'other' });
      await expect(m.svc.getSession('u-1', 'sess-1')).rejects.toThrow(ForbiddenException);
    });
    it('throws for a missing session', async () => {
      m.prisma.practiceSession.findUnique.mockResolvedValue(null);
      await expect(m.svc.getSession('u-1', 'sess-1')).rejects.toThrow(NotFoundException);
    });
  });
});
