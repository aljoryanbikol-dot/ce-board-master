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
import { FeatureAccessService } from '../../subscriptions/services/feature-access.service';
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
    private readonly featureAccess: FeatureAccessService,
  ) {}

  // ── Start ───────────────────────────────────────────────────────────────────
  async start(userId: string, dto: StartExamDto) {
    await this.featureAccess.enforceMockExamQuota(userId);
    const config = await this.resolveConfig(userId, dto);

    // PRC board forms carry a curated ordered question list — build from it
    // verbatim; everything else samples from the composition.
    const built = config.formQuestionCodes && config.formQuestionCodes.length > 0
      ? await this.mockExam.buildFixedForm(config.formQuestionCodes)
      : await this.mockExam.buildQuestions({ kind: dto.kind, composition: config.composition, randomizeChoices: config.randomizeChoices });

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
      include: {
        answer: true,
        question: {
          select: {
            questionCode: true, stemText: true, situationOrder: true,
            situation: { select: { id: true, publicId: true, situationText: true, givenData: true, figurePublicId: true, category: true } },
            choices: { select: { choiceLetter: true, choiceText: true } },
          },
        },
      },
    });
    const diagramsByCode = await this.diagrams.resolveMany(examQuestions.map((eq: any) => eq.question.questionCode));

    // Situational sets: number the situations in exam order and count how
    // many linked questions of each set are present in THIS exam, so the UI
    // can render "Situation N — Question X of Y" without repeating the text.
    const situationNumbers = new Map<string, number>();
    const situationCounts = new Map<string, number>();
    for (const eq of examQuestions as any[]) {
      const sit = eq.question.situation;
      if (!sit) continue;
      if (!situationNumbers.has(sit.id)) situationNumbers.set(sit.id, situationNumbers.size + 1);
      situationCounts.set(sit.id, (situationCounts.get(sit.id) ?? 0) + 1);
    }
    const figureIds = [...new Set((examQuestions as any[]).map((eq) => eq.question.situation?.figurePublicId).filter(Boolean))] as string[];
    const situationFigures = figureIds.length
      ? new Map((await this.prisma.diagram.findMany({ where: { publicId: { in: figureIds } }, select: { publicId: true, imageUrl: true, title: true, altText: true } })).map((d) => [d.publicId, d]))
      : new Map();

    const sitRunningIndex = new Map<string, number>();
    return examQuestions.map((eq: any) => {
      const choiceMap = new Map<string, string>(eq.question.choices.map((ch: any) => [ch.choiceLetter, ch.choiceText]));
      const order = eq.choiceOrder as string[];
      const choices = order.map((origLetter, i) => ({ letter: String.fromCharCode(65 + i), text: choiceMap.get(origLetter) ?? '' }));
      const sit = eq.question.situation;
      let situation = null;
      if (sit) {
        const idx = (sitRunningIndex.get(sit.id) ?? 0) + 1;
        sitRunningIndex.set(sit.id, idx);
        const fig = sit.figurePublicId ? situationFigures.get(sit.figurePublicId) ?? null : null;
        situation = {
          publicId: sit.publicId,
          number: situationNumbers.get(sit.id) ?? 1,
          text: sit.situationText,
          givenData: sit.givenData ?? null,
          category: sit.category ?? null,
          questionIndex: idx,
          questionCount: situationCounts.get(sit.id) ?? 1,
          figure: fig ? { imageUrl: fig.imageUrl, title: fig.title, altText: fig.altText } : null,
        };
      }
      return {
        examQuestionId: eq.id, position: eq.position, questionId: eq.questionId, stemText: eq.question.stemText,
        choices, state: eq.state, selectedChoice: eq.answer?.selectedChoice ?? null, isBookmarked: eq.answer?.isBookmarked ?? false,
        diagram: diagramsByCode.get(eq.question.questionCode) ?? null,
        situation,
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

  private async resolveConfig(userId: string, dto: StartExamDto): Promise<{ composition: CompositionEntry[]; durationMinutes: number; passingScore: number; randomizeChoices: boolean; templateId?: string; title: string; formQuestionCodes?: string[] }> {
    if (dto.templateId) {
      const t = await this.mockExam.getTemplate(dto.templateId);
      if (!t.isActive) throw ExamErrors.templateInactive(dto.templateId);
      // PRC board form: explicit ordered question list from the Content SDK.
      let formQuestionCodes = Array.isArray((t as { formQuestionCodes?: unknown }).formQuestionCodes)
        ? ((t as { formQuestionCodes: string[] }).formQuestionCodes)
        : undefined;
      let durationMinutes = t.durationMinutes;
      let title = t.name;
      // Optional single-day slice: formStructure sessions are ordered the same
      // way as formQuestionCodes, so a day is a contiguous prefix/suffix.
      const structure = (t as { formStructure?: Array<{ day?: string; session_items?: number; session_time_min?: number }> }).formStructure;
      if (dto.boardDay && formQuestionCodes && Array.isArray(structure) && structure.length > 0) {
        const isDay1 = (s: { day?: string }) => /1/.test(s.day ?? '');
        const day1Sessions = structure.filter(isDay1);
        const day2Sessions = structure.filter((s) => !isDay1(s));
        const day1Count = day1Sessions.reduce((n, s) => n + (s.session_items ?? 0), 0);
        const pick = dto.boardDay === 'day1' ? day1Sessions : day2Sessions;
        if (pick.length > 0 && day1Count > 0 && day1Count < formQuestionCodes.length) {
          formQuestionCodes = dto.boardDay === 'day1'
            ? formQuestionCodes.slice(0, day1Count)
            : formQuestionCodes.slice(day1Count);
          const minutes = pick.reduce((n, s) => n + (s.session_time_min ?? 0), 0);
          durationMinutes = minutes > 0 ? Math.min(minutes, EXAM_LIMITS.MAX_DURATION_MIN) : Math.round(t.durationMinutes * (formQuestionCodes.length / ((t as { formQuestionCodes: string[] }).formQuestionCodes.length || 1)));
          title = `${t.name} — ${dto.boardDay === 'day1' ? 'Day 1 (MSTE)' : 'Day 2 (PSSEC + HGE)'}`;
        }
      }
      return { composition: t.composition as unknown as CompositionEntry[], durationMinutes, passingScore: t.passingScore, randomizeChoices: t.randomizeChoices, templateId: t.id, title, formQuestionCodes };
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
