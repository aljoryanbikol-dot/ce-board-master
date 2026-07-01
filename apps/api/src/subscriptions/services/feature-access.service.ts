/**
 * @file feature-access.service.ts
 * @module Subscriptions/Services
 *
 * FeatureAccessService — the single place that knows what Free vs Premium
 * means in terms of usage. Every quota check in the app (Practice, Mock
 * Exams, AI Tutor, content-library previews, Progress Analytics) goes
 * through here instead of re-deriving "is this user free tier, and have they
 * used too much" independently in each module.
 *
 * Every method takes a bare `userId` and resolves the current tier itself
 * (one indexed lookup) rather than trusting a tier value the caller might
 * already be holding — callers into Practice/Exams/AI Tutor often only have
 * the id on hand, and a stale/incomplete tier passed in by mistake would
 * silently disable enforcement instead of failing loudly.
 *
 * Free plan model (single lifetime pool, not a recurring daily allowance):
 *  - up to `maxQuestions` total answered practice questions
 *  - up to `maxMockExams` mock exams started (separate cap — a mock exam's
 *    own question count is unrelated to the practice-question pool)
 *  - AI Tutor is available only while the practice-question pool isn't
 *    exhausted (it shares the same `maxQuestions` cap, not a separate one)
 * Limits are read from PlanService.getFreeTierLimits() — the `free` plan's
 * `limits` JSONB column in the DB — never hardcoded or env-driven here.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionTierResolverService } from '../../auth/services/subscription-tier-resolver.service';
import { PlanService } from './plan.service';
import { SubscriptionErrors } from '../subscriptions.errors';

@Injectable()
export class FeatureAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tierResolver: SubscriptionTierResolverService,
    private readonly plans: PlanService,
  ) {}

  async isFreeTier(userId: string): Promise<boolean> {
    return (await this.tierResolver.resolve(userId)) === 'free';
  }

  /** Total practice questions answered so far — the Free plan's single
   * lifetime pool ("100 questions in total"). */
  private async questionsUsed(userId: string): Promise<number> {
    return this.prisma.questionAttempt.count({ where: { userId } });
  }

  /** Blocks starting a new practice session once the question pool is spent. */
  async enforcePracticeQuota(userId: string): Promise<void> {
    if (!(await this.isFreeTier(userId))) return;
    const limits = await this.plans.getFreeTierLimits();
    const used = await this.questionsUsed(userId);
    if (used >= limits.maxQuestions) {
      throw SubscriptionErrors.freeTierLimitReached('practice questions', limits.maxQuestions);
    }
  }

  /** Lifetime cap on mock exams for Free — independent of the question pool. */
  async enforceMockExamQuota(userId: string): Promise<void> {
    if (!(await this.isFreeTier(userId))) return;
    const limits = await this.plans.getFreeTierLimits();
    const used = await this.prisma.mockExam.count({ where: { userId } });
    if (used >= limits.maxMockExams) {
      throw SubscriptionErrors.freeTierLimitReached('mock exams', limits.maxMockExams);
    }
  }

  /** AI Tutor shares the practice-question pool — once it's spent, Free
   * access to the Tutor ends too (per the Free plan spec: "AI Tutor
   * available only for those [N] questions"). */
  async enforceAiTutorQuota(userId: string): Promise<void> {
    if (!(await this.isFreeTier(userId))) return;
    const limits = await this.plans.getFreeTierLimits();
    const used = await this.questionsUsed(userId);
    if (used >= limits.maxQuestions) {
      throw SubscriptionErrors.freeTierLimitReached('AI Tutor', limits.maxQuestions);
    }
  }

  /** Free users get a preview window over library content (Formula/Flashcard/
   * Review Notes); Premium is unlimited. Returns undefined when no cap
   * applies — callers pass this straight through as a Prisma `take`. */
  async previewLimit(userId: string): Promise<number | undefined> {
    if (!(await this.isFreeTier(userId))) return undefined;
    const limits = await this.plans.getFreeTierLimits();
    return limits.contentPreviewItems;
  }

  /** Progress Analytics is a Premium-only feature per the Free plan spec (no partial view). */
  async assertAnalyticsAccess(userId: string): Promise<void> {
    if (await this.isFreeTier(userId)) {
      throw SubscriptionErrors.freeTierLimitReached('Progress Analytics', 0);
    }
  }
}
