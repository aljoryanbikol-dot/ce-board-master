/**
 * @file achievement.service.spec.ts
 * @module Student/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AchievementService } from '../services/achievement.service';
import { LEVEL_FACTOR, XP_RULES } from '../constants/student.constants';

function mocks() {
  const prisma = {
    studentXp: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    achievement: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    studentAchievement: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) },
  };
  const events = { emit: vi.fn() };
  return { prisma, events, svc: new AchievementService(prisma as never, events as never) };
}

describe('AchievementService', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  describe('level curve', () => {
    it('level 1 at 0 XP', () => { expect(m.svc.levelForXp(0)).toBe(1); });
    it('quadratic thresholds: xpForLevel(N) = (N-1)^2 * factor', () => {
      expect(m.svc.xpForLevel(2)).toBe(LEVEL_FACTOR);
      expect(m.svc.xpForLevel(3)).toBe(4 * LEVEL_FACTOR);
    });
    it('levelForXp is the inverse of xpForLevel', () => {
      expect(m.svc.levelForXp(m.svc.xpForLevel(5))).toBe(5);
      expect(m.svc.levelForXp(m.svc.xpForLevel(5) - 1)).toBe(4);
    });
    it('levelProgress reports XP into the current level', () => {
      const p = m.svc.levelProgress(LEVEL_FACTOR); // exactly level 2
      expect(p.level).toBe(2);
      expect(p.xpIntoLevel).toBe(0);
      expect(p.xpForNextLevel).toBeGreaterThan(0);
    });
  });

  describe('awardXp', () => {
    it('creates XP record for a new student and computes level', async () => {
      m.prisma.studentXp.findUnique.mockResolvedValue(null);
      const award = await m.svc.awardXp('u-1', { base: 400 });
      expect(award.totalXp).toBe(400);
      expect(award.level).toBe(m.svc.levelForXp(400));
      expect(m.prisma.studentXp.upsert).toHaveBeenCalled();
    });
    it('detects a level-up and emits the event', async () => {
      m.prisma.studentXp.findUnique.mockResolvedValue({ totalXp: 0, level: 1 });
      const award = await m.svc.awardXp('u-1', { base: LEVEL_FACTOR });
      expect(award.leveledUp).toBe(true);
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('level'), expect.any(Object));
    });
    it('no level-up when XP stays within the level', async () => {
      m.prisma.studentXp.findUnique.mockResolvedValue({ totalXp: 0, level: 1 });
      const award = await m.svc.awardXp('u-1', { base: 10 });
      expect(award.leveledUp).toBe(false);
    });
  });

  describe('answerXpBreakdown', () => {
    it('correct first attempt with streak stacks bonuses', () => {
      const b = m.svc.answerXpBreakdown(true, true, 3);
      expect(b.base).toBe(XP_RULES.CORRECT_ANSWER);
      expect(b.firstAttempt).toBe(XP_RULES.FIRST_ATTEMPT_BONUS);
      expect(b.streak).toBe(3 * XP_RULES.STREAK_BONUS_PER_DAY);
    });
    it('incorrect answer yields only participation XP', () => {
      const b = m.svc.answerXpBreakdown(false, true, 5);
      expect(b.base).toBe(XP_RULES.INCORRECT_ANSWER);
      expect(b.firstAttempt).toBeUndefined();
      expect(b.streak).toBeUndefined();
    });
    it('streak bonus is capped', () => {
      const b = m.svc.answerXpBreakdown(true, false, 1000);
      expect(b.streak).toBe(XP_RULES.STREAK_BONUS_CAP);
    });
  });

  describe('evaluateAchievements', () => {
    it('awards a newly-earned achievement when threshold met', async () => {
      m.prisma.achievement.findMany.mockResolvedValue([{ id: 'a-1', code: 'FIRST_100', name: '100 Answered', kind: 'volume', threshold: 100, xpReward: 50 }]);
      m.prisma.studentAchievement.findMany.mockResolvedValue([]);
      m.prisma.studentXp.findUnique.mockResolvedValue({ totalXp: 0, level: 1 });
      const earned = await m.svc.evaluateAchievements('u-1', { totalAnswered: 120, totalCorrect: 80, currentStreak: 2, topicsMastered: 1, fastAnswers: 0 });
      expect(earned).toHaveLength(1);
      expect(earned[0]!.code).toBe('FIRST_100');
      expect(m.prisma.studentAchievement.create).toHaveBeenCalled();
    });
    it('does not re-award an already-earned achievement', async () => {
      m.prisma.achievement.findMany.mockResolvedValue([{ id: 'a-1', code: 'X', name: 'X', kind: 'volume', threshold: 10, xpReward: 0 }]);
      m.prisma.studentAchievement.findMany.mockResolvedValue([{ achievementId: 'a-1' }]);
      const earned = await m.svc.evaluateAchievements('u-1', { totalAnswered: 100, totalCorrect: 50, currentStreak: 0, topicsMastered: 0, fastAnswers: 0 });
      expect(earned).toHaveLength(0);
    });
    it('does not award when below threshold', async () => {
      m.prisma.achievement.findMany.mockResolvedValue([{ id: 'a-1', code: 'X', name: 'X', kind: 'streak', threshold: 30, xpReward: 0 }]);
      const earned = await m.svc.evaluateAchievements('u-1', { totalAnswered: 5, totalCorrect: 5, currentStreak: 3, topicsMastered: 0, fastAnswers: 0 });
      expect(earned).toHaveLength(0);
    });
  });

  describe('leaderboard', () => {
    it('ranks students by XP descending', async () => {
      m.prisma.studentXp.findMany.mockResolvedValue([{ userId: 'a', totalXp: 500, level: 3 }, { userId: 'b', totalXp: 300, level: 2 }]);
      const board = await m.svc.leaderboard(10);
      expect(board[0]!.rank).toBe(1);
      expect(board[0]!.userId).toBe('a');
      expect(board[1]!.rank).toBe(2);
    });
  });
});
