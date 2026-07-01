/**
 * @file platform-analytics.service.ts
 * @module PlatformAnalytics/Services
 *
 * PlatformAnalyticsService — admin-facing, platform-wide metrics (user growth,
 * active users, Free/Premium split, revenue, question/exam/AI-Tutor usage,
 * subject performance, hardest questions/topics, retention). Every query here
 * is deliberately unscoped (no `where: { userId }`) — this is the platform
 * mirror of the per-user analytics in StudentStatisticsService, which must
 * stay user-scoped. Read-only; zero writes.
 *
 * "Active" and "retention" have no dedicated activity-event log in the schema
 * (User.lastLoginAt is a single overwritten timestamp, not a day-by-day
 * record) — both are approximated from QuestionAttempt.attemptedAt, the one
 * append-only, per-day activity signal that already exists. This undercounts
 * users who only use the AI Tutor or take mock exams without ever practicing
 * a question; a dedicated activity-log table would fix that but is out of
 * scope for this pass (documented, not built — see gap analysis).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionStatus, PlanInterval } from '@prisma/client';
import type { PlatformAnalyticsQueryDto } from '../dto/platform-analytics.dto';

const LIVE_SUB_STATUSES = [
  SubscriptionStatus.trialing, SubscriptionStatus.active, SubscriptionStatus.past_due, SubscriptionStatus.grace,
];

/** Normalizes any billing interval to a monthly-equivalent multiplier for MRR. */
const MONTHLY_EQUIVALENT: Partial<Record<PlanInterval, number>> = {
  [PlanInterval.monthly]: 1,
  [PlanInterval.quarterly]: 1 / 3,
  [PlanInterval.annual]: 1 / 12,
};

