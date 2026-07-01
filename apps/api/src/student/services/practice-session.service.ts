/**
 * @file practice-session.service.ts
 * @module Student/Services
 *
 * PracticeSessionService — orchestrates the practice loop: start a session in a
 * chosen mode (subject/topic/LO/blueprint/difficulty/recommended), serve
 * published questions, and record each answer. Submitting an answer is the hub
 * that drives the whole progress system in one transaction: persist the attempt,
 * update topic mastery, extend the streak, award XP, and evaluate achievements.
 *
 * Ownership is enforced on every session/answer. Only PUBLISHED questions are
 * served and gradeable. Reuses the Question Bank (read-only) and delegates all
 * progress math to ProgressTrackingService + AchievementService (no duplicated
 * business logic).
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { ProgressTrackingService } from './progress-tracking.service';
import { AchievementService } from './achievement.service';
import { QuestionRecommendationService } from './question-recommendation.service';
import { QuestionDiagramLookupService } from '../../questions/services/question-diagram-lookup.service';
import { StudentErrors } from '../errors/student.errors';
import { EVENTS, CACHE_KEYS } from '../../common/constants';
import { XP_RULES, PRACTICE_LIMITS } from '../constants/student.constants';
import type { StartPracticeDto, SubmitAnswerDto } from '../dto/student.dto';
import type { AnswerResult } from '../types/student.types';

@Injectable()
export class PracticeSessionService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly progress: ProgressTrackingService,
    private readonly achievements: AchievementService,
    private readonly recommendations: QuestionRecommendationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly diagrams: QuestionDiagramLookupService,
  ) {}

  // ── Session lifecycle ─────────────────────────────────────────────────────────

  async start(userId: string, dto: StartPracticeDto) {
    const questionIds = await this.selectQuestionIds(userId, dto);
    if (questionIds.length === 0) throw StudentErrors.invalidPracticeTarget('No published questions match the chosen practice target.');

    const session = await this.prisma.practiceSession.create({
      data: {
        userId, mode: dto.mode as never, status: 'active',
        subjectId: dto.subjectId ?? null, topicId: dto.topicId ?? null, subtopicId: dto.subtopicId ?? null,
        learningObjectiveId: dto.learningObjectiveId ?? null, blueprintId: dto.blueprintId ?? null, difficultyLevelId: dto.difficultyLevelId ?? null,
        targetCount: Math.min(dto.targetCount, questionIds.length),
      },
    });
    this.eventEmitter.emit(EVENTS.STUDENT_SESSION_STARTED, { userId, sessionId: session.id, mode: dto.mode });
    await this.cache.del(CACHE_KEYS.student.dashboard(userId));

    // Return the question content the client renders (stem + choices ONLY —
    // never the correct answer or explanation, which are revealed per-question
    // after the student submits via /answers).
    const selectedIds = questionIds.slice(0, session.targetCount);
    const rows = await this.prisma.question.findMany({
      where: { id: { in: selectedIds } },
      select: {
        id: true,
        questionCode: true,
        stemText: true,
        choices: {
          select: { choiceLetter: true, choiceText: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    const diagramsByCode = await this.diagrams.resolveMany(rows.map((r) => r.questionCode));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const questions = selectedIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        questionId: r.id,
        stemText: r.stemText,
        choices: r.choices.map((c) => ({ key: c.choiceLetter, text: c.choiceText })),
        diagram: diagramsByCode.get(r.questionCode) ?? null,
      }));

    return { sessionId: session.id, mode: session.mode, targetCount: session.targetCount, questionIds: selectedIds, questions };
  }

  /** Subjects that currently have at least one published question (for the "by subject" picker). */
  async listSubjects() {
    return this.prisma.subject.findMany({
      where: { questions: { some: { questionStatus: 'published', deletedAt: null } } },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw StudentErrors.sessionNotFound(sessionId);
    if (session.userId !== userId) throw StudentErrors.sessionForbidden();
    return session;
  }

  async complete(userId: string, sessionId: string) {
    const session = await this.getSession(userId, sessionId);
    if (session.status !== 'active') throw StudentErrors.sessionNotActive(session.status);
    const updated = await this.prisma.practiceSession.update({ where: { id: sessionId }, data: { status: 'completed', completedAt: new Date() } });
    await this.achievements.awardXp(userId, { sessionCompleted: XP_RULES.SESSION_COMPLETED });
    this.eventEmitter.emit(EVENTS.STUDENT_SESSION_COMPLETED, { userId, sessionId, answered: updated.answeredCount, correct: updated.correctCount });
    await this.cache.del(CACHE_KEYS.student.dashboard(userId));
    return { sessionId, status: updated.status, answeredCount: updated.answeredCount, correctCount: updated.correctCount, accuracy: updated.answeredCount ? updated.correctCount / updated.answeredCount : 0 };
  }

  // ── The answer hub ──────────────────────────────────────────────────────────

  async submitAnswer(userId: string, sessionId: string | null, dto: SubmitAnswerDto): Promise<AnswerResult> {
    // Load the question (must be published).
    const question = await this.prisma.question.findFirst({
      where: { id: dto.questionId, deletedAt: null },
      select: { id: true, correctChoice: true, explanationText: true, questionStatus: true, subjectId: true, topicId: true, subtopicId: true, difficultyLevelId: true, bloomLevel: true },
    });
    if (!question) throw StudentErrors.questionNotFound(dto.questionId);
    if (question.questionStatus !== 'published') throw StudentErrors.questionNotAvailable(dto.questionId);

    // Validate session ownership if provided.
    let session = null as Awaited<ReturnType<typeof this.prisma.practiceSession.findUnique>> | null;
    if (sessionId) {
      session = await this.prisma.practiceSession.findUnique({ where: { id: sessionId } });
      if (!session) throw StudentErrors.sessionNotFound(sessionId);
      if (session.userId !== userId) throw StudentErrors.sessionForbidden();
      if (session.status !== 'active') throw StudentErrors.sessionNotActive(session.status);
    }

    const skipped = dto.skipped || !dto.selectedChoice;
    const isCorrect = !skipped && dto.selectedChoice === question.correctChoice;
    const outcome = skipped ? 'skipped' : isCorrect ? 'correct' : 'incorrect';

    // Is this the student's first attempt at this question?
    const priorAttempts = await this.prisma.questionAttempt.count({ where: { userId, questionId: question.id } });
    const isFirstAttempt = priorAttempts === 0;

    const xpState = await this.prisma.studentXp.findUnique({ where: { userId }, select: { currentStreak: true } });
    const currentStreak = xpState?.currentStreak ?? 0;

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const attempt = await tx.questionAttempt.create({
        data: {
          userId, questionId: question.id, sessionId: sessionId ?? null,
          subjectId: question.subjectId, topicId: question.topicId, subtopicId: question.subtopicId, difficultyLevelId: question.difficultyLevelId,
          selectedChoice: dto.selectedChoice ?? null, outcome: outcome as never, isCorrect, timeSpentSec: dto.timeSpentSec, bloomLevel: question.bloomLevel,
        },
      });

      // Update mastery (only when the question has a topic and wasn't skipped-without-data).
      let mastery = null;
      if (question.topicId && !skipped) {
        mastery = await this.progress.updateTopicMastery(userId, { subjectId: question.subjectId, topicId: question.topicId, isCorrect, timeSpentSec: dto.timeSpentSec }, tx);
      }

      // Streak + daily activity.
      const minutes = Math.round(dto.timeSpentSec / 60);
      await this.progress.recordDailyActivity(userId, { questionsAnswered: 1, minutesStudied: minutes, goalMet: false }, tx);

      // XP.
      const breakdown = this.achievements.answerXpBreakdown(isCorrect, isFirstAttempt, currentStreak);
      const xp = await this.achievements.awardXp(userId, breakdown, tx);

      // Session counters.
      let sessionProgress: AnswerResult['sessionProgress'];
      if (session) {
        const answeredCount = session.answeredCount + 1;
        const correctCount = session.correctCount + (isCorrect ? 1 : 0);
        const completed = answeredCount >= session.targetCount;
        await tx.practiceSession.update({
          where: { id: session.id },
          data: { answeredCount, correctCount, totalTimeSec: { increment: dto.timeSpentSec }, ...(completed && { status: 'completed', completedAt: new Date() }) },
        });
        sessionProgress = { answeredCount, correctCount, targetCount: session.targetCount, completed };
      }

      return { attempt, mastery, xp, sessionProgress };
    });

    // Post-commit: evaluate achievements against fresh stats (outside the tx).
    const newAchievements = await this.evaluateAchievementsFor(userId);

    if (result.xp.leveledUp) this.eventEmitter.emit(EVENTS.STUDENT_LEVEL_UP, { userId, level: result.xp.level });
    this.eventEmitter.emit(EVENTS.STUDENT_QUESTION_ANSWERED, { userId, questionId: question.id, isCorrect, outcome });
    await this.cache.del(CACHE_KEYS.student.dashboard(userId));
    await this.cache.del(CACHE_KEYS.student.progress(userId));

    return {
      attemptId: result.attempt.id, isCorrect, correct: isCorrect,
      correctChoice: question.correctChoice, explanationText: question.explanationText, outcome,
      xp: result.xp, mastery: result.mastery, newAchievements, sessionProgress: result.sessionProgress,
    };
  }

  // ── Question selection per mode ─────────────────────────────────────────────────

  private async selectQuestionIds(userId: string, dto: StartPracticeDto): Promise<string[]> {
    const take = Math.min(dto.targetCount * 2, PRACTICE_LIMITS.MAX_QUESTIONS * 2);

    if (dto.mode === 'recommended') {
      const recs = await this.recommendations.recommend(userId, { limit: dto.targetCount });
      return recs.map((r) => r.questionId);
    }

    const where: Prisma.QuestionWhereInput = { deletedAt: null, questionStatus: 'published' };
    if (dto.mode === 'subject' && dto.subjectId) where.subjectId = dto.subjectId;
    if (dto.mode === 'topic' && dto.topicId) where.topicId = dto.topicId;
    if (dto.mode === 'difficulty' && dto.difficultyLevelId) where.difficultyLevelId = dto.difficultyLevelId;
    if (dto.subtopicId) where.subtopicId = dto.subtopicId;
    if (dto.mode === 'learning_objective' && dto.learningObjectiveId) where.learningObjective = { contains: dto.learningObjectiveId, mode: 'insensitive' };
    // 'blueprint' and 'mixed' fall through to a broad published pool (blueprint linkage lives in AI metadata).

    const rows = await this.prisma.question.findMany({ where, select: { id: true }, take, orderBy: { createdAt: 'desc' } });
    return rows.map((r: { id: string }) => r.id);
  }

  private async evaluateAchievementsFor(userId: string) {
    const [agg, mastered, fast] = await Promise.all([
      this.prisma.questionAttempt.aggregate({ where: { userId }, _count: { _all: true } }),
      this.prisma.topicMastery.count({ where: { userId, tier: 'mastered' } }),
      this.prisma.questionAttempt.count({ where: { userId, isCorrect: true, timeSpentSec: { lte: 30, gt: 0 } } }),
    ]);
    const totalCorrect = await this.prisma.questionAttempt.count({ where: { userId, isCorrect: true } });
    const xp = await this.prisma.studentXp.findUnique({ where: { userId }, select: { currentStreak: true } });
    return this.achievements.evaluateAchievements(userId, {
      totalAnswered: agg._count._all, totalCorrect, currentStreak: xp?.currentStreak ?? 0, topicsMastered: mastered, fastAnswers: fast,
    });
  }

  // ── History reads ───────────────────────────────────────────────────────────

  async listSessions(userId: string, limit: number, cursor?: string) {
    const rows = await this.prisma.practiceSession.findMany({
      where: { userId }, orderBy: { startedAt: 'desc' }, take: limit + 1, ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { data: page, pagination: { cursor: hasMore ? page[page.length - 1]!.id : null, hasMore } };
  }
}
