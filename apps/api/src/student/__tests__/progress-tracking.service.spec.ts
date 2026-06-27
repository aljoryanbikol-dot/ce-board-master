/**
 * @file progress-tracking.service.spec.ts
 * @module Student/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressTrackingService } from '../services/progress-tracking.service';
import { MASTERY_THRESHOLDS } from '../constants/student.constants';

function mocks() {
  const prisma = {
    topicMastery: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    studyStreakDay: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({}) },
    studentXp: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({}) },
    knowledgeGap: { upsert: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
  };
  const events = { emit: vi.fn() };
  return { prisma, events, svc: new ProgressTrackingService(prisma as never, events as never) };
}

describe('ProgressTrackingService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('masteryScore + tier', () => {
    it('perfect accuracy with high volume scores near 100', () => {
      const score = m.svc.masteryScore(1, 50);
      expect(score).toBeGreaterThanOrEqual(MASTERY_THRESHOLDS.mastered);
    });
    it('low accuracy yields a low score', () => {
      expect(m.svc.masteryScore(0.2, 50)).toBeLessThan(MASTERY_THRESHOLDS.developing);
    });
    it('volume confidence rewards more attempts at equal accuracy', () => {
      expect(m.svc.masteryScore(0.8, 50)).toBeGreaterThan(m.svc.masteryScore(0.8, 2));
    });
    it('tierForScore maps scores to the right tier', () => {
      expect(m.svc.tierForScore(95)).toBe('mastered');
      expect(m.svc.tierForScore(0)).toBe('novice');
      expect(m.svc.tierForScore(65)).toBe('proficient');
    });
  });

  describe('updateTopicMastery', () => {
    it('creates mastery for a first attempt', async () => {
      m.prisma.topicMastery.findUnique.mockResolvedValue(null);
      const update = await m.svc.updateTopicMastery('u-1', { subjectId: 's-1', topicId: 't-1', isCorrect: true, timeSpentSec: 30 });
      expect(update.attempts).toBe(1);
      expect(update.correct).toBe(1);
      expect(update.accuracy).toBe(1);
      expect(m.prisma.topicMastery.upsert).toHaveBeenCalled();
    });
    it('accumulates onto an existing mastery row', async () => {
      m.prisma.topicMastery.findUnique.mockResolvedValue({ attempts: 4, correct: 2, avgTimeSec: 40, tier: 'developing' });
      const update = await m.svc.updateTopicMastery('u-1', { subjectId: 's-1', topicId: 't-1', isCorrect: true, timeSpentSec: 20 });
      expect(update.attempts).toBe(5);
      expect(update.correct).toBe(3);
      expect(update.accuracy).toBeCloseTo(0.6);
    });
    it('flags a tier change and emits the event', async () => {
      m.prisma.topicMastery.findUnique.mockResolvedValue({ attempts: 19, correct: 19, avgTimeSec: 10, tier: 'advanced' });
      const update = await m.svc.updateTopicMastery('u-1', { subjectId: 's-1', topicId: 't-1', isCorrect: true, timeSpentSec: 10 });
      expect(update.tierChanged).toBe(true);
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('mastery'), expect.any(Object));
    });
  });

  describe('recordDailyActivity (streak)', () => {
    it('starts a streak at 1 on the first day', async () => {
      m.prisma.studyStreakDay.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null); // today none, yesterday none
      m.prisma.studentXp.findUnique.mockResolvedValue({ currentStreak: 0, longestStreak: 0 });
      const result = await m.svc.recordDailyActivity('u-1', { questionsAnswered: 1, minutesStudied: 5, goalMet: false });
      expect(result.currentStreak).toBe(1);
      expect(result.extended).toBe(true);
    });
    it('extends the streak when active yesterday', async () => {
      m.prisma.studyStreakDay.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'yday' });
      m.prisma.studentXp.findUnique.mockResolvedValue({ currentStreak: 4, longestStreak: 4 });
      const result = await m.svc.recordDailyActivity('u-1', { questionsAnswered: 1, minutesStudied: 5, goalMet: false });
      expect(result.currentStreak).toBe(5);
      expect(result.longestStreak).toBe(5);
    });
    it('does not double-increment within the same day', async () => {
      m.prisma.studyStreakDay.findUnique.mockResolvedValueOnce({ id: 'today', goalMet: false });
      m.prisma.studentXp.findUnique.mockResolvedValue({ currentStreak: 3, longestStreak: 5 });
      const result = await m.svc.recordDailyActivity('u-1', { questionsAnswered: 1, minutesStudied: 5, goalMet: false });
      expect(result.extended).toBe(false);
      expect(result.currentStreak).toBe(3);
    });
  });

  describe('detectKnowledgeGaps', () => {
    it('records a critical gap for very low accuracy', async () => {
      m.prisma.topicMastery.findMany.mockResolvedValue([{ topicId: 't-1', subjectId: 's-1', accuracy: 0.3, attempts: 10 }]);
      const gaps = await m.svc.detectKnowledgeGaps('u-1');
      expect(gaps[0]!.severity).toBe('critical');
      expect(m.prisma.knowledgeGap.upsert).toHaveBeenCalled();
    });
    it('resolves a topic that is no longer weak', async () => {
      m.prisma.topicMastery.findMany.mockResolvedValue([{ topicId: 't-1', subjectId: 's-1', accuracy: 0.9, attempts: 10 }]);
      const gaps = await m.svc.detectKnowledgeGaps('u-1');
      expect(gaps).toHaveLength(0);
      expect(m.prisma.knowledgeGap.updateMany).toHaveBeenCalled();
    });
  });

  describe('weak/strong topics', () => {
    it('queries weak topics below the threshold', async () => {
      await m.svc.weakTopics('u-1', 5);
      expect(m.prisma.topicMastery.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { accuracy: 'asc' } }));
    });
    it('queries strong topics above the threshold', async () => {
      await m.svc.strongTopics('u-1', 5);
      expect(m.prisma.topicMastery.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { accuracy: 'desc' } }));
    });
  });
});
