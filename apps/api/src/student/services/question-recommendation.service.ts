/**
 * @file question-recommendation.service.ts
 * @module Student/Services
 *
 * QuestionRecommendationService — personalized question recommendation. It ranks
 * published questions a student should practice next, prioritizing weak topics
 * (knowledge gaps) and unseen questions, while avoiding recently-answered ones.
 *
 * AI-ready: the ranking is encapsulated behind recommend(); when the AI engine
 * exposes a recommendation model, it can supply candidate questionIds here
 * without changing callers (the practice flow and dashboard depend only on this
 * method's contract).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RECOMMENDATION_LIMITS, GAP_RULES } from '../constants/student.constants';
import type { RecommendedQuestion } from '../types/student.types';

@Injectable()
export class QuestionRecommendationService {

  constructor(private readonly prisma: PrismaService) {}

  async recommend(userId: string, opts: { limit?: number; subjectId?: string } = {}): Promise<RecommendedQuestion[]> {
    const limit = Math.min(opts.limit ?? RECOMMENDATION_LIMITS.DEFAULT, RECOMMENDATION_LIMITS.MAX);

    // 1. Weakest topics first (knowledge gaps).
    const weakTopics = await this.prisma.topicMastery.findMany({
      where: { userId, attempts: { gte: GAP_RULES.MIN_ATTEMPTS }, accuracy: { lt: GAP_RULES.WEAK_TOPIC_ACCURACY }, ...(opts.subjectId && { subjectId: opts.subjectId }) },
      orderBy: { accuracy: 'asc' }, take: 5, select: { topicId: true, subjectId: true, accuracy: true },
    });

    // 2. Questions already answered (to avoid).
    const answered = await this.prisma.questionAttempt.findMany({ where: { userId }, select: { questionId: true }, distinct: ['questionId'], take: 2000 });
    const answeredIds = new Set(answered.map((a: { questionId: string }) => a.questionId));

    const recs: RecommendedQuestion[] = [];

    // Prioritize weak-topic questions the student hasn't answered.
    for (const topic of weakTopics) {
      const pool = await this.prisma.question.findMany({
        where: { deletedAt: null, questionStatus: 'published', topicId: topic.topicId, id: { notIn: Array.from(answeredIds).slice(0, 1000) } },
        select: { id: true, subjectId: true, topicId: true, difficultyLevelId: true }, take: limit,
      });
      for (const q of pool) {
        recs.push({ questionId: q.id, subjectId: q.subjectId, topicId: q.topicId, difficultyLevelId: q.difficultyLevelId, reason: `Reinforce weak topic (accuracy ${Math.round(topic.accuracy * 100)}%).`, priority: 100 - Math.round(topic.accuracy * 100) });
        if (recs.length >= limit) break;
      }
      if (recs.length >= limit) break;
    }

    // 3. Backfill with fresh published questions the student hasn't seen.
    if (recs.length < limit) {
      const backfill = await this.prisma.question.findMany({
        where: { deletedAt: null, questionStatus: 'published', id: { notIn: [...Array.from(answeredIds).slice(0, 1000), ...recs.map((r) => r.questionId)] }, ...(opts.subjectId && { subjectId: opts.subjectId }) },
        select: { id: true, subjectId: true, topicId: true, difficultyLevelId: true }, take: limit - recs.length, orderBy: { createdAt: 'desc' },
      });
      for (const q of backfill) recs.push({ questionId: q.id, subjectId: q.subjectId, topicId: q.topicId, difficultyLevelId: q.difficultyLevelId, reason: 'New question to broaden coverage.', priority: 10 });
    }

    return recs.slice(0, limit).sort((a, b) => b.priority - a.priority);
  }
}
