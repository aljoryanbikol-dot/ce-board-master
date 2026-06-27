/**
 * @file student-dashboard.service.ts
 * @module Student/Services
 *
 * StudentDashboardService — composes the student dashboard from the progress,
 * achievement, and statistics services. It owns no business logic of its own
 * (zero duplication): it aggregates and shapes. Cached briefly per user and
 * invalidated by the practice flow on every answer.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { ProgressTrackingService } from './progress-tracking.service';
import { AchievementService } from './achievement.service';
import { CACHE_KEYS } from '../../common/constants';
import type { DashboardSummary } from '../types/student.types';

@Injectable()
export class StudentDashboardService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly progress: ProgressTrackingService,
    private readonly achievements: AchievementService,
  ) {}

  async getDashboard(userId: string): Promise<DashboardSummary> {
    return this.cache.remember(CACHE_KEYS.student.dashboard(userId), CacheTTL.STUDENT, () => this.build(userId));
  }

  private async build(userId: string): Promise<DashboardSummary> {
    const [activeSession, dailyGoal, xp, attemptsAgg, correctCount, masteredCount, weak, strong, recentAch] = await Promise.all([
      this.prisma.practiceSession.findFirst({ where: { userId, status: 'active' }, orderBy: { startedAt: 'desc' } }),
      this.prisma.studyGoal.findUnique({ where: { userId_period: { userId, period: 'daily' } } }),
      this.prisma.studentXp.findUnique({ where: { userId } }),
      this.prisma.questionAttempt.aggregate({ where: { userId }, _count: { _all: true } }),
      this.prisma.questionAttempt.count({ where: { userId, isCorrect: true } }),
      this.prisma.topicMastery.count({ where: { userId, tier: 'mastered' } }),
      this.progress.weakTopics(userId, 5),
      this.progress.strongTopics(userId, 5),
      this.prisma.studentAchievement.findMany({ where: { userId }, include: { achievement: true }, orderBy: { earnedAt: 'desc' }, take: 3 }),
    ]);

    // Today's answered count for the daily goal.
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const answeredToday = await this.prisma.questionAttempt.count({ where: { userId, attemptedAt: { gte: today } } });

    const totalXp = xp?.totalXp ?? 0;
    const levelInfo = this.achievements.levelProgress(totalXp);
    const totalAnswered = attemptsAgg._count._all;

    const goal = dailyGoal
      ? { target: dailyGoal.targetQuestions, completed: answeredToday, percent: Math.min(100, Math.round((answeredToday / dailyGoal.targetQuestions) * 100)), met: answeredToday >= dailyGoal.targetQuestions }
      : null;

    const lastActivity = xp?.lastActivityDate ? new Date(xp.lastActivityDate) : null;
    const activeToday = !!lastActivity && lastActivity.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);

    return {
      continueLearning: activeSession ? { sessionId: activeSession.id, mode: activeSession.mode, answeredCount: activeSession.answeredCount, targetCount: activeSession.targetCount } : null,
      dailyGoal: goal,
      streak: { current: xp?.currentStreak ?? 0, longest: xp?.longestStreak ?? 0, activeToday },
      xp: { totalXp, level: levelInfo.level, xpIntoLevel: levelInfo.xpIntoLevel, xpForNextLevel: levelInfo.xpForNextLevel },
      progress: { totalAnswered, overallAccuracy: totalAnswered ? correctCount / totalAnswered : 0, topicsMastered: masteredCount },
      weakTopics: weak,
      strongTopics: strong,
      recentAchievements: recentAch.map((a: { achievement: { code: string; name: string }; earnedAt: Date }) => ({ code: a.achievement.code, name: a.achievement.name, earnedAt: a.earnedAt.toISOString() })),
    };
  }
}
