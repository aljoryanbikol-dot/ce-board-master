/**
 * @file exam-session.service.ts
 * @module Exams/Services
 *
 * ExamSessionService — the exam session hub. Owns the full lifecycle of a mock
 * exam attempt: start (build + persist questions), serve the presented exam
 * (randomized choices), autosave answers, flag/bookmark, pause/resume, and
 * submit (manual or auto on expiry). Timing is delegated to ExamTimerService,
 * construction to MockExamService, and scoring to ExamResultService — this
 * service holds no duplicated business logic, only orchestration + ownership.
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { MockExamService } from './mock-exam.service';
import { ExamTimerService } from './exam-timer.service';
import { ExamResultService } from './exam-result.service';
import { QuestionDiagramLookupService } from '../../questions/services/question-diagram-lookup.service';
import { ExamErrors } from '../errors/exam.errors';
import { EVENTS, CACHE_KEYS } from '../../common/constants';
import { EXAM_LIMITS } from '../constants/exam.constants';
import type { StartExamDto, SaveAnswerDto } from '../dto/exam.dto';
import type { CompositionEntry, PresentedQuestion } from '../types/exam.types';

@Injectable()
export class ExamSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly mockExam: MockExamService,
    private readonly timer: ExamTimerService,
    private readonly result: ExamResultService,
    private readonly eventEmitter: EventEmitter2,
    private readonly diagrams: QuestionDiagramLookupService,
  ) {}

  // ── Start ───────────────────────────────────────────────────────────────────
  async start(userId: string, dto: StartExamDto) {
    const config = await this.resolveConfig(userId, dto);

    const built = await this.mockExam.buildQuestions({ kind: dto.kind, composition: config.composition, randomizeChoices: config.randomizeChoices });

    const exam = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.mockExam.create({
        data: {
          userId, templateId: config.templateId ?? null, kind: dto.kind as never,
          title: dto.title ?? config.title, status: 'created',
          totalQuestions: built.length, durationMinutes: config.durationMinutes, passingScore: config.passingScore,
          randomizeChoices: config.randomizeChoices,
        },
      });
      await tx.examQuestion.createMany({
        data: built.map((q) => ({
          examId: created.id, questionId: q.questionId, userId, position: q.position,
          subjectId: q.subjectId, topicId: q.topicId, difficultyLevelId: q.difficultyLevelId, learningObjective: q.learningObjective,
          choiceOrder: q.choiceOrder as unknown as Prisma.InputJsonValue, correctChoice: q.correctChoice,
        })),
      });
      return created;
    });

    this.eventEmitter.emit(EVENTS.EXAM_CREATED, { userId, examId: exam.id, kind: dto.kind, totalQuestions: built.length });
    return { examId: exam.id, status: exam.status, totalQuestions: exam.totalQuestions, durationMinutes: exam.durationMinutes };
  }

  /** Begin the timer (transition created → in_progress). */
  async begin(userId: string, examId: string) {
    const exam = await this.ownedExam(userId, examId);
    if (exam.status === 'in_progress') throw ExamErrors.examAlreadyStarted();
    if (exam.status === 'submitted' || exam.status === 'expired') throw ExamErrors.examAlreadySubmitted();

    const now = new Date();
    const expiresAt = this.timer.computeExpiry(now, exam.durationMinutes);
    const updated = await this.prisma.mockExam.update({
      where: { id: examId },
      data: { status: 'in_progress', startedAt: now, expiresAt, lastActivityAt: now },
    });
    this.eventEmitter.emit(EVENTS.EXAM_STARTED, { userId, examId });
    return { examId, ...this.timer.computeState(updated, now) };
  }

  // ── Read presented exam ───────────────────────────────────────────────────────
  async getExam(userId: string, examId: string) {
    const exam = await this.ownedExam(userId, examId);
    await this.autoExpireIfNeeded(userId, exam);
    const fresh = await this.prisma.mockExam.findUniqueOrThrow({ where: { id: examId } });
    const timer = this.timer.computeState(fresh);
    return { examId, status: fresh.status, title: fresh.title, kind: fresh.kind, totalQuestions: fresh.totalQuestions, answeredCount: fresh.answeredCount, passingScore: fresh.passingScore, timer };
  }

  async getQuestions(userId: string, examId: string): Promise<PresentedQuestion[]> {
    await this.ownedExam(userId, examId);
    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId }, orderBy: { position: 'asc' },
      include: { answer: true, question: { select: { questionCode: true, stemText: true, choices: { select: { choiceLetter: true, choiceText: true } } } } },
    });
    const diagramsByCode = await this.diagrams.resolveMany(examQuestions.map((eq: any) => eq.question.questionCode));
    return examQuestions.map((eq: any) => {
      const choiceMap = new Map<string, string>(eq.question.choices.map((ch: any) => [ch.choiceLetter, ch.choiceText]));
      const order = eq.choiceOrder as string[];
      const choices = order.map((origLetter, i) => ({ letter: String.fromCharCode(65 + i), text: choiceMap.get(origLetter) ?? '' }));
      return {
        examQuestionId: eq.id, position: eq.position, questionId: eq.questionId, stemText: eq.question.stemText,
        choices, state: eq.state, selectedChoice: eq.answer?.selectedChoice ?? null, isBookmarked: eq.answer?.isBookmarked ?? false,
        diagram: diagramsByCode.get(eq.question.questionCode) ?? null,
      };
    });
  }

  // ── Autosave answer ───────────────────────────────────────────────────────────
  async saveAnswer(userId: string, examId: string, dto: SaveAnswerDto) {
    const exam = await this.ownedExam(userId, examId);
    if (exam.status !== 'in_progress') throw ExamErrors.examNotInProgress(exam.status);
    if (this.timer.isExpired(exam.expiresAt)) { await this.autoSubmit(userId, exam); throw ExamErrors.examExpired(); }

    const eq = await this.prisma.examQuestion.findFirst({ where: { id: dto.examQuestionId, examId } });
    if (!eq) throw ExamErrors.examQuestionNotFound(dto.examQuestionId);

    const presented = dto.selectedChoice ?? null;
    if (presented) {
      const order = eq.choiceOrder as string[];
      if (presented.charCodeAt(0) - 65 >= order.length) throw ExamErrors.invalidChoice(presented);
    }
    const state = dto.flagged ? 'flagged' : presented ? 'answered' : 'skipped';

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.examAnswer.findUnique({ where: { examQuestionId: dto.examQuestionId } });
      const wasAnswered = !!existing?.selectedChoice;
      await tx.examAnswer.upsert({
        where: { examQuestionId: dto.examQuestionId },
        create: { examQuestionId: dto.examQuestionId, examId, userId, selectedChoice: presented, timeSpentSec: dto.timeSpentSec },
        update: { selectedChoice: presented, timeSpentSec: { increment: dto.timeSpentSec } },
      });
      await tx.examQuestion.update({ where: { id: dto.examQuestionId }, data: { state: state as never } });
      const nowAnswered = !!presented;
      if (nowAnswered && !wasAnswered) await tx.mockExam.update({ where: { id: examId }, data: { answeredCount: { increment: 1 }, lastActivityAt: new Date() } });
      else if (!nowAnswered && wasAnswered) await tx.mockExam.update({ where: { id: examId }, data: { answeredCount: { decrement: 1 }, lastActivityAt: new Date() } });
      else await tx.mockExam.update({ where: { id: examId }, data: { lastActivityAt: new Date() } });
    });

    this.eventEmitter.emit(EVENTS.EXAM_ANSWER_SAVED, { userId, examId, examQuestionId: dto.examQuestionId });
    await this.cache.del(CACHE_KEYS.exam.state(examId));
    return { saved: true, state };
  }

  async bookmark(userId: string, examId: string, examQuestionId: string, bookmarked: boolean) {
    await this.ownedExam(userId, examId);
    const eq = await this.prisma.examQuestion.findFirst({ where: { id: examQuestionId, examId } });
    if (!eq) throw ExamErrors.examQuestionNotFound(examQuestionId);
    await this.prisma.examAnswer.upsert({
      where: { examQuestionId },
      create: { examQuestionId, examId, userId, isBookmarked: bookmarked },
      update: { isBookmarked: bookmarked },
    });
    return { examQuestionId, bookmarked };
  }

  // ── Pause / resume ────────────────────────────────────────────────────────────
  async pause(userId: string, examId: string) {
    const exam = await this.ownedExam(userId, examId);
    if (exam.status !== 'in_progress') throw ExamErrors.examNotInProgress(exam.status);
    const now = new Date();
    const elapsed = this.timer.liveElapsed(exam, now);
    const updated = await this.prisma.mockExam.update({ where: { id: examId }, data: { status: 'paused', pausedAt: now, elapsedSeconds: elapsed, startedAt: null } });
    this.eventEmitter.emit(EVENTS.EXAM_PAUSED, { userId, examId });
    return { examId, status: updated.status, elapsedSeconds: elapsed };
  }

  async resume(userId: string, examId: string) {
    const exam = await this.ownedExam(userId, examId);
    if (exam.status !== 'paused') throw ExamErrors.examNotPaused();
    const now = new Date();
    // Recompute expiry from remaining time.
    const remainingSec = Math.max(0, exam.durationMinutes * 60 - exam.elapsedSeconds);
    const expiresAt = new Date(now.getTime() + remainingSec * 1000);
    const updated = await this.prisma.mockExam.update({ where: { id: examId }, data: { status: 'in_progress', startedAt: now, pausedAt: null, expiresAt, lastActivityAt: now } });
    this.eventEmitter.emit(EVENTS.EXAM_RESUMED, { userId, examId });
    return { examId, ...this.timer.computeState(updated, now) };
  }

  /** Resume an interrupted exam: returns whatever in-progress/paused exam exists. */
  async resumeInterrupted(userId: string) {
    const exam = await this.prisma.mockExam.findFirst({ where: { userId, status: { in: ['in_progress', 'paused'] } }, orderBy: { lastActivityAt: 'desc' } });
    if (!exam) return null;
    await this.autoExpireIfNeeded(userId, exam);
    const fresh = await this.prisma.mockExam.findUnique({ where: { id: exam.id } });
    if (!fresh || fresh.status === 'submitted' || fresh.status === 'expired') return null;
    return { examId: fresh.id, status: fresh.status, timer: this.timer.computeState(fresh) };
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async submit(userId: string, examId: string) {
    const exam = await this.ownedExam(userId, examId);
    if (exam.status === 'submitted' || exam.status === 'expired') throw ExamErrors.examAlreadySubmitted();
    if (exam.status !== 'in_progress' && exam.status !== 'paused') throw ExamErrors.examNotInProgress(exam.status);
    return this.finalize(userId, exam, 'submitted', EVENTS.EXAM_SUBMITTED);
  }

  // ── internal ──────────────────────────────────────────────────────────────────
  private async finalize(userId: string, exam: any, status: 'submitted' | 'expired', event: string) {
    const now = new Date();
    const elapsed = this.timer.liveElapsed(exam, now);
    await this.prisma.mockExam.update({ where: { id: exam.id }, data: { status, submittedAt: now, elapsedSeconds: elapsed, startedAt: null } });
    this.eventEmitter.emit(event, { userId, examId: exam.id });
    const result = await this.result.computeAndPersist(exam.id, userId, elapsed);
    await this.cache.del(CACHE_KEYS.exam.state(exam.id));
    return result;
  }

  private async autoSubmit(userId: string, exam: any) {
    if (exam.status === 'submitted' || exam.status === 'expired') return;
    this.eventEmitter.emit(EVENTS.EXAM_AUTO_SUBMITTED, { userId, examId: exam.id });
    await this.finalize(userId, exam, 'expired', EVENTS.EXAM_EXPIRED);
  }

  private async autoExpireIfNeeded(userId: string, exam: any) {
    if (exam.status === 'in_progress' && this.timer.isExpired(exam.expiresAt)) {
      await this.autoSubmit(userId, exam);
    }
  }

  private async resolveConfig(userId: string, dto: StartExamDto): Promise<{ composition: CompositionEntry[]; durationMinutes: number; passingScore: number; randomizeChoices: boolean; templateId?: string; title: string }> {
    if (dto.templateId) {
      const t = await this.mockExam.getTemplate(dto.templateId);
      if (!t.isActive) throw ExamErrors.templateInactive(dto.templateId);
      return { composition: t.composition as unknown as CompositionEntry[], durationMinutes: t.durationMinutes, passingScore: t.passingScore, randomizeChoices: t.randomizeChoices, templateId: t.id, title: t.name };
    }
    const passingScore = dto.passingScore ?? EXAM_LIMITS.DEFAULT_PASSING_SCORE;
    const durationMinutes = dto.durationMinutes ?? 180;
    const total = dto.totalQuestions ?? 100;

    if (dto.kind === 'full_board') {
      return { composition: await this.mockExam.fullBoardComposition(total), durationMinutes, passingScore, randomizeChoices: true, title: 'Full CE Board Simulation' };
    }
    if (dto.composition && dto.composition.length > 0) {
      return { composition: dto.composition, durationMinutes, passingScore, randomizeChoices: true, title: dto.title ?? 'Custom Mock Exam' };
    }
    if (dto.subjectId) {
      return { composition: this.mockExam.subjectComposition(dto.subjectId, total), durationMinutes, passingScore, randomizeChoices: true, title: 'Subject Mock Exam' };
    }
    if (dto.kind === 'adaptive') {
      return { composition: await this.mockExam.adaptiveComposition(userId, total), durationMinutes, passingScore, randomizeChoices: true, title: 'Adaptive Mock Exam' };
    }
    if (dto.kind === 'ai_generated') {
      return { composition: await this.mockExam.aiGeneratedComposition(userId, total), durationMinutes, passingScore, randomizeChoices: true, title: 'AI-Generated Mock Exam' };
    }
    // No explicit config and no recognized kind branch matched → broad subject sampling default.
    const fallback = await this.mockExam.fullBoardComposition(total);
    return { composition: fallback, durationMinutes, passingScore, randomizeChoices: true, title: 'Mock Exam' };
  }

  private async ownedExam(userId: string, examId: string) {
    const exam = await this.prisma.mockExam.findUnique({ where: { id: examId } });
    if (!exam) throw ExamErrors.examNotFound(examId);
    if (exam.userId !== userId) throw ExamErrors.examForbidden();
    return exam;
  }
}
