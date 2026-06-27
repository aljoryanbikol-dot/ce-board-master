/**
 * @file recommendation.service.ts
 * @module AITutor/Services
 *
 * RecommendationService (tutor) — smart, tutor-facing recommendations. It reuses
 * the Student Learning Platform's QuestionRecommendationService for "what to
 * practice next" and the Mock Examination Engine's analytics for "what you got
 * wrong", producing a unified, AI-ready recommendation payload. Zero duplicated
 * recommendation logic — it composes the existing engines.
 */
import { Injectable } from '@nestjs/common';
import { ProgressTrackingService } from '../../student/services/progress-tracking.service';
import { QuestionRecommendationService } from '../../student/services/question-recommendation.service';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly progress: ProgressTrackingService,
    private readonly studentRecommendations: QuestionRecommendationService,
  ) {}

  /** What the student should study/practice next, with the reasoning. */
  async smartRecommendations(userId: string, opts: { limit?: number; subjectId?: string } = {}) {
    const [weakTopics, questions, gaps] = await Promise.all([
      this.progress.weakTopics(userId, 5),
      this.studentRecommendations.recommend(userId, { limit: opts.limit ?? 10, subjectId: opts.subjectId }),
      this.progress.getKnowledgeGaps(userId),
    ]);

    return {
      focusTopics: weakTopics.map((t: { topicId: string; subjectId: string; accuracy: number; tier: string }) => ({ topicId: t.topicId, subjectId: t.subjectId, accuracy: t.accuracy, tier: t.tier })),
      knowledgeGaps: gaps.map((g: { topicId: string; subjectId: string; severity: string; accuracy: number }) => ({ topicId: g.topicId, subjectId: g.subjectId, severity: g.severity, accuracy: g.accuracy })),
      recommendedQuestions: questions,
      rationale: weakTopics.length
        ? 'Prioritizing your weakest topics — practice these to raise your overall readiness fastest.'
        : 'You have no flagged weak topics; these questions broaden your coverage.',
    };
  }
}
