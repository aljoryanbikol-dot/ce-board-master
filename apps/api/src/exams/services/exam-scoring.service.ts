/**
 * @file exam-scoring.service.ts
 * @module Exams/Services
 *
 * ExamScoringService — pure scoring computation. Given graded exam questions and
 * answers, it produces the overall score and the per-subject / per-topic
 * breakdowns. No persistence, no side effects: the single source of scoring
 * truth, reused by ExamResultService (compute & persist) and by analytics.
 */
import { Injectable } from '@nestjs/common';
import type { ScoreBreakdown, SubjectScore, TopicScore } from '../types/exam.types';

export interface GradedQuestion {
  subjectId: string;
  topicId: string | null;
  weightPercent?: number | null;
  selectedChoice: string | null; // original letter, null if unanswered/skipped
  correctChoice: string;
  isCorrect: boolean;
}

@Injectable()
export class ExamScoringService {
  /** Grade a single answer (presented→original mapping handled by the caller). */
  isCorrect(originalSelected: string | null, correctChoice: string): boolean {
    return originalSelected != null && originalSelected === correctChoice;
  }

  /** Compute the full breakdown for a set of graded questions. */
  computeBreakdown(graded: GradedQuestion[], totalQuestions: number, passingScore: number, timeSpentSec: number): ScoreBreakdown {
    const answered = graded.filter((g) => g.selectedChoice != null);
    const correctCount = graded.filter((g) => g.isCorrect).length;
    const answeredCount = answered.length;
    const skippedCount = totalQuestions - answeredCount;
    const incorrectCount = answeredCount - correctCount;
    const scorePercent = totalQuestions > 0 ? this.round((correctCount / totalQuestions) * 100) : 0;

    return {
      totalQuestions,
      answeredCount,
      correctCount,
      incorrectCount,
      skippedCount,
      scorePercent,
      passingScore,
      passed: scorePercent >= passingScore,
      timeSpentSec,
      bySubject: this.bySubject(graded),
      byTopic: this.byTopic(graded),
    };
  }

  private bySubject(graded: GradedQuestion[]): SubjectScore[] {
    const map = new Map<string, { total: number; correct: number; weight: number | null }>();
    for (const g of graded) {
      const cur = map.get(g.subjectId) ?? { total: 0, correct: 0, weight: g.weightPercent ?? null };
      cur.total++; if (g.isCorrect) cur.correct++;
      map.set(g.subjectId, cur);
    }
    return Array.from(map.entries()).map(([subjectId, s]) => ({
      subjectId, total: s.total, correct: s.correct, scorePercent: this.round((s.correct / s.total) * 100), weightPercent: s.weight,
    }));
  }

  private byTopic(graded: GradedQuestion[]): TopicScore[] {
    const map = new Map<string, { subjectId: string; total: number; correct: number }>();
    for (const g of graded) {
      if (!g.topicId) continue;
      const cur = map.get(g.topicId) ?? { subjectId: g.subjectId, total: 0, correct: 0 };
      cur.total++; if (g.isCorrect) cur.correct++;
      map.set(g.topicId, cur);
    }
    return Array.from(map.entries()).map(([topicId, t]) => ({
      subjectId: t.subjectId, topicId, total: t.total, correct: t.correct, scorePercent: this.round((t.correct / t.total) * 100),
    }));
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
