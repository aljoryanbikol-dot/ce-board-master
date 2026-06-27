/**
 * @file exam-analytics.service.ts
 * @module Exams/Services
 *
 * ExamAnalyticsService — analytics over exam results: performance by subject /
 * topic / learning objective / blueprint, weakness & strength analysis, exam
 * history, and a leaderboard-ready ranking by score. All ownership-scoped for
 * personal views; the leaderboard aggregates across users by result score.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ANALYSIS_RULES } from '../constants/exam.constants';
import type { WeaknessStrength } from '../types/exam.types';

@Injectable()
export class ExamAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async history(userId: string, limit: number, cursor?: string) {
    const rows = await this.prisma.examResult.findMany({
      where: { userId }, orderBy: { computedAt: 'desc' }, take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: { exam: { select: { title: true, kind: true } } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: page.map((r: any) => ({ resultCode: r.resultCode, examId: r.examId, title: r.exam?.title, kind: r.exam?.kind, scorePercent: r.scorePercent, status: r.status, passed: r.status === 'pass', computedAt: r.computedAt.toISOString() })),
      pagination: { cursor: hasMore ? page[page.length - 1]!.id : null, hasMore },
    };
  }

  /** Performance breakdown for a single result, by subject / topic / LO. */
  async performance(userId: string, examId: string) {
    const result = await this.prisma.examResult.findUnique({ where: { examId }, include: { subjectScores: true, topicScores: true } });
    if (!result || result.userId !== userId) return null;

    // Performance by learning objective + blueprint (derived from exam questions).
    const examQuestions = await this.prisma.examQuestion.findMany({ where: { examId }, include: { answer: true } });
    const byLo = new Map<string, { total: number; correct: number }>();
    for (const eq of examQuestions as any[]) {
      if (!eq.learningObjective) continue;
      const cur = byLo.get(eq.learningObjective) ?? { total: 0, correct: 0 };
      cur.total++; if (eq.answer?.isCorrect) cur.correct++;
      byLo.set(eq.learningObjective, cur);
    }

    return {
      examId,
      bySubject: result.subjectScores.map((s: any) => ({ subjectId: s.subjectId, total: s.total, correct: s.correct, scorePercent: s.scorePercent, weightPercent: s.weightPercent })),
      byTopic: result.topicScores.map((t: any) => ({ subjectId: t.subjectId, topicId: t.topicId, total: t.total, correct: t.correct, scorePercent: t.scorePercent })),
      byLearningObjective: Array.from(byLo.entries()).map(([lo, v]) => ({ learningObjective: lo, total: v.total, correct: v.correct, scorePercent: Math.round((v.correct / v.total) * 10000) / 100 })),
    };
  }

  /** Weakness & strength analysis from a result's subject/topic scores. */
  async weaknessStrength(userId: string, examId: string): Promise<WeaknessStrength | null> {
    const result = await this.prisma.examResult.findUnique({ where: { examId }, include: { subjectScores: true, topicScores: true } });
    if (!result || result.userId !== userId) return null;

    const weaknesses: WeaknessStrength['weaknesses'] = [];
    const strengths: WeaknessStrength['strengths'] = [];
    for (const t of result.topicScores as any[]) {
      if (t.scorePercent < ANALYSIS_RULES.WEAK_BELOW) weaknesses.push({ subjectId: t.subjectId, topicId: t.topicId, scorePercent: t.scorePercent });
      else if (t.scorePercent >= ANALYSIS_RULES.STRONG_AT_OR_ABOVE) strengths.push({ subjectId: t.subjectId, topicId: t.topicId, scorePercent: t.scorePercent });
    }
    for (const s of result.subjectScores as any[]) {
      if (s.scorePercent < ANALYSIS_RULES.WEAK_BELOW) weaknesses.push({ subjectId: s.subjectId, scorePercent: s.scorePercent });
      else if (s.scorePercent >= ANALYSIS_RULES.STRONG_AT_OR_ABOVE) strengths.push({ subjectId: s.subjectId, scorePercent: s.scorePercent });
    }
    weaknesses.sort((a, b) => a.scorePercent - b.scorePercent);
    strengths.sort((a, b) => b.scorePercent - a.scorePercent);
    return { weaknesses, strengths };
  }

  /** Leaderboard-ready ranking by exam score (optionally within a template). */
  async leaderboard(templateId: string | undefined, limit: number) {
    const rows = await this.prisma.examResult.findMany({
      where: { status: { in: ['pass', 'fail'] }, ...(templateId && { exam: { templateId } }) },
      orderBy: [{ scorePercent: 'desc' }, { timeSpentSec: 'asc' }], take: limit,
      select: { userId: true, scorePercent: true, timeSpentSec: true, resultCode: true },
    });
    return rows.map((r: any, i: number) => ({ rank: i + 1, userId: r.userId, scorePercent: r.scorePercent, timeSpentSec: r.timeSpentSec, resultCode: r.resultCode }));
  }
}
