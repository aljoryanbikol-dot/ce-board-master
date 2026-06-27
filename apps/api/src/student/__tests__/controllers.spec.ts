/**
 * @file controllers.spec.ts
 * @module Student/Tests
 *
 * Direct-instantiation controller tests (esbuild has no DI metadata). Verify each
 * endpoint delegates to its service with the current user's id for ownership.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentDashboardController } from '../controllers/student-dashboard.controller';
import { PracticeController } from '../controllers/practice.controller';
import { ProgressController } from '../controllers/progress.controller';
import { AchievementController } from '../controllers/achievement.controller';
import { StudyPlannerController } from '../controllers/study-planner.controller';
import { EngagementController } from '../controllers/engagement.controller';
import type { AuthenticatedUser } from '../../auth/auth.types';

const user: AuthenticatedUser = { id: 'u-1', email: 'student@ce.com', role: 'subscriber', subscriptionTier: 'pro' } as never;

describe('Student controllers (delegation + ownership)', () => {
  describe('StudentDashboardController', () => {
    it('delegates to dashboard.getDashboard with the user id', async () => {
      const svc = { getDashboard: vi.fn().mockResolvedValue({}) };
      await new StudentDashboardController(svc as never).get(user);
      expect(svc.getDashboard).toHaveBeenCalledWith('u-1');
    });
  });

  describe('PracticeController', () => {
    const practice = { start: vi.fn().mockResolvedValue({}), listSessions: vi.fn().mockResolvedValue({}), getSession: vi.fn().mockResolvedValue({}), submitAnswer: vi.fn().mockResolvedValue({}), complete: vi.fn().mockResolvedValue({}) };
    const recs = { recommend: vi.fn().mockResolvedValue([]) };
    let c: PracticeController;
    beforeEach(() => { vi.clearAllMocks(); c = new PracticeController(practice as never, recs as never); });

    it('start passes user id + body', async () => { await c.start({ mode: 'subject' } as never, user); expect(practice.start).toHaveBeenCalledWith('u-1', { mode: 'subject' }); });
    it('answerInSession passes session id + body', async () => { await c.answerInSession('s-1', { questionId: 'q' } as never, user); expect(practice.submitAnswer).toHaveBeenCalledWith('u-1', 's-1', { questionId: 'q' }); });
    it('answer (standalone) passes null session', async () => { await c.answer({ questionId: 'q' } as never, user); expect(practice.submitAnswer).toHaveBeenCalledWith('u-1', null, { questionId: 'q' }); });
    it('getSession enforces ownership via user id', async () => { await c.getSession('s-1', user); expect(practice.getSession).toHaveBeenCalledWith('u-1', 's-1'); });
    it('complete delegates', async () => { await c.complete('s-1', user); expect(practice.complete).toHaveBeenCalledWith('u-1', 's-1'); });
    it('recommend delegates with limit', async () => { await c.recommend({ limit: 10 } as never, user); expect(recs.recommend).toHaveBeenCalledWith('u-1', { limit: 10, subjectId: undefined }); });
  });

  describe('ProgressController', () => {
    const progress = { masteryForUser: vi.fn().mockResolvedValue([]), weakTopics: vi.fn().mockResolvedValue([]), strongTopics: vi.fn().mockResolvedValue([]), getKnowledgeGaps: vi.fn().mockResolvedValue([]) };
    const stats = { progress: vi.fn().mockResolvedValue({}), accuracyAndSpeed: vi.fn().mockResolvedValue({}), distribution: vi.fn().mockResolvedValue({}), masteryHeatmap: vi.fn().mockResolvedValue([]), performanceHistory: vi.fn().mockResolvedValue([]) };
    const path = { getActive: vi.fn().mockResolvedValue(null), generate: vi.fn().mockResolvedValue({}) };
    let c: ProgressController;
    beforeEach(() => { vi.clearAllMocks(); c = new ProgressController(progress as never, stats as never, path as never); });

    it('mastery delegates', async () => { await c.mastery(user); expect(progress.masteryForUser).toHaveBeenCalledWith('u-1'); });
    it('weak/strong/gaps delegate', async () => { await c.weak(user); await c.strong(user); await c.gaps(user); expect(progress.weakTopics).toHaveBeenCalled(); expect(progress.strongTopics).toHaveBeenCalled(); expect(progress.getKnowledgeGaps).toHaveBeenCalledWith('u-1'); });
    it('learning path get + generate delegate', async () => { await c.getPath(user); await c.generatePath(user); expect(path.getActive).toHaveBeenCalledWith('u-1'); expect(path.generate).toHaveBeenCalledWith('u-1'); });
    it('statistics delegate', async () => { await c.stats({ period: 'daily', days: 30 } as never, user); await c.accuracySpeed(user); await c.distribution(user); await c.heatmap(user); await c.performanceHistory(user); expect(stats.progress).toHaveBeenCalled(); expect(stats.masteryHeatmap).toHaveBeenCalledWith('u-1'); });
  });

  describe('AchievementController', () => {
    const ach = { getStudentAchievements: vi.fn().mockResolvedValue({}), leaderboard: vi.fn().mockResolvedValue([]) };
    let c: AchievementController;
    beforeEach(() => { vi.clearAllMocks(); c = new AchievementController(ach as never); });
    it('list delegates with user id', async () => { await c.list(user); expect(ach.getStudentAchievements).toHaveBeenCalledWith('u-1'); });
    it('leaderboard delegates with limit', async () => { await c.leaderboard({ limit: 20 } as never); expect(ach.leaderboard).toHaveBeenCalledWith(20); });
  });

  describe('StudyPlannerController', () => {
    const planner = { upsertGoal: vi.fn().mockResolvedValue({}), listGoals: vi.fn().mockResolvedValue([]), createPlan: vi.fn().mockResolvedValue({}), listPlans: vi.fn().mockResolvedValue([]), getPlan: vi.fn().mockResolvedValue({}), deletePlan: vi.fn().mockResolvedValue({}), addTask: vi.fn().mockResolvedValue({}), updateTaskStatus: vi.fn().mockResolvedValue({}), calendar: vi.fn().mockResolvedValue([]) };
    let c: StudyPlannerController;
    beforeEach(() => { vi.clearAllMocks(); c = new StudyPlannerController(planner as never); });
    it('upsertGoal delegates with user id', async () => { await c.upsertGoal({ period: 'daily', targetQuestions: 20 } as never, user); expect(planner.upsertGoal).toHaveBeenCalledWith('u-1', { period: 'daily', targetQuestions: 20 }); });
    it('plan CRUD delegates with ownership', async () => { await c.createPlan({ title: 'x' } as never, user); await c.getPlan('p-1', user); await c.deletePlan('p-1', user); expect(planner.getPlan).toHaveBeenCalledWith('u-1', 'p-1'); expect(planner.deletePlan).toHaveBeenCalledWith('u-1', 'p-1'); });
    it('addTask + updateTaskStatus delegate', async () => { await c.addTask('p-1', { title: 't' } as never, user); await c.updateTaskStatus('t-1', { status: 'completed' } as never, user); expect(planner.addTask).toHaveBeenCalledWith('u-1', 'p-1', { title: 't' }); expect(planner.updateTaskStatus).toHaveBeenCalledWith('u-1', 't-1', { status: 'completed' }); });
    it('calendar delegates with range', async () => { await c.calendar('2026-07-01', '2026-07-31', user); expect(planner.calendar).toHaveBeenCalledWith('u-1', '2026-07-01', '2026-07-31'); });
  });

  describe('EngagementController', () => {
    const eng = { addBookmark: vi.fn().mockResolvedValue({}), removeBookmark: vi.fn().mockResolvedValue({}), listBookmarks: vi.fn().mockResolvedValue({}), addFavorite: vi.fn().mockResolvedValue({}), removeFavorite: vi.fn().mockResolvedValue({}), listFavorites: vi.fn().mockResolvedValue({}), recordView: vi.fn().mockResolvedValue({}), listRecentlyViewed: vi.fn().mockResolvedValue([]), questionHistory: vi.fn().mockResolvedValue({}), recentlyAnswered: vi.fn().mockResolvedValue([]) };
    let c: EngagementController;
    beforeEach(() => { vi.clearAllMocks(); c = new EngagementController(eng as never); });
    it('bookmarks delegate with user id', async () => { await c.addBookmark({ questionId: 'q' } as never, user); await c.removeBookmark('q', user); expect(eng.addBookmark).toHaveBeenCalledWith('u-1', { questionId: 'q' }); expect(eng.removeBookmark).toHaveBeenCalledWith('u-1', 'q'); });
    it('favorites delegate with question id', async () => { await c.addFavorite({ questionId: 'q' } as never, user); await c.removeFavorite('q', user); expect(eng.addFavorite).toHaveBeenCalledWith('u-1', 'q'); });
    it('recordView + history delegate', async () => { await c.recordView({ questionId: 'q' } as never, user); await c.history({ limit: 20 } as never, user); await c.recentlyAnswered({ limit: 20 } as never, user); expect(eng.recordView).toHaveBeenCalledWith('u-1', 'q'); expect(eng.questionHistory).toHaveBeenCalled(); });
  });
});