@Injectable()
export class PlatformAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Overview ────────────────────────────────────────────────────────────────

  async overview() {
    const [totalUsers, premiumUsers, totalQuestionsAnswered, examsStarted, examsCompleted, tutorConversations, revenue] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.subscription.count({ where: { status: { in: LIVE_SUB_STATUSES }, plan: { tier: { not: 'free' } } } }),
      this.prisma.questionAttempt.count(),
      this.prisma.mockExam.count({ where: { startedAt: { not: null } } }),
      this.prisma.mockExam.count({ where: { submittedAt: { not: null } } }),
      this.prisma.tutorConversation.count(),
      this.revenue(30),
    ]);
    return {
      totalUsers, premiumUsers, freeUsers: totalUsers - premiumUsers,
      totalQuestionsAnswered, mockExamsStarted: examsStarted, mockExamsCompleted: examsCompleted,
      totalTutorConversations: tutorConversations,
      mrrMinor: revenue.mrrMinor, totalRevenueMinor30d: revenue.totalMinor,
    };
  }

  // ── User growth ─────────────────────────────────────────────────────────────

  async userGrowth(dto: PlatformAnalyticsQueryDto) {
    const since = new Date(Date.now() - dto.days * 86_400_000);
    const users = await this.prisma.user.findMany({ where: { createdAt: { gte: since }, deletedAt: null }, select: { createdAt: true } });
    return this.bucketCounts(users.map((u: { createdAt: Date }) => u.createdAt), dto.period);
  }

  // ── Active users (DAU/WAU/MAU proxy — see file docblock) ────────────────────

  async activeUsers(dto: PlatformAnalyticsQueryDto) {
    const since = new Date(Date.now() - dto.days * 86_400_000);
    const attempts = await this.prisma.questionAttempt.findMany({
      where: { attemptedAt: { gte: since } }, select: { userId: true, attemptedAt: true },
    });
    const byBucket = new Map<string, Set<string>>();
    for (const a of attempts) {
      const key = this.bucketKey(a.attemptedAt, dto.period);
      if (!byBucket.has(key)) byBucket.set(key, new Set());
      byBucket.get(key)!.add(a.userId);
    }
    return Array.from(byBucket.entries())
      .map(([date, users]) => ({ date, activeUsers: users.size }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── Free vs Premium split ────────────────────────────────────────────────────

  async tierSplit() {
    const [totalUsers, byTier] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.subscription.groupBy({
        by: ['planId'], where: { status: { in: LIVE_SUB_STATUSES } }, _count: { _all: true },
      }),
    ]);
    const plans = await this.prisma.subscriptionPlan.findMany({ select: { id: true, tier: true } });
    const tierById = new Map(plans.map((p: { id: string; tier: string }) => [p.id, p.tier]));
    let premiumUsers = 0;
    for (const row of byTier as { planId: string; _count: { _all: number } }[]) {
      if (tierById.get(row.planId) !== 'free') premiumUsers += row._count._all;
    }
    return { totalUsers, premiumUsers, freeUsers: totalUsers - premiumUsers };
  }

  // ── Revenue ──────────────────────────────────────────────────────────────────

  async revenue(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [totalAgg, liveSubs, canceledInWindow] = await Promise.all([
      this.prisma.payment.aggregate({ where: { status: 'succeeded', paidAt: { gte: since } }, _sum: { amountMinor: true } }),
      this.prisma.subscription.findMany({
        where: { status: { in: LIVE_SUB_STATUSES } },
        select: { planId: true, plan: { select: { id: true, name: true, tier: true, interval: true, priceMinor: true } } },
      }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.canceled, canceledAt: { gte: since } } }),
    ]);
    // Simple churn proxy: canceled-in-window / (still-live + canceled-in-window).
    const churnBase = liveSubs.length + canceledInWindow;
    const churnRate = churnBase ? Math.round((canceledInWindow / churnBase) * 1000) / 10 : 0;

    const byPlan = new Map<string, { planId: string; name: string; tier: string; interval: string; subscriberCount: number; mrrMinor: number }>();
    let mrrMinor = 0;
    for (const sub of liveSubs) {
      const p = sub.plan;
      const multiplier = MONTHLY_EQUIVALENT[p.interval as PlanInterval] ?? 0; // lifetime/custom/free: one-time, excluded from MRR
      const planMrr = Math.round(p.priceMinor * multiplier);
      mrrMinor += planMrr;
      const existing = byPlan.get(p.id) ?? { planId: p.id, name: p.name, tier: p.tier, interval: p.interval, subscriberCount: 0, mrrMinor: 0 };
      existing.subscriberCount += 1;
      existing.mrrMinor += planMrr;
      byPlan.set(p.id, existing);
    }

    return {
      totalMinor: totalAgg._sum.amountMinor ?? 0,
      mrrMinor,
      activeSubscribers: liveSubs.length,
      churnRate,
      byPlan: Array.from(byPlan.values()),
    };
  }

  // ── Question usage (platform-wide) ───────────────────────────────────────────

  async questionUsage(dto: PlatformAnalyticsQueryDto) {
    const since = new Date(Date.now() - dto.days * 86_400_000);
    const attempts = await this.prisma.questionAttempt.findMany({ where: { attemptedAt: { gte: since } }, select: { attemptedAt: true } });
    return this.bucketCounts(attempts.map((a: { attemptedAt: Date }) => a.attemptedAt), dto.period);
  }

  // ── Mock exam usage (platform-wide) ──────────────────────────────────────────

  async examUsage(dto: PlatformAnalyticsQueryDto) {
    const since = new Date(Date.now() - dto.days * 86_400_000);
    const [started, completed] = await Promise.all([
      this.prisma.mockExam.findMany({ where: { startedAt: { gte: since } }, select: { startedAt: true } }),
      this.prisma.mockExam.findMany({ where: { submittedAt: { gte: since } }, select: { submittedAt: true } }),
    ]);
    const startedBuckets = this.bucketCounts(started.map((s: { startedAt: Date | null }) => s.startedAt!), dto.period);
    const completedByDate = new Map(this.bucketCounts(completed.map((c: { submittedAt: Date | null }) => c.submittedAt!), dto.period).map((b) => [b.date, b.count]));
    return startedBuckets.map((b) => ({ date: b.date, started: b.count, completed: completedByDate.get(b.date) ?? 0 }));
  }

  // ── AI Tutor usage (platform-wide) ───────────────────────────────────────────

  async aiTutorUsage(dto: PlatformAnalyticsQueryDto) {
    const since = new Date(Date.now() - dto.days * 86_400_000);
    const [conversations, messages] = await Promise.all([
      this.prisma.tutorConversation.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.tutorMessage.findMany({ where: { createdAt: { gte: since }, role: 'user' }, select: { createdAt: true } }),
    ]);
    const convBuckets = this.bucketCounts(conversations.map((c: { createdAt: Date }) => c.createdAt), dto.period);
    const msgByDate = new Map(this.bucketCounts(messages.map((m: { createdAt: Date }) => m.createdAt), dto.period).map((b) => [b.date, b.count]));
    return convBuckets.map((b) => ({ date: b.date, conversations: b.count, messages: msgByDate.get(b.date) ?? 0 }));
  }

  // ── Subject performance (platform-wide) ──────────────────────────────────────

  async subjectPerformance() {
    const rows = await this.prisma.questionAttempt.groupBy({ by: ['subjectId'], _count: { _all: true } });
    const correctRows = await this.prisma.questionAttempt.groupBy({ by: ['subjectId'], where: { isCorrect: true }, _count: { _all: true } });
    const correctBySubject = new Map((correctRows as { subjectId: string; _count: { _all: number } }[]).map((r) => [r.subjectId, r._count._all]));
    return (rows as { subjectId: string; _count: { _all: number } }[])
      .map((r) => ({ subjectId: r.subjectId, attempts: r._count._all, accuracy: r._count._all ? (correctBySubject.get(r.subjectId) ?? 0) / r._count._all : 0 }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }

  // ── Hardest questions / topics ───────────────────────────────────────────────

  async hardestQuestions(limit: number) {
    const rows = await this.prisma.questionAttempt.groupBy({
      by: ['questionId'], _count: { _all: true }, having: { questionId: { _count: { gte: 5 } } },
    });
    const correctRows = await this.prisma.questionAttempt.groupBy({ by: ['questionId'], where: { isCorrect: true }, _count: { _all: true } });
    const correctByQuestion = new Map((correctRows as { questionId: string; _count: { _all: number } }[]).map((r) => [r.questionId, r._count._all]));
    const ranked = (rows as { questionId: string; _count: { _all: number } }[])
      .map((r) => ({ questionId: r.questionId, attempts: r._count._all, accuracy: (correctByQuestion.get(r.questionId) ?? 0) / r._count._all }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: ranked.map((r) => r.questionId) } }, select: { id: true, questionCode: true, stemText: true, subjectId: true },
    });
    const byId = new Map(questions.map((q: { id: string; questionCode: string; stemText: string; subjectId: string }) => [q.id, q]));
    return ranked.map((r) => ({ ...r, questionCode: byId.get(r.questionId)?.questionCode ?? null, stemText: byId.get(r.questionId)?.stemText?.slice(0, 160) ?? null, subjectId: byId.get(r.questionId)?.subjectId ?? null }));
  }

  async hardestTopics(limit: number) {
    const rows = await this.prisma.questionAttempt.groupBy({
      by: ['topicId'], _count: { _all: true }, having: { topicId: { _count: { gte: 10 } } },
    });
    const correctRows = await this.prisma.questionAttempt.groupBy({ by: ['topicId'], where: { isCorrect: true }, _count: { _all: true } });
    const correctByTopic = new Map((correctRows as { topicId: string | null; _count: { _all: number } }[]).map((r) => [r.topicId, r._count._all]));
    return (rows as { topicId: string | null; _count: { _all: number } }[])
      .filter((r) => r.topicId !== null)
      .map((r) => ({ topicId: r.topicId as string, attempts: r._count._all, accuracy: (correctByTopic.get(r.topicId) ?? 0) / r._count._all }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit);
  }

  // ── Retention (day-1 / day-7 / day-30 return rate, QuestionAttempt proxy) ────

  async retention() {
    const now = new Date();
    const windows = [1, 7, 30];
    const results: { windowDays: number; cohortSize: number; returnedCount: number; returnRate: number }[] = [];

    for (const windowDays of windows) {
      const cohortStart = new Date(now.getTime() - (windowDays + 14) * 86_400_000);
      const cohortEnd = new Date(now.getTime() - windowDays * 86_400_000);
      const cohortUsers = await this.prisma.user.findMany({
        where: { createdAt: { gte: cohortStart, lt: cohortEnd }, deletedAt: null }, select: { id: true, createdAt: true },
      });
      if (cohortUsers.length === 0) { results.push({ windowDays, cohortSize: 0, returnedCount: 0, returnRate: 0 }); continue; }

      let returned = 0;
      for (const u of cohortUsers) {
        const returnThreshold = new Date(u.createdAt.getTime() + windowDays * 86_400_000);
        const hasReturned = await this.prisma.questionAttempt.findFirst({ where: { userId: u.id, attemptedAt: { gte: returnThreshold } }, select: { id: true } });
        if (hasReturned) returned++;
      }
      results.push({ windowDays, cohortSize: cohortUsers.length, returnedCount: returned, returnRate: returned / cohortUsers.length });
    }
    return results;
  }

  // ── helpers ───────────────────────────────────────────────────────────────────

  private bucketCounts(dates: Date[], period: 'daily' | 'weekly' | 'monthly'): { date: string; count: number }[] {
    const buckets = new Map<string, number>();
    for (const d of dates) {
      const key = this.bucketKey(d, period);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
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
