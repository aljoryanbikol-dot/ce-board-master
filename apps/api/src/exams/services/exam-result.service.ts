/**
 * @file exam-result.service.ts
 * @module Exams/Services
 *
 * ExamResultService — computes, persists, and reads exam results. On submit it
 * grades every answer (mapping presented→original choice letters), delegates the
 * math to ExamScoringService, persists the ExamResult + per-subject/per-topic
 * breakdowns in one transaction, and produces a certificate-ready result code.
 * It also bridges to the Student Learning Platform: each graded answer updates
 * topic mastery (so exams advance the same progress system as practice).
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { ExamScoringService, type GradedQuestion } from './exam-scoring.service';
import { ProgressTrackingService } from '../../student/services/progress-tracking.service';
import { ExamErrors } from '../errors/exam.errors';
import { EVENTS, CACHE_KEYS } from '../../common/constants';
import { RESULT_CODE_PREFIX } from '../constants/exam.constants';
import type { ExamResultView, ScoreBreakdown } from '../types/exam.types';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ExamResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly scoring: ExamScoringService,
    private readonly progress: ProgressTrackingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Grade & persist the result for a submitted exam. Idempotent: returns the
   * existing result if already computed.
   */
  async computeAndPersist(examId: string, userId: string, timeSpentSec: number): Promise<ExamResultView> {
    const existing = await this.prisma.examResult.findUnique({ where: { examId } });
    if (existing) return this.toView(existing.id);

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId }, include: { answer: true },
    });

    // Grade each question: map the presented selected letter back to the original.
    const graded: GradedQuestion[] = examQuestions.map((eq: any) => {
      const presented = eq.answer?.selectedChoice ?? null;
      const originalSelected = presented ? this.presentedToOriginal(presented, eq.choiceOrder as string[]) : null;
      const isCorrect = this.scoring.isCorrect(originalSelected, eq.correctChoice);
      return { subjectId: eq.subjectId, topicId: eq.topicId, selectedChoice: originalSelected, correctChoice: eq.correctChoice, isCorrect };
    });

    const totalQuestions = examQuestions.length;
    const exam = await this.prisma.mockExam.findUnique({ where: { id: examId } });
    const passingScore = exam?.passingScore ?? 70;
    const breakdown = this.scoring.computeBreakdown(graded, totalQuestions, passingScore, timeSpentSec);

    const resultCode = `${RESULT_CODE_PREFIX}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Persist per-answer correctness for review.
      for (let i = 0; i < examQuestions.length; i++) {
        const eq = examQuestions[i]!;
        if (eq.answer) {
          await tx.examAnswer.update({ where: { id: eq.answer.id }, data: { isCorrect: graded[i]!.isCorrect } });
        }
      }

      const created = await tx.examResult.create({
        data: {
          examId, userId, totalQuestions, answeredCount: breakdown.answeredCount,
          correctCount: breakdown.correctCount, incorrectCount: breakdown.incorrectCount, skippedCount: breakdown.skippedCount,
          scorePercent: breakdown.scorePercent, passingScore, status: breakdown.passed ? 'pass' : 'fail',
          timeSpentSec, resultCode,
          subjectScores: { create: breakdown.bySubject.map((s) => ({ subjectId: s.subjectId, total: s.total, correct: s.correct, scorePercent: s.scorePercent, weightPercent: s.weightPercent })) },
          topicScores: { create: breakdown.byTopic.map((t) => ({ subjectId: t.subjectId, topicId: t.topicId, total: t.total, correct: t.correct, scorePercent: t.scorePercent })) },
        },
      });
      return created;
    });

    // Bridge to the Student Learning Platform: advance topic mastery per graded answer.
    for (const g of graded) {
      if (g.topicId && g.selectedChoice != null) {
        await this.progress.updateTopicMastery(userId, { subjectId: g.subjectId, topicId: g.topicId, isCorrect: g.isCorrect, timeSpentSec: 0 });
      }
    }

    this.eventEmitter.emit(EVENTS.EXAM_SCORED, { userId, examId, scorePercent: breakdown.scorePercent, passed: breakdown.passed });
    this.eventEmitter.emit(breakdown.passed ? EVENTS.EXAM_PASSED : EVENTS.EXAM_FAILED, { userId, examId, scorePercent: breakdown.scorePercent });
    await this.cache.del(CACHE_KEYS.exam.history(userId));

    return this.toView(result.id);
  }

  async getResultByExam(examId: string, userId: string): Promise<ExamResultView> {
    const result = await this.prisma.examResult.findUnique({ where: { examId } });
    if (!result) throw ExamErrors.resultNotReady();
    if (result.userId !== userId) throw ExamErrors.ownershipViolation();
    return this.toView(result.id);
  }

  async getResultByCode(resultCode: string): Promise<ExamResultView> {
    const result = await this.prisma.examResult.findUnique({ where: { resultCode } });
    if (!result) throw ExamErrors.resultNotFound(resultCode);
    return this.toView(result.id);
  }

  // ── view assembly ───────────────────────────────────────────────────────────
  private async toView(resultId: string): Promise<ExamResultView> {
    const r = await this.prisma.examResult.findUniqueOrThrow({ where: { id: resultId }, include: { subjectScores: true, topicScores: true } });
    const breakdown: ScoreBreakdown = {
      totalQuestions: r.totalQuestions, answeredCount: r.answeredCount, correctCount: r.correctCount,
      incorrectCount: r.incorrectCount, skippedCount: r.skippedCount, scorePercent: r.scorePercent,
      passingScore: r.passingScore, passed: r.status === 'pass', timeSpentSec: r.timeSpentSec,
      bySubject: r.subjectScores.map((s: any) => ({ subjectId: s.subjectId, total: s.total, correct: s.correct, scorePercent: s.scorePercent, weightPercent: s.weightPercent })),
      byTopic: r.topicScores.map((t: any) => ({ subjectId: t.subjectId, topicId: t.topicId, total: t.total, correct: t.correct, scorePercent: t.scorePercent })),
    };
    return {
      resultCode: r.resultCode, examId: r.examId, status: r.status, scorePercent: r.scorePercent,
      passingScore: r.passingScore, passed: r.status === 'pass', percentile: r.percentile, breakdown, computedAt: r.computedAt.toISOString(),
    };
  }

  /** Map a presented letter back to the original question letter via choiceOrder. */
  private presentedToOriginal(presented: string, choiceOrder: string[]): string | null {
    const idx = presented.charCodeAt(0) - 65; // 'A'->0
    return choiceOrder[idx] ?? null;
  }
}
