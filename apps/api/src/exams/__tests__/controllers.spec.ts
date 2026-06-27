/**
 * @file controllers.spec.ts
 * @module Exams/Tests
 *
 * Direct-instantiation controller tests (esbuild has no DI metadata). Verify each
 * endpoint delegates to its service with the current user's id for ownership.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockExamController } from '../controllers/mock-exam.controller';
import { ExamSessionController } from '../controllers/exam-session.controller';
import { ExamResultController } from '../controllers/exam-result.controller';
import { ExamReviewController } from '../controllers/exam-review.controller';
import { ExamAnalyticsController } from '../controllers/exam-analytics.controller';
import type { AuthenticatedUser } from '../../auth/auth.types';

const user: AuthenticatedUser = { id: 'u-1', email: 'student@ce.com', role: 'subscriber', subscriptionTier: 'pro' } as never;

describe('Exam controllers (delegation + ownership)', () => {
  describe('MockExamController', () => {
    const mockExam = { createTemplate: vi.fn().mockResolvedValue({}), listTemplates: vi.fn().mockResolvedValue([]), getTemplate: vi.fn().mockResolvedValue({}) };
    const session = { start: vi.fn().mockResolvedValue({}) };
    let c: MockExamController;
    beforeEach(() => { vi.clearAllMocks(); c = new MockExamController(mockExam as never, session as never); });
    it('createTemplate passes user id + body', async () => { await c.createTemplate({ code: 'X' } as never, user); expect(mockExam.createTemplate).toHaveBeenCalledWith('u-1', { code: 'X' }); });
    it('listTemplates delegates', async () => { await c.listTemplates(); expect(mockExam.listTemplates).toHaveBeenCalled(); });
    it('getTemplate delegates', async () => { await c.getTemplate('tpl-1'); expect(mockExam.getTemplate).toHaveBeenCalledWith('tpl-1'); });
    it('create delegates to session.start with user id', async () => { await c.create({ kind: 'subject' } as never, user); expect(session.start).toHaveBeenCalledWith('u-1', { kind: 'subject' }); });
  });

  describe('ExamSessionController', () => {
    const session = { resumeInterrupted: vi.fn().mockResolvedValue(null), getExam: vi.fn().mockResolvedValue({}), getQuestions: vi.fn().mockResolvedValue([]), begin: vi.fn().mockResolvedValue({}), saveAnswer: vi.fn().mockResolvedValue({}), bookmark: vi.fn().mockResolvedValue({}), pause: vi.fn().mockResolvedValue({}), resume: vi.fn().mockResolvedValue({}), submit: vi.fn().mockResolvedValue({}) };
    let c: ExamSessionController;
    beforeEach(() => { vi.clearAllMocks(); c = new ExamSessionController(session as never); });
    it('resume delegates with user id', async () => { await c.resumeInterrupted(user); expect(session.resumeInterrupted).toHaveBeenCalledWith('u-1'); });
    it('getExam enforces ownership via user id', async () => { await c.getExam('ex-1', user); expect(session.getExam).toHaveBeenCalledWith('u-1', 'ex-1'); });
    it('getQuestions delegates', async () => { await c.getQuestions('ex-1', user); expect(session.getQuestions).toHaveBeenCalledWith('u-1', 'ex-1'); });
    it('begin delegates', async () => { await c.begin('ex-1', user); expect(session.begin).toHaveBeenCalledWith('u-1', 'ex-1'); });
    it('saveAnswer passes exam id + body', async () => { await c.saveAnswer('ex-1', { examQuestionId: 'eq-1' } as never, user); expect(session.saveAnswer).toHaveBeenCalledWith('u-1', 'ex-1', { examQuestionId: 'eq-1' }); });
    it('bookmark passes the flag', async () => { await c.bookmark('ex-1', { examQuestionId: 'eq-1', bookmarked: true } as never, user); expect(session.bookmark).toHaveBeenCalledWith('u-1', 'ex-1', 'eq-1', true); });
    it('pause/resume/submit delegate', async () => { await c.pause('ex-1', user); await c.resume('ex-1', user); await c.submit('ex-1', user); expect(session.pause).toHaveBeenCalledWith('u-1', 'ex-1'); expect(session.submit).toHaveBeenCalledWith('u-1', 'ex-1'); });
  });

  describe('ExamResultController', () => {
    const result = { getResultByExam: vi.fn().mockResolvedValue({}), getResultByCode: vi.fn().mockResolvedValue({}) };
    let c: ExamResultController;
    beforeEach(() => { vi.clearAllMocks(); c = new ExamResultController(result as never); });
    it('getResult enforces ownership via user id', async () => { await c.getResult('ex-1', user); expect(result.getResultByExam).toHaveBeenCalledWith('ex-1', 'u-1'); });
    it('getByCode delegates', async () => { await c.getByCode('CEBM-EX-XX'); expect(result.getResultByCode).toHaveBeenCalledWith('CEBM-EX-XX'); });
  });

  describe('ExamReviewController', () => {
    const review = { review: vi.fn().mockResolvedValue({}) };
    const recs = { afterExam: vi.fn().mockResolvedValue({}) };
    let c: ExamReviewController;
    beforeEach(() => { vi.clearAllMocks(); c = new ExamReviewController(review as never, recs as never); });
    it('getReview passes user id + filter', async () => { await c.getReview('ex-1', { filter: 'incorrect' } as never, user); expect(review.review).toHaveBeenCalledWith('u-1', 'ex-1', { filter: 'incorrect' }); });
    it('getRecommendations delegates with user id', async () => { await c.getRecommendations('ex-1', user); expect(recs.afterExam).toHaveBeenCalledWith('u-1', 'ex-1'); });
  });

  describe('ExamAnalyticsController', () => {
    const analytics = { history: vi.fn().mockResolvedValue({}), performance: vi.fn().mockResolvedValue({}), weaknessStrength: vi.fn().mockResolvedValue({}), leaderboard: vi.fn().mockResolvedValue([]) };
    let c: ExamAnalyticsController;
    beforeEach(() => { vi.clearAllMocks(); c = new ExamAnalyticsController(analytics as never); });
    it('history delegates with user id', async () => { await c.history({ limit: 20 } as never, user); expect(analytics.history).toHaveBeenCalledWith('u-1', 20, undefined); });
    it('performance enforces ownership', async () => { await c.performance('ex-1', user); expect(analytics.performance).toHaveBeenCalledWith('u-1', 'ex-1'); });
    it('analysis delegates', async () => { await c.analysis('ex-1', user); expect(analytics.weaknessStrength).toHaveBeenCalledWith('u-1', 'ex-1'); });
    it('leaderboard delegates with template + limit', async () => { await c.leaderboard({ templateId: 'tpl-1', limit: 20 } as never); expect(analytics.leaderboard).toHaveBeenCalledWith('tpl-1', 20); });
  });
});
