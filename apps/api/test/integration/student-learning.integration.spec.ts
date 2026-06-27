/**
 * @file student-learning.integration.spec.ts
 * @module Student/Integration
 *
 * Wires the REAL student services together (ProgressTrackingService,
 * AchievementService, QuestionRecommendationService, PracticeSessionService,
 * StudentDashboardService, LearningPathService) with an in-memory persistence
 * double. Exercises the full flow end-to-end: start a practice session, submit
 * answers (which must drive mastery + streak + XP + achievements in one
 * transaction), then verify the dashboard reflects the progress and that
 * recommendations + a learning path can be produced.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressTrackingService } from '../../src/student/services/progress-tracking.service';
import { AchievementService } from '../../src/student/services/achievement.service';
import { QuestionRecommendationService } from '../../src/student/services/question-recommendation.service';
import { PracticeSessionService } from '../../src/student/services/practice-session.service';
import { StudentDashboardService } from '../../src/student/services/student-dashboard.service';
import { LearningPathService } from '../../src/student/services/learning-path.service';

// ── Minimal in-memory Prisma double ──────────────────────────────────────────────
function makeInMemoryPrisma() {
  const db = {
    questions: [
      { id: 'q-1', correctChoice: 'A', questionStatus: 'published', subjectId: 's-1', topicId: 't-1', subtopicId: null, difficultyLevelId: 'd-1', bloomLevel: 'apply', deletedAt: null, createdAt: new Date() },
      { id: 'q-2', correctChoice: 'B', questionStatus: 'published', subjectId: 's-1', topicId: 't-1', subtopicId: null, difficultyLevelId: 'd-1', bloomLevel: 'apply', deletedAt: null, createdAt: new Date() },
      { id: 'q-3', correctChoice: 'C', questionStatus: 'published', subjectId: 's-1', topicId: 't-1', subtopicId: null, difficultyLevelId: 'd-1', bloomLevel: 'apply', deletedAt: null, createdAt: new Date() },
    ] as any[],
    attempts: [] as any[],
    sessions: [] as any[],
    mastery: [] as any[],
    streaks: [] as any[],
    xp: [] as any[],
    achievements: [{ id: 'a-1', code: 'FIRST_CORRECT', name: 'First Correct', kind: 'milestone', threshold: 1, xpReward: 20, isActive: true }] as any[],
    studentAchievements: [] as any[],
    gaps: [] as any[],
    paths: [] as any[],
  };
  let seq = 0;
  const uid = (p: string) => `${p}-${++seq}`;

  const prisma: any = {
    $transaction: async (fn: any) => fn(prisma),
    question: {
      findFirst: async ({ where }: any) => db.questions.find((q) => q.id === where.id && q.deletedAt === null) ?? null,
      findMany: async ({ where }: any) => db.questions.filter((q) => q.questionStatus === 'published' && (!where?.topicId || q.topicId === where.topicId) && (!where?.id?.notIn || !where.id.notIn.includes(q.id))),
    },
    questionAttempt: {
      create: async ({ data }: any) => { const a = { id: uid('att'), ...data, attemptedAt: new Date() }; db.attempts.push(a); return a; },
      count: async ({ where }: any) => db.attempts.filter((a) => a.userId === where.userId && (where.questionId === undefined || a.questionId === where.questionId) && (where.isCorrect === undefined || a.isCorrect === where.isCorrect)).length,
      aggregate: async ({ where }: any) => ({ _count: { _all: db.attempts.filter((a) => a.userId === where.userId).length } }),
      findMany: async ({ where }: any) => db.attempts.filter((a) => a.userId === where.userId),
    },
    practiceSession: {
      create: async ({ data }: any) => { const s = { id: uid('sess'), ...data, answeredCount: 0, correctCount: 0, totalTimeSec: 0, startedAt: new Date() }; db.sessions.push(s); return s; },
      findUnique: async ({ where }: any) => db.sessions.find((s) => s.id === where.id) ?? null,
      findFirst: async ({ where }: any) => db.sessions.find((s) => s.userId === where.userId && (!where.status || s.status === where.status)) ?? null,
      update: async ({ where, data }: any) => { const s = db.sessions.find((x) => x.id === where.id); Object.assign(s, data, data.totalTimeSec?.increment ? { totalTimeSec: s.totalTimeSec + data.totalTimeSec.increment } : {}); return s; },
      findMany: async () => db.sessions,
    },
    topicMastery: {
      findUnique: async ({ where }: any) => db.mastery.find((m) => m.userId === where.userId_topicId.userId && m.topicId === where.userId_topicId.topicId) ?? null,
      upsert: async ({ where, create, update }: any) => { const ex = db.mastery.find((m) => m.userId === where.userId_topicId.userId && m.topicId === where.userId_topicId.topicId); if (ex) { Object.assign(ex, update); return ex; } const m = { id: uid('tm'), ...create }; db.mastery.push(m); return m; },
      findMany: async ({ where }: any) => db.mastery.filter((m) => m.userId === where.userId && (where.attempts?.gte === undefined || m.attempts >= where.attempts.gte) && (where.tier === undefined || m.tier === where.tier)),
      count: async ({ where }: any) => db.mastery.filter((m) => m.userId === where.userId && (where.tier === undefined || m.tier === where.tier)).length,
    },
    studyStreakDay: {
      findUnique: async ({ where }: any) => db.streaks.find((s) => s.userId === where.userId_date.userId && s.date.getTime() === where.userId_date.date.getTime()) ?? null,
      upsert: async ({ where, create, update }: any) => { const ex = db.streaks.find((s) => s.userId === where.userId_date.userId && s.date.getTime() === where.userId_date.date.getTime()); if (ex) { Object.assign(ex, { questionsAnswered: ex.questionsAnswered + (update.questionsAnswered?.increment ?? 0) }); return ex; } const s = { id: uid('sd'), ...create }; db.streaks.push(s); return s; },
    },
    studentXp: {
      findUnique: async ({ where }: any) => db.xp.find((x) => x.userId === where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => { const ex = db.xp.find((x) => x.userId === where.userId); if (ex) { Object.assign(ex, update); return ex; } const x = { id: uid('xp'), userId: where.userId, totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0, ...create }; db.xp.push(x); return x; },
      findMany: async () => [...db.xp].sort((a, b) => b.totalXp - a.totalXp),
    },
    studyGoal: { findUnique: async ({ where }: any) => null },
    achievement: { findMany: async () => db.achievements, count: async () => db.achievements.length },
    studentAchievement: {
      findMany: async ({ where }: any) => db.studentAchievements.filter((s) => s.userId === where.userId).map((s) => ({ ...s, achievement: db.achievements.find((a) => a.id === s.achievementId) })),
      create: async ({ data }: any) => { const s = { id: uid('sa'), ...data, earnedAt: new Date() }; db.studentAchievements.push(s); return s; },
    },
    knowledgeGap: {
      findMany: async ({ where }: any) => db.gaps.filter((g) => g.userId === where.userId && (where.resolvedAt === null ? g.resolvedAt === null : true)),
      upsert: async ({ where, create, update }: any) => { const ex = db.gaps.find((g) => g.userId === where.userId_topicId.userId && g.topicId === where.userId_topicId.topicId); if (ex) { Object.assign(ex, update); return ex; } const g = { id: uid('kg'), ...create }; db.gaps.push(g); return g; },
      updateMany: async () => ({ count: 0 }),
    },
    learningPath: {
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: any) => { const p = { id: uid('lp'), ...data, generatedAt: new Date() }; db.paths.push(p); return p; },
      findFirst: async ({ where }: any) => db.paths.find((p) => p.userId === where.userId && p.isActive) ?? null,
    },
  };
  return { prisma, db };
}

function buildHarness() {
  const { prisma, db } = makeInMemoryPrisma();
  const cache = { del: async () => {}, remember: async (_k: string, _ttl: number, fn: () => unknown) => fn() };
  const events = { emit: () => {} };
  const progress = new ProgressTrackingService(prisma as never, events as never);
  const achievements = new AchievementService(prisma as never, events as never);
  const recommendations = new QuestionRecommendationService(prisma as never);
  const practice = new PracticeSessionService(prisma as never, cache as never, progress, achievements, recommendations, events as never);
  const dashboard = new StudentDashboardService(prisma as never, cache as never, progress, achievements);
  const learningPath = new LearningPathService(prisma as never, progress, events as never);
  return { prisma, db, progress, achievements, recommendations, practice, dashboard, learningPath };
}

describe('Student learning — integration (real services)', () => {
  let h: ReturnType<typeof buildHarness>;
  beforeEach(() => { h = buildHarness(); });

  it('start → answer → progress chain → dashboard reflects', async () => {
    const session = await h.practice.start('u-1', { mode: 'subject', subjectId: 's-1', targetCount: 3 } as never);
    expect(session.sessionId).toBeDefined();

    // Answer q-1 correctly.
    const r1 = await h.practice.submitAnswer('u-1', session.sessionId, { questionId: 'q-1', selectedChoice: 'A', timeSpentSec: 20, skipped: false } as never);
    expect(r1.isCorrect).toBe(true);
    expect(r1.xp.awardedXp).toBeGreaterThan(0);
    expect(r1.mastery).not.toBeNull();

    // Answer q-2 incorrectly.
    const r2 = await h.practice.submitAnswer('u-1', session.sessionId, { questionId: 'q-2', selectedChoice: 'A', timeSpentSec: 15, skipped: false } as never);
    expect(r2.isCorrect).toBe(false);

    // The progress system recorded everything.
    expect(h.db.attempts).toHaveLength(2);
    expect(h.db.mastery).toHaveLength(1);
    expect(h.db.xp).toHaveLength(1);
    expect(h.db.xp[0].totalXp).toBeGreaterThan(0);

    // First-correct achievement was earned.
    expect(h.db.studentAchievements.length).toBeGreaterThanOrEqual(1);

    // Dashboard reflects the activity.
    const dash = await h.dashboard.getDashboard('u-1');
    expect(dash.progress.totalAnswered).toBe(2);
    expect(dash.xp.totalXp).toBeGreaterThan(0);
    expect(dash.streak.current).toBeGreaterThanOrEqual(1);
  });

  it('mastery tier rises with repeated correct answers', async () => {
    for (let i = 0; i < 6; i++) {
      await h.practice.submitAnswer('u-1', null, { questionId: 'q-1', selectedChoice: 'A', timeSpentSec: 10, skipped: false } as never);
    }
    const mastery = h.db.mastery[0];
    expect(mastery.attempts).toBe(6);
    expect(mastery.correct).toBe(6);
    expect(mastery.accuracy).toBe(1);
    expect(['proficient', 'advanced', 'mastered']).toContain(mastery.tier);
  });

  it('detects a knowledge gap and generates a learning path from weak topics', async () => {
    // Answer the same topic wrong many times → weak topic.
    for (let i = 0; i < 6; i++) {
      await h.practice.submitAnswer('u-1', null, { questionId: 'q-1', selectedChoice: 'Z', timeSpentSec: 10, skipped: false } as never);
    }
    const path = await h.learningPath.generate('u-1');
    expect(path.steps.length).toBeGreaterThan(0);
    expect(path.steps[0].topicId).toBe('t-1');
    expect(h.db.gaps.length).toBeGreaterThan(0);
  });

  it('recommends weak-topic questions the student has not answered', async () => {
    // Make t-1 weak with q-1, leave q-2/q-3 unanswered.
    for (let i = 0; i < 6; i++) {
      await h.practice.submitAnswer('u-1', null, { questionId: 'q-1', selectedChoice: 'Z', timeSpentSec: 10, skipped: false } as never);
    }
    const recs = await h.recommendations.recommend('u-1', { limit: 5 });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.questionId !== 'q-1')).toBe(true); // excludes answered
  });
});
