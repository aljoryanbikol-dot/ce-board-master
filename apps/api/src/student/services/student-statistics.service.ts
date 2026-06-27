/**
 * @file student-statistics.service.ts
 * @module Student/Services
 *
 * StudentStatisticsService — analytics over a student's attempts: time-bucketed
 * progress (daily/weekly/monthly), accuracy, speed, question distribution, and a
 * mastery heatmap. All ownership-scoped; pure aggregation over QuestionAttempt
 * and TopicMastery. Read-only.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AnalyticsQueryDto } from '../dto/student.dto';
import type { ProgressAnalytics, MasteryHeatmapCell } from '../types/student.types';

@Injectable()
export class StudentStatisticsService {

  constructor(private readonly prisma: PrismaService) {}

  /** Time-bucketed progress for the requested period. */
  async progress(userId: string, dto: AnalyticsQueryDto): Promise<ProgressAnalytics> {
    const since = new Date(Date.now() - dto.days * 86_400_000);
    const attempts = await this.prisma.questionAttempt.findMany({
      where: { userId, attemptedAt: { gte: since } },
      select: { isCorrect: true, timeSpentSec: true, attemptedAt: true },
      orderBy: { attemptedAt: 'asc' },
    });

    const buckets = new Map<string, { answered: number; correct: number; seconds: number }>();
    for (const a of attempts) {
      const key = this.bucketKey(a.attemptedAt, dto.period);
      const b = buckets.get(key) ?? { answered: 0, correct: 0, seconds: 0 };
      b.answered++; if (a.isCorrect) b.correct++; b.seconds += a.timeSpentSec;
      buckets.set(key, b);
    }

    const bucketList = Array.from(buckets.entries()).map(([date, b]) => ({
      date, answered: b.answered, correct: b.correct, accuracy: b.answered ? b.correct / b.answered : 0, minutes: Math.round(b.seconds / 60),
    }));

    const totals = bucketList.reduce((t, b) => ({ answered: t.answered + b.answered, correct: t.correct + b.correct, minutes: t.minutes + b.minutes }), { answered: 0, correct: 0, minutes: 0 });
    return { period: dto.period, buckets: bucketList, totals: { ...totals, accuracy: totals.answered ? totals.correct / totals.answered : 0 } };
  }

  /** Accuracy + speed summary, all-time and recent. */
  async accuracyAndSpeed(userId: string) {
    const [all, recent] = await Promise.all([
      this.prisma.questionAttempt.aggregate({ where: { userId }, _count: { _all: true }, _avg: { timeSpentSec: true } }),
      this.prisma.questionAttempt.aggregate({ where: { userId, attemptedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, _count: { _all: true }, _avg: { timeSpentSec: true } }),
    ]);
    const correctAll = await this.prisma.questionAttempt.count({ where: { userId, isCorrect: true } });
    const correctRecent = await this.prisma.questionAttempt.count({ where: { userId, isCorrect: true, attemptedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } });
    return {
      allTime: { answered: all._count._all, accuracy: all._count._all ? correctAll / all._count._all : 0, avgTimeSec: Math.round(all._avg.timeSpentSec ?? 0) },
      last7Days: { answered: recent._count._all, accuracy: recent._count._all ? correctRecent / recent._count._all : 0, avgTimeSec: Math.round(recent._avg.timeSpentSec ?? 0) },
    };
  }

  /** Distribution of attempts by subject and by outcome. */
  async distribution(userId: string) {
    const [bySubject, byOutcome] = await Promise.all([
      this.prisma.questionAttempt.groupBy({ by: ['subjectId'], where: { userId }, _count: { _all: true } }),
      this.prisma.questionAttempt.groupBy({ by: ['outcome'], where: { userId }, _count: { _all: true } }),
    ]);
    return {
      bySubject: bySubject.map((s: { subjectId: string; _count: { _all: number } }) => ({ subjectId: s.subjectId, count: s._count._all })),
      byOutcome: byOutcome.map((o: { outcome: string; _count: { _all: number } }) => ({ outcome: o.outcome, count: o._count._all })),
    };
  }

  /** Mastery heatmap: every practiced topic with its mastery score + tier. */
  async masteryHeatmap(userId: string): Promise<MasteryHeatmapCell[]> {
    const rows = await this.prisma.topicMastery.findMany({ where: { userId }, orderBy: [{ subjectId: 'asc' }, { masteryScore: 'desc' }] });
    return rows.map((m: { subjectId: string; topicId: string; masteryScore: number; tier: string; attempts: number }) => ({ subjectId: m.subjectId, topicId: m.topicId, masteryScore: m.masteryScore, tier: m.tier, attempts: m.attempts }));
  }

  /** Performance history: per-day accuracy trend (for sparklines). */
  async performanceHistory(userId: string, days = 30) {
    const stats = await this.progress(userId, { period: 'daily', days });
    return stats.buckets;
  }

  private bucketKey(date: Date, period: 'daily' | 'weekly' | 'monthly'): string {
    const d = new Date(date);
    if (period === 'monthly') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (period === 'weekly') {
      const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86_400_000) + onejan.getUTCDay() + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    return d.toISOString().slice(0, 10);
  }
}
