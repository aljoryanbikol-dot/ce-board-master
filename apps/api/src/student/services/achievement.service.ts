/**
 * @file achievement.service.ts
 * @module Student/Services
 *
 * AchievementService — gamification core. Owns XP arithmetic, the level curve,
 * streak bookkeeping, and achievement (badge) evaluation/award. Other services
 * call awardXp() and evaluateAchievements() after meaningful student actions.
 * Leaderboard-ready: XP is stored per user and indexed for ranking.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EVENTS } from '../../common/constants';
import { XP_RULES, LEVEL_FACTOR } from '../constants/student.constants';
import type { XpAward } from '../types/student.types';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** XP → level via the quadratic curve. */
  levelForXp(totalXp: number): number {
    return Math.floor(Math.sqrt(Math.max(0, totalXp) / LEVEL_FACTOR)) + 1;
  }

  /** Total XP required to reach a given level. */
  xpForLevel(level: number): number {
    return Math.pow(Math.max(1, level) - 1, 2) * LEVEL_FACTOR;
  }

  /** Progress within the current level. */
  levelProgress(totalXp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
    const level = this.levelForXp(totalXp);
    const floor = this.xpForLevel(level);
    const next = this.xpForLevel(level + 1);
    return { level, xpIntoLevel: totalXp - floor, xpForNextLevel: next - floor };
  }

  /**
   * Award XP for an answer (and optional session/goal bonuses). Recomputes level
   * and emits level-up + xp-awarded events. Idempotent per call, not per action.
   */
  async awardXp(
    userId: string,
    breakdown: Record<string, number>,
    tx?: Prisma.TransactionClient,
  ): Promise<XpAward> {
    const db = tx ?? this.prisma;
    const awardedXp = Object.values(breakdown).reduce((a, b) => a + b, 0);

    const existing = await db.studentXp.findUnique({ where: { userId } });
    const prevXp = existing?.totalXp ?? 0;
    const prevLevel = existing?.level ?? 1;
    const totalXp = prevXp + awardedXp;
    const level = this.levelForXp(totalXp);
    const leveledUp = level > prevLevel;

    await db.studentXp.upsert({
      where: { userId },
      create: { userId, totalXp, level },
      update: { totalXp, level },
    });

    if (!tx) {
      this.eventEmitter.emit(EVENTS.STUDENT_XP_AWARDED, { userId, awardedXp, totalXp, level });
      if (leveledUp) this.eventEmitter.emit(EVENTS.STUDENT_LEVEL_UP, { userId, level, prevLevel });
    }
    return { awardedXp, totalXp, level, leveledUp, breakdown };
  }

  /** Compute an answer's XP breakdown (pure). */
  answerXpBreakdown(isCorrect: boolean, isFirstAttempt: boolean, currentStreak: number): Record<string, number> {
    const breakdown: Record<string, number> = {
      base: isCorrect ? XP_RULES.CORRECT_ANSWER : XP_RULES.INCORRECT_ANSWER,
    };
    if (isCorrect && isFirstAttempt) breakdown.firstAttempt = XP_RULES.FIRST_ATTEMPT_BONUS;
    if (isCorrect && currentStreak > 0) {
      breakdown.streak = Math.min(currentStreak * XP_RULES.STREAK_BONUS_PER_DAY, XP_RULES.STREAK_BONUS_CAP);
    }
    return breakdown;
  }

  /**
   * Evaluate achievement definitions against the student's current stats and
   * award any newly-earned ones. Returns the newly-earned achievements.
   */
  async evaluateAchievements(
    userId: string,
    stats: { totalAnswered: number; totalCorrect: number; currentStreak: number; topicsMastered: number; fastAnswers: number },
    tx?: Prisma.TransactionClient,
  ): Promise<{ code: string; name: string; xpReward: number }[]> {
    const db = tx ?? this.prisma;
    const [definitions, earned] = await Promise.all([
      db.achievement.findMany({ where: { isActive: true } }),
      db.studentAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
    ]);
    const earnedIds = new Set(earned.map((e: { achievementId: string }) => e.achievementId));
    const accuracy = stats.totalAnswered > 0 ? stats.totalCorrect / stats.totalAnswered : 0;

    const measure = (kind: string): number => {
      switch (kind) {
        case 'streak': return stats.currentStreak;
        case 'volume': return stats.totalAnswered;
        case 'accuracy': return Math.round(accuracy * 100);
        case 'mastery': return stats.topicsMastered;
        case 'speed': return stats.fastAnswers;
        case 'milestone': return stats.totalCorrect;
        default: return 0;
      }
    };

    const newlyEarned: { code: string; name: string; xpReward: number }[] = [];
    for (const def of definitions) {
      if (earnedIds.has(def.id)) continue;
      if (measure(def.kind) >= def.threshold) {
        await db.studentAchievement.create({ data: { userId, achievementId: def.id } });
        if (def.xpReward > 0) await this.awardXp(userId, { achievement: def.xpReward }, tx);
        newlyEarned.push({ code: def.code, name: def.name, xpReward: def.xpReward });
        if (!tx) this.eventEmitter.emit(EVENTS.STUDENT_ACHIEVEMENT_EARNED, { userId, code: def.code, name: def.name });
      }
    }
    if (newlyEarned.length) this.logger.log({ message: 'Achievements earned', userId, count: newlyEarned.length });
    return newlyEarned;
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  async getStudentAchievements(userId: string) {
    const [awards, xp, totalDefs] = await Promise.all([
      this.prisma.studentAchievement.findMany({ where: { userId }, include: { achievement: true }, orderBy: { earnedAt: 'desc' } }),
      this.prisma.studentXp.findUnique({ where: { userId } }),
      this.prisma.achievement.count({ where: { isActive: true } }),
    ]);
    const totalXp = xp?.totalXp ?? 0;
    return {
      xp: { totalXp, ...this.levelProgress(totalXp), currentStreak: xp?.currentStreak ?? 0, longestStreak: xp?.longestStreak ?? 0 },
      earned: awards.map((a: { achievement: { code: string; name: string; description: string; kind: string; icon: string | null; xpReward: number }; earnedAt: Date }) => ({
        code: a.achievement.code, name: a.achievement.name, description: a.achievement.description,
        kind: a.achievement.kind, icon: a.achievement.icon, xpReward: a.achievement.xpReward, earnedAt: a.earnedAt.toISOString(),
      })),
      earnedCount: awards.length, totalCount: totalDefs,
    };
  }

  /** Leaderboard-ready: top students by XP. */
  async leaderboard(limit: number) {
    const rows = await this.prisma.studentXp.findMany({ orderBy: { totalXp: 'desc' }, take: limit, select: { userId: true, totalXp: true, level: true } });
    return rows.map((r: { userId: string; totalXp: number; level: number }, i: number) => ({ rank: i + 1, userId: r.userId, totalXp: r.totalXp, level: r.level }));
  }
}
