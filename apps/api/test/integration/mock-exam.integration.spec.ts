/**
 * @file mock-exam.integration.spec.ts
 * @module Exams/Integration
 *
 * Wires the REAL exam services together (ExamTimerService, ExamScoringService,
 * MockExamService, ExamResultService, ExamSessionService, ExamReviewService,
 * ExamAnalyticsService) plus the real ProgressTrackingService from the Student
 * Learning Platform, over an in-memory persistence double. Exercises the full
 * flow: build → begin → autosave answers → submit → score → result, plus resume,
 * review (incorrect), and weakness analysis. Verifies the exam→student bridge.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ExamTimerService } from '../../src/exams/services/exam-timer.service';
import { ExamScoringService } from '../../src/exams/services/exam-scoring.service';
import { MockExamService } from '../../src/exams/services/mock-exam.service';
import { ExamResultService } from '../../src/exams/services/exam-result.service';
import { ExamSessionService } from '../../src/exams/services/exam-session.service';
import { ExamReviewService } from '../../src/exams/services/exam-review.service';
import { ExamAnalyticsService } from '../../src/exams/services/exam-analytics.service';
import { ProgressTrackingService } from '../../src/student/services/progress-tracking.service';

function makeInMemoryPrisma() {
  const db = {
    questions: [] as any[],
    subjects: [{ id: 's-1', prcWeightPercent: 100, isActive: true }] as any[],
    exams: [] as any[],
    examQuestions: [] as any[],
    examAnswers: [] as any[],
    results: [] as any[],
    subjectScores: [] as any[],
    topicScores: [] as any[],
    mastery: [] as any[],
    streaks: [] as any[],
    xp: [] as any[],
    gaps: [] as any[],
  };
  // 10 published questions, correct answer always 'A'.
  for (let i = 0; i < 10; i++) {
    db.questions.push({
      id: `q-${i}`, subjectId: 's-1', topicId: `t-${i % 2}`, difficultyLevelId: 'd-1', learningObjective: 'LO-1',
      correctChoice: 'A', questionStatus: 'published', deletedAt: null, stemText: `Q${i}?`, explanationText: 'Because.',
      choices: [{ choiceLetter: 'A', choiceText: 'a', sortOrder: 0 }, { choiceLetter: 'B', choiceText: 'b', sortOrder: 1 }, { choiceLetter: 'C', choiceText: 'c', sortOrder: 2 }, { choiceLetter: 'D', choiceText: 'd', sortOrder: 3 }],
    });
  }
  let seq = 0;
  const uid = (p: string) => `${p}-${++seq}`;

  const prisma: any = {
    $transaction: async (fn: any) => fn(prisma),
    question: {
      findMany: async ({ where, select }: any) => db.questions
        .filter((q) => q.questionStatus === 'published' && q.deletedAt === null && (!where?.subjectId || q.subjectId === where.subjectId))
        .map((q) => ({ ...q, choices: q.choices.map((ch: any) => ({ choiceLetter: ch.choiceLetter, choiceText: ch.choiceText })) })),
    },
    subject: { findMany: async () => db.subjects },
    mockExam: {
      create: async ({ data }: any) => { const e = { id: uid('ex'), ...data, elapsedSeconds: data.elapsedSeconds ?? 0, answeredCount: 0, startedAt: null, expiresAt: null, pausedAt: null, submittedAt: null, lastActivityAt: null }; db.exams.push(e); return e; },
      findUnique: async ({ where }: any) => db.exams.find((e) => e.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: any) => db.exams.find((e) => e.id === where.id),
      findFirst: async ({ where }: any) => db.exams.filter((e) => e.userId === where.userId && (!where.status?.in || where.status.in.includes(e.status))).slice(-1)[0] ?? null,
      update: async ({ where, data }: any) => { const e = db.exams.find((x) => x.id === where.id); Object.assign(e, data, data.answeredCount?.increment ? { answeredCount: e.answeredCount + data.answeredCount.increment } : {}, data.answeredCount?.decrement ? { answeredCount: e.answeredCount - data.answeredCount.decrement } : {}); return e; },
    },
    examQuestion: {
      createMany: async ({ data }: any) => { for (const d of data) db.examQuestions.push({ id: uid('eq'), state: 'unanswered', ...d }); return { count: data.length }; },
      findMany: async ({ where, include }: any) => db.examQuestions.filter((eq) => eq.examId === where.examId).sort((a, b) => a.position - b.position).map((eq) => ({
        ...eq,
        answer: include?.answer ? db.examAnswers.find((a) => a.examQuestionId === eq.id) ?? null : undefined,
        question: include?.question ? db.questions.find((q) => q.id === eq.questionId) : undefined,
      })),
      findFirst: async ({ where }: any) => db.examQuestions.find((eq) => eq.id === where.id && eq.examId === where.examId) ?? null,
      update: async ({ where, data }: any) => { const eq = db.examQuestions.find((x) => x.id === where.id); Object.assign(eq, data); return eq; },
    },
    examAnswer: {
      findUnique: async ({ where }: any) => db.examAnswers.find((a) => a.examQuestionId === where.examQuestionId) ?? null,
      upsert: async ({ where, create, update }: any) => { const ex = db.examAnswers.find((a) => a.examQuestionId === where.examQuestionId); if (ex) { Object.assign(ex, update, update.timeSpentSec?.increment ? { timeSpentSec: ex.timeSpentSec + update.timeSpentSec.increment } : {}); return ex; } const a = { id: uid('ea'), isBookmarked: false, isCorrect: null, timeSpentSec: 0, ...create }; db.examAnswers.push(a); return a; },
      update: async ({ where, data }: any) => { const a = db.examAnswers.find((x) => x.id === where.id); Object.assign(a, data); return a; },
    },
    examResult: {
      findUnique: async ({ where, include }: any) => { const r = db.results.find((r) => (where.examId && r.examId === where.examId) || (where.resultCode && r.resultCode === where.resultCode) || (where.id && r.id === where.id)) ?? null; if (r && include) return { ...r, subjectScores: db.subjectScores.filter((s) => s.resultId === r.id), topicScores: db.topicScores.filter((t) => t.resultId === r.id), exam: db.exams.find((e) => e.id === r.examId) }; return r; },
      findUniqueOrThrow: async ({ where }: any) => { const r = db.results.find((x) => x.id === where.id); return { ...r, subjectScores: db.subjectScores.filter((s) => s.resultId === r.id), topicScores: db.topicScores.filter((t) => t.resultId === r.id) }; },
      create: async ({ data }: any) => {
        const r = { id: uid('res'), ...data, computedAt: new Date(), percentile: null };
        db.results.push(r);
        if (data.subjectScores?.create) for (const s of data.subjectScores.create) db.subjectScores.push({ id: uid('ss'), resultId: r.id, ...s });
        if (data.topicScores?.create) for (const t of data.topicScores.create) db.topicScores.push({ id: uid('ts'), resultId: r.id, ...t });
        return r;
      },
      findMany: async ({ where }: any) => db.results.filter((r) => r.userId === where.userId),
    },
    // ProgressTrackingService deps:
    topicMastery: {
      findUnique: async ({ where }: any) => db.mastery.find((m) => m.userId === where.userId_topicId.userId && m.topicId === where.userId_topicId.topicId) ?? null,
      upsert: async ({ where, create, update }: any) => { const ex = db.mastery.find((m) => m.userId === where.userId_topicId.userId && m.topicId === where.userId_topicId.topicId); if (ex) { Object.assign(ex, update); return ex; } const m = { id: uid('tm'), ...create }; db.mastery.push(m); return m; },
      findMany: async ({ where }: any) => db.mastery.filter((m) => m.userId === where.userId),
      count: async ({ where }: any) => db.mastery.filter((m) => m.userId === where.userId && (where.tier === undefined || m.tier === where.tier)).length,
    },
    studyStreakDay: { findUnique: async () => null, upsert: async ({ create }: any) => { const s = { id: uid('sd'), ...create }; db.streaks.push(s); return s; } },
    studentXp: { findUnique: async ({ where }: any) => db.xp.find((x) => x.userId === where.userId) ?? null, upsert: async ({ where, create }: any) => { const ex = db.xp.find((x) => x.userId === where.userId); if (ex) return ex; const x = { id: uid('xp'), userId: where.userId, currentStreak: 0, longestStreak: 0, ...create }; db.xp.push(x); return x; } },
    knowledgeGap: { findMany: async () => [], upsert: async () => ({}), updateMany: async () => ({}) },
  };
  return { prisma, db };
}

function harness() {
  const { prisma, db } = makeInMemoryPrisma();
  const cache = { del: async () => {}, remember: async (_k: string, _t: number, fn: () => unknown) => fn() };
  const events = { emit: () => {} };
  const timer = new ExamTimerService();
  const scoring = new ExamScoringService();
  const mockExam = new MockExamService(prisma as never);
  const progress = new ProgressTrackingService(prisma as never, events as never);
  const result = new ExamResultService(prisma as never, cache as never, scoring, progress, events as never);
  const session = new ExamSessionService(prisma as never, cache as never, mockExam, timer, result, events as never);
  const review = new ExamReviewService(prisma as never);
  const analytics = new ExamAnalyticsService(prisma as never);
  return { prisma, db, timer, scoring, mockExam, progress, result, session, review, analytics };
}

describe('Mock exam — integration (real services)', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  it('full flow: build → begin → answer → submit → score → result', async () => {
    const start = await h.session.start('u-1', { kind: 'subject', subjectId: 's-1', totalQuestions: 10, durationMinutes: 60 } as never);
    expect(start.totalQuestions).toBe(10);
    expect(h.db.examQuestions).toHaveLength(10);

    await h.session.begin('u-1', start.examId);
    const presented = await h.session.getQuestions('u-1', start.examId);
    expect(presented).toHaveLength(10);

    // Answer the first 6 correctly (find presented letter mapping to original 'A').
    for (let i = 0; i < 6; i++) {
      const q = presented[i]!;
      const correctPresented = q.choices.find((ch) => ch.letter)!; // need the presented letter whose original is 'A'
      // Determine presented letter for original 'A' via the stored choiceOrder.
      const eq = h.db.examQuestions.find((e) => e.id === q.examQuestionId)!;
      const idx = (eq.choiceOrder as string[]).indexOf('A');
      const presentedLetter = String.fromCharCode(65 + idx);
      await h.session.saveAnswer('u-1', start.examId, { examQuestionId: q.examQuestionId, selectedChoice: presentedLetter, timeSpentSec: 20 } as never);
    }
    // Answer next 4 incorrectly (pick a presented letter mapping to 'B').
    for (let i = 6; i < 10; i++) {
      const q = presented[i]!;
      const eq = h.db.examQuestions.find((e) => e.id === q.examQuestionId)!;
      const idx = (eq.choiceOrder as string[]).indexOf('B');
      await h.session.saveAnswer('u-1', start.examId, { examQuestionId: q.examQuestionId, selectedChoice: String.fromCharCode(65 + idx), timeSpentSec: 15 } as never);
    }

    const result = await h.session.submit('u-1', start.examId);
    expect(result.breakdown.correctCount).toBe(6);
    expect(result.scorePercent).toBe(60);
    expect(result.resultCode).toMatch(/^CEBM-EX-/);

    // Exam→student bridge: topic mastery advanced.
    expect(h.db.mastery.length).toBeGreaterThan(0);
  });

  it('resume returns an in-progress exam', async () => {
    const start = await h.session.start('u-1', { kind: 'subject', subjectId: 's-1', totalQuestions: 10, durationMinutes: 60 } as never);
    await h.session.begin('u-1', start.examId);
    const resumed = await h.session.resumeInterrupted('u-1');
    expect(resumed?.examId).toBe(start.examId);
    expect(resumed?.status).toBe('in_progress');
  });

  it('review surfaces incorrect answers after submit', async () => {
    const start = await h.session.start('u-1', { kind: 'subject', subjectId: 's-1', totalQuestions: 10, durationMinutes: 60 } as never);
    await h.session.begin('u-1', start.examId);
    const presented = await h.session.getQuestions('u-1', start.examId);
    // Answer everything incorrectly (original 'B').
    for (const q of presented) {
      const eq = h.db.examQuestions.find((e) => e.id === q.examQuestionId)!;
      const idx = (eq.choiceOrder as string[]).indexOf('B');
      await h.session.saveAnswer('u-1', start.examId, { examQuestionId: q.examQuestionId, selectedChoice: String.fromCharCode(65 + idx), timeSpentSec: 10 } as never);
    }
    await h.session.submit('u-1', start.examId);
    const review = await h.review.review('u-1', start.examId, { filter: 'incorrect' } as never);
    expect(review.count).toBe(10);
    expect(review.items[0]!.explanation).toBe('Because.');
  });

  it('weakness analysis flags low-scoring topics', async () => {
    const start = await h.session.start('u-1', { kind: 'subject', subjectId: 's-1', totalQuestions: 10, durationMinutes: 60 } as never);
    await h.session.begin('u-1', start.examId);
    const presented = await h.session.getQuestions('u-1', start.examId);
    for (const q of presented) {
      const eq = h.db.examQuestions.find((e) => e.id === q.examQuestionId)!;
      const idx = (eq.choiceOrder as string[]).indexOf('B'); // all wrong
      await h.session.saveAnswer('u-1', start.examId, { examQuestionId: q.examQuestionId, selectedChoice: String.fromCharCode(65 + idx), timeSpentSec: 10 } as never);
    }
    await h.session.submit('u-1', start.examId);
    const ws = await h.analytics.weaknessStrength('u-1', start.examId);
    expect(ws!.weaknesses.length).toBeGreaterThan(0);
  });
});
