/**
 * @file progress-tracking.service.ts
 * @module Student/Services
 *
 * ProgressTrackingService — the analytics-bearing core. It maintains per-topic
 * mastery (rolling accuracy → mastery score → tier), the daily study streak,
 * and knowledge-gap detection (weak topics). It is the single source of truth
 * for "how is this student doing", consumed by the dashboard and statistics.
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EVENTS } from '../../common/constants';
import { MASTERY_THRESHOLDS, MASTERY_WEIGHTS, GAP_RULES } from '../constants/student.constants';
import type { MasteryUpdate, TopicSnapshot } from '../types/student.types';

@Injectable()
export class ProgressTrackingService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Mastery ───────────────────────────────────────────────────────────────────

  /** Mastery score 0–100 from accuracy + volume confidence (pure). */
  masteryScore(accuracy: number, attempts: number): number {
    const volumeConfidence = Math.min(1, attempts / MASTERY_WEIGHTS.VOLUME_SATURATION);
    const score = (accuracy * MASTERY_WEIGHTS.ACCURACY + volumeConfidence * MASTERY_WEIGHTS.VOLUME_CONFIDENCE) * 100;
    return Math.round(score * 100) / 100;
  }

  tierForScore(score: number): string {
    const tiers = Object.entries(MASTERY_THRESHOLDS).sort((a, b) => b[1] - a[1]);
    for (const [tier, threshold] of tiers) if (score >= threshold) return tier;
    return 'novice';
  }

  /** Update a topic's mastery after an answer. Upserts the row. */
  async updateTopicMastery(
    userId: string,
    params: { subjectId: string; topicId: string; isCorrect: boolean; timeSpentSec: number },
    tx?: Prisma.TransactionClient,
  ): Promise<MasteryUpdate> {
    const db = tx ?? this.prisma;
    const existing = await db.topicMastery.findUnique({ where: { userId_topicId: { userId, topicId: params.topicId } } });

    const attempts = (existing?.attempts ?? 0) + 1;
    const correct = (existing?.correct ?? 0) + (params.isCorrect ? 1 : 0);
    const accuracy = correct / attempts;
    const prevAvg = existing?.avgTimeSec ?? 0;
    const prevAttempts = existing?.attempts ?? 0;
    const avgTimeSec = (prevAvg * prevAttempts + params.timeSpentSec) / attempts;
    const score = this.masteryScore(accuracy, attempts);
    const tier = this.tierForScore(score);
    const prevTier = existing?.tier ?? 'novice';

    await db.topicMastery.upsert({
      where: { userId_topicId: { userId, topicId: params.topicId } },
      create: { userId, subjectId: params.subjectId, topicId: params.topicId, attempts, correct, accuracy, avgTimeSec, masteryScore: score, tier: tier as never, lastPracticedAt: new Date() },
      update: { attempts, correct, accuracy, avgTimeSec, masteryScore: score, tier: tier as never, lastPracticedAt: new Date() },
    });

    const tierChanged = tier !== prevTier;
    if (tierChanged && !tx) this.eventEmitter.emit(EVENTS.STUDENT_MASTERY_CHANGED, { userId, topicId: params.topicId, tier, prevTier });
    return { topicId: params.topicId, attempts, correct, accuracy, masteryScore: score, tier, tierChanged };
  }

  async masteryForUser(userId: string): Promise<TopicSnapshot[]> {
    const rows = await this.prisma.topicMastery.findMany({ where: { userId }, orderBy: { masteryScore: 'desc' } });
    return rows.map(this.toSnapshot);
  }

  async weakTopics(userId: string, limit = 5): Promise<TopicSnapshot[]> {
    const rows = await this.prisma.topicMastery.findMany({
      where: { userId, attempts: { gte: GAP_RULES.MIN_ATTEMPTS }, accuracy: { lt: GAP_RULES.WEAK_TOPIC_ACCURACY } },
      orderBy: { accuracy: 'asc' }, take: limit,
    });
    return rows.map(this.toSnapshot);
  }

  async strongTopics(userId: string, limit = 5): Promise<TopicSnapshot[]> {
    const rows = await this.prisma.topicMastery.findMany({
      where: { userId, attempts: { gte: GAP_RULES.MIN_ATTEMPTS }, accuracy: { gte: GAP_RULES.STRONG_TOPIC_ACCURACY } },
      orderBy: { accuracy: 'desc' }, take: limit,
    });
    return rows.map(this.toSnapshot);
  }

  // ── Streak ──────────────────────────────────────────────────────────────────

  /** Record activity for today and update the streak. Returns the current streak. */
  async recordDailyActivity(
    userId: string,
    params: { questionsAnswered: number; minutesStudied: number; goalMet: boolean },
    tx?: Prisma.TransactionClient,
  ): Promise<{ currentStreak: number; longestStreak: number; extended: boolean }> {
    const db = tx ?? this.prisma;
    const today = this.dateOnly(new Date());
    const yesterday = this.dateOnly(new Date(Date.now() - 86_400_000));

    const todayRow = await db.studyStreakDay.findUnique({ where: { userId_date: { userId, date: today } } });
    const isFirstToday = !todayRow;

    await db.studyStreakDay.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, questionsAnswered: params.questionsAnswered, minutesStudied: params.minutesStudied, goalMet: params.goalMet },
      update: { questionsAnswered: { increment: params.questionsAnswered }, minutesStudied: { increment: params.minutesStudied }, goalMet: params.goalMet || (todayRow?.goalMet ?? false) },
    });

    const xp = await db.studentXp.findUnique({ where: { userId } });
    let currentStreak = xp?.currentStreak ?? 0;
    let longestStreak = xp?.longestStreak ?? 0;
    let extended = false;

    if (isFirstToday) {
      const ranYesterday = await db.studyStreakDay.findUnique({ where: { userId_date: { userId, date: yesterday } } });
      currentStreak = ranYesterday ? currentStreak + 1 : 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      extended = true;
      await db.studentXp.upsert({
        where: { userId },
        create: { userId, currentStreak, longestStreak, lastActivityDate: today },
        update: { currentStreak, longestStreak, lastActivityDate: today },
      });
      if (!tx) this.eventEmitter.emit(EVENTS.STUDENT_STREAK_EXTENDED, { userId, currentStreak });
    }
    return { currentStreak, longestStreak, extended };
  }

  // ── Knowledge gaps ────────────────────────────────────────────────────────────

  /** Detect/refresh knowledge gaps from topic mastery. Returns detected gaps. */
  async detectKnowledgeGaps(userId: string): Promise<{ topicId: string; severity: string; accuracy: number }[]> {
    const masteries = await this.prisma.topicMastery.findMany({ where: { userId, attempts: { gte: GAP_RULES.MIN_ATTEMPTS } } });
    const gaps: { topicId: string; severity: string; accuracy: number }[] = [];

    for (const m of masteries) {
      if (m.accuracy >= GAP_RULES.MINOR_ACCURACY) {
        // No longer a gap → resolve if previously recorded.
        await this.prisma.knowledgeGap.updateMany({ where: { userId, topicId: m.topicId, resolvedAt: null }, data: { resolvedAt: new Date() } });
        continue;
      }
      const severity = m.accuracy < GAP_RULES.CRITICAL_ACCURACY ? 'critical' : m.accuracy < GAP_RULES.MODERATE_ACCURACY ? 'moderate' : 'minor';
      await this.prisma.knowledgeGap.upsert({
        where: { userId_topicId: { userId, topicId: m.topicId } },
        create: { userId, subjectId: m.subjectId, topicId: m.topicId, severity: severity as never, accuracy: m.accuracy, attempts: m.attempts, resolvedAt: null, recommendation: `Practice more questions on this topic to raise accuracy above ${Math.round(GAP_RULES.MINOR_ACCURACY * 100)}%.` },
        update: { severity: severity as never, accuracy: m.accuracy, attempts: m.attempts, resolvedAt: null },
      });
      gaps.push({ topicId: m.topicId, severity, accuracy: m.accuracy });
      this.eventEmitter.emit(EVENTS.STUDENT_GAP_DETECTED, { userId, topicId: m.topicId, severity });
    }
    return gaps;
  }

  async getKnowledgeGaps(userId: string) {
    const rows = await this.prisma.knowledgeGap.findMany({ where: { userId, resolvedAt: null }, orderBy: [{ severity: 'desc' }, { accuracy: 'asc' }] });
    return rows.map((g: { topicId: string; subjectId: string; severity: string; accuracy: number; attempts: number; recommendation: string | null }) => ({
      topicId: g.topicId, subjectId: g.subjectId, severity: g.severity, accuracy: g.accuracy, attempts: g.attempts, recommendation: g.recommendation,
    }));
  }

  // ── helpers ───────────────────────────────────────────────────────────────────

  private toSnapshot(m: { topicId: string; subjectId: string; accuracy: number; attempts: number; masteryScore: number; tier: string }): TopicSnapshot {
    return { topicId: m.topicId, subjectId: m.subjectId, accuracy: m.accuracy, attempts: m.attempts, masteryScore: m.masteryScore, tier: m.tier };
  }

  private dateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
}
