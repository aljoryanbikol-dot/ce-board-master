/**
 * @file exam-recommendation.service.ts
 * @module Exams/Services
 *
 * ExamRecommendationService — recommends what to do after an exam: which
 * weak subjects/topics to retake, and a suggested next exam configuration. It
 * reuses the exam's own weakness analysis and the Student Learning Platform's
 * recommendation engine (composition over duplication). AI-ready: the next-exam
 * suggestion is encapsulated so an AI planner can replace the heuristic later.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ExamAnalyticsService } from './exam-analytics.service';
import { QuestionRecommendationService } from '../../student/services/question-recommendation.service';
import { ExamErrors } from '../errors/exam.errors';

@Injectable()
export class ExamRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: ExamAnalyticsService,
    private readonly studentRecommendations: QuestionRecommendationService,
  ) {}

  /** Suggest a focused retake + practice questions based on an exam's weaknesses. */
  async afterExam(userId: string, examId: string) {
    const result = await this.prisma.examResult.findUnique({ where: { examId } });
    if (!result) throw ExamErrors.resultNotReady();
    if (result.userId !== userId) throw ExamErrors.ownershipViolation();

    const ws = await this.analytics.weaknessStrength(userId, examId);
    const weakSubjects = Array.from(new Set((ws?.weaknesses ?? []).map((w) => w.subjectId)));

    // Suggested next exam: a focused retake on the weakest subject(s).
    const suggestedExam = weakSubjects.length
      ? { kind: 'custom', focus: 'weak_subjects', composition: weakSubjects.map((subjectId) => ({ subjectId, count: 20 })) }
      : { kind: 'full_board', focus: 'maintain', composition: [] };

    // Practice questions to close the gaps (delegated to the student recommender).
    const practice = await this.studentRecommendations.recommend(userId, { limit: 10, subjectId: weakSubjects[0] });

    return {
      examId,
      passed: result.status === 'pass',
      weakSubjects,
      weakTopics: (ws?.weaknesses ?? []).filter((w) => w.topicId).map((w) => ({ subjectId: w.subjectId, topicId: w.topicId, scorePercent: w.scorePercent })),
      suggestedExam,
      practiceQuestions: practice,
    };
  }
}
