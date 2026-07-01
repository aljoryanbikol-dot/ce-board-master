/**
 * @file mock-exam.service.ts
 * @module Exams/Services
 *
 * MockExamService — exam construction. Resolves a composition (from a template,
 * an explicit composition, a subject, or a full-board/adaptive default) into a
 * concrete set of PUBLISHED questions, randomizes question order and (optionally)
 * choice order, and persists the MockExam + ExamQuestions. Also manages exam
 * templates (CRUD for exam.manage holders).
 *
 * Question selection reuses the frozen Question Bank (read-only, published only).
 * Randomization is deterministic-free (Math.random) per build; the choice order
 * is snapshotted so grading maps presented→original letters.
 */
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ExamErrors } from '../errors/exam.errors';
import { ADAPTIVE_RULES } from '../constants/exam.constants';
import type { CompositionEntry, BuiltExamQuestion } from '../types/exam.types';
import type { CreateTemplateDto, UpdateTemplateDto } from '../dto/exam.dto';

/** Minimum published-question inventory for a subject to be eligible for
 * difficulty-banded weighting; below this, weight it as a single flat entry
 * so buildQuestions() never gets handed an unsatisfiable per-band request. */
const MIN_POOL_FOR_DIFFICULTY_SPLIT = 8;
/** Minimum published questions for a subject to be included in adaptive weighting at all. */
const MIN_POOL_TO_INCLUDE = 1;

interface BuildRequest {
  kind: string;
  composition: CompositionEntry[];
  randomizeChoices: boolean;
}

interface PoolQuestion {
  id: string;
  subjectId: string;
  topicId: string | null;
  difficultyLevelId: string | null;
  learningObjective: string | null;
  correctChoice: string;
  choices: { choiceLetter: string }[];
}

@Injectable()
export class MockExamService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Templates ───────────────────────────────────────────────────────────────
  async createTemplate(userId: string, dto: CreateTemplateDto) {
    const totalQuestions = dto.composition.reduce((s, e) => s + e.count, 0);
    return this.prisma.examTemplate.create({
      data: {
        code: dto.code, name: dto.name, description: dto.description ?? null, kind: dto.kind as never,
        totalQuestions, durationMinutes: dto.durationMinutes, passingScore: dto.passingScore,
        randomizeQuestions: dto.randomizeQuestions, randomizeChoices: dto.randomizeChoices,
        composition: dto.composition as unknown as Prisma.InputJsonValue, createdBy: userId,
      },
    });
  }

  async listTemplates() {
    return this.prisma.examTemplate.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  }

  async getTemplate(id: string) {
    const t = await this.prisma.examTemplate.findUnique({ where: { id } });
    if (!t) throw ExamErrors.templateNotFound(id);
    return t;
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    await this.getTemplate(id);
    const data: Prisma.ExamTemplateUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.kind !== undefined) data.kind = dto.kind as never;
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
    if (dto.passingScore !== undefined) data.passingScore = dto.passingScore;
    if (dto.randomizeQuestions !== undefined) data.randomizeQuestions = dto.randomizeQuestions;
    if (dto.randomizeChoices !== undefined) data.randomizeChoices = dto.randomizeChoices;
    if (dto.composition !== undefined) {
      data.composition = dto.composition as unknown as Prisma.InputJsonValue;
      data.totalQuestions = dto.composition.reduce((s, e) => s + e.count, 0);
    }
    try {
      return await this.prisma.examTemplate.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('An exam template with that code already exists.');
      }
      throw e;
    }
  }

  /** Deactivate a template (soft delete — listTemplates only returns isActive). */
  async removeTemplate(id: string) {
    await this.getTemplate(id);
    await this.prisma.examTemplate.update({ where: { id }, data: { isActive: false } });
    return { id, deleted: true };
  }

  // ── Composition resolution ──────────────────────────────────────────────────

  /** Resolve a build request's composition into concrete, randomized questions. */
  async buildQuestions(req: BuildRequest): Promise<BuiltExamQuestion[]> {
    const built: BuiltExamQuestion[] = [];
    let position = 0;

    for (const entry of req.composition) {
      const pool = await this.prisma.question.findMany({
        where: {
          deletedAt: null, questionStatus: 'published', subjectId: entry.subjectId,
          ...(entry.difficultyLevelId && { difficultyLevelId: entry.difficultyLevelId }),
        },
        select: { id: true, subjectId: true, topicId: true, difficultyLevelId: true, learningObjective: true, correctChoice: true, choices: { select: { choiceLetter: true }, orderBy: { sortOrder: 'asc' } } },
        take: entry.count * 4, // over-fetch then sample
      }) as PoolQuestion[];
      if (pool.length < entry.count) {
        throw ExamErrors.insufficientQuestions(`Subject ${entry.subjectId}: need ${entry.count} published questions, found ${pool.length}.`);
      }
      const picked = this.sample(pool, entry.count);
      for (const q of picked) {
        const letters = q.choices.length > 0 ? q.choices.map((ch) => ch.choiceLetter) : ['A', 'B', 'C', 'D'];
        const choiceOrder = req.randomizeChoices ? this.shuffle([...letters]) : [...letters];
        built.push({
          questionId: q.id, position: position++, subjectId: q.subjectId, topicId: q.topicId,
          difficultyLevelId: q.difficultyLevelId, learningObjective: q.learningObjective,
          choiceOrder, correctChoice: q.correctChoice,
          weightPercent: entry.weightPercent ?? null,
        } as BuiltExamQuestion & { weightPercent: number | null });
      }
    }

    // Randomize the global question order (positions reassigned).
    const ordered = this.shuffle(built);
    ordered.forEach((q, i) => { q.position = i; });
    return ordered;
  }

  /** Full-board default composition: weighted by subject PRC weighting. */
  async fullBoardComposition(totalQuestions: number): Promise<CompositionEntry[]> {
    const subjects = await this.prisma.subject.findMany({ where: { isActive: true }, select: { id: true, prcWeightPercent: true } }) as { id: string; prcWeightPercent: unknown }[];
    if (subjects.length === 0) throw ExamErrors.invalidComposition('No active subjects available for a full-board exam.');

    const totalWeight = subjects.reduce((s: number, sub) => s + Number(sub.prcWeightPercent ?? 0), 0);
    return subjects.map((sub) => {
      const weight = Number(sub.prcWeightPercent ?? 0);
      const share = totalWeight > 0 ? weight / totalWeight : 1 / subjects.length;
      return { subjectId: sub.id, count: Math.max(1, Math.round(totalQuestions * share)), weightPercent: weight || undefined };
    });
  }

  /** Single-subject composition. */
  subjectComposition(subjectId: string, count: number): CompositionEntry[] {
    return [{ subjectId, count }];
  }

  /**
   * Adaptive composition: weights subjects toward the student's weak topics
   * (from TopicMastery — lower mastery gets proportionally more questions),
   * and skews difficulty per ADAPTIVE_RULES based on their recent accuracy.
   * Falls back to the full-board PRC-weighted default for a new student with
   * no mastery history yet, or if nothing in their history has enough
   * published inventory to weight against.
   */
  async adaptiveComposition(userId: string, totalQuestions: number): Promise<CompositionEntry[]> {
    const mastery = await this.prisma.topicMastery.findMany({
      where: { userId, attempts: { gt: 0 } },
      select: { subjectId: true, masteryScore: true },
    });
    if (mastery.length === 0) return this.fullBoardComposition(totalQuestions);

    const weights = await this.weaknessWeightedSubjects(mastery);
    if (weights.length === 0) return this.fullBoardComposition(totalQuestions);

    const mix = await this.recentAccuracyDifficultyMix(userId);
    const entries = await this.distributeByWeightAndDifficulty(weights, mix, totalQuestions);
    return entries.length ? entries : this.fullBoardComposition(totalQuestions);
  }

  /**
   * AI-generated composition: the same weak-area + difficulty-skew signal as
   * adaptive, plus a freshness factor that favors topics the student hasn't
   * practiced recently (spaced-repetition style) over ones just reviewed —
   * composed algorithmically today behind the same seam an LLM-backed planner
   * would sit behind later (mirrors the AI Tutor's deterministic-now,
   * AI-ready provider pattern).
   */
  async aiGeneratedComposition(userId: string, totalQuestions: number): Promise<CompositionEntry[]> {
    const mastery = await this.prisma.topicMastery.findMany({
      where: { userId, attempts: { gt: 0 } },
      select: { subjectId: true, masteryScore: true, lastPracticedAt: true },
    });
    if (mastery.length === 0) return this.fullBoardComposition(totalQuestions);

    const now = Date.now();
    const withFreshness = mastery.map((m) => {
      const daysSince = m.lastPracticedAt ? (now - m.lastPracticedAt.getTime()) / 86_400_000 : 30;
      // Cap the boost so a single stale topic can't dominate the whole exam.
      const freshnessBoost = Math.min(20, daysSince);
      return { subjectId: m.subjectId, masteryScore: Math.max(0, m.masteryScore - freshnessBoost) };
    });

    const weights = await this.weaknessWeightedSubjects(withFreshness);
    if (weights.length === 0) return this.fullBoardComposition(totalQuestions);

    const mix = await this.recentAccuracyDifficultyMix(userId);
    const entries = await this.distributeByWeightAndDifficulty(weights, mix, totalQuestions);
    return entries.length ? entries : this.fullBoardComposition(totalQuestions);
  }

  // ── adaptive/AI composition helpers ─────────────────────────────────────────────

  /** Turn per-topic mastery rows into subject-level weights (inverse of mastery,
   * floored so no subject drops to zero), restricted to subjects with published inventory. */
  private async weaknessWeightedSubjects(rows: { subjectId: string; masteryScore: number }[]): Promise<{ subjectId: string; weight: number; poolSize: number }[]> {
    const bySubject = new Map<string, number[]>();
    for (const r of rows) {
      const list = bySubject.get(r.subjectId) ?? [];
      list.push(r.masteryScore);
      bySubject.set(r.subjectId, list);
    }
    const subjectIds = Array.from(bySubject.keys());
    const poolCounts = await Promise.all(
      subjectIds.map((subjectId) => this.prisma.question.count({ where: { subjectId, questionStatus: 'published', deletedAt: null } })),
    );
    const poolBySubject = new Map(subjectIds.map((id, i) => [id, poolCounts[i]!]));

    return subjectIds
      .map((subjectId) => {
        const scores = bySubject.get(subjectId)!;
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        return { subjectId, weight: Math.max(10, 100 - avg), poolSize: poolBySubject.get(subjectId) ?? 0 };
      })
      .filter((w) => w.poolSize >= MIN_POOL_TO_INCLUDE);
  }

  /** Recent-accuracy difficulty mix per ADAPTIVE_RULES (share of Foundational/Intermediate/Advanced). */
  private async recentAccuracyDifficultyMix(userId: string): Promise<{ code: number; share: number }[]> {
    const recent = await this.prisma.questionAttempt.findMany({
      where: { userId }, orderBy: { attemptedAt: 'desc' }, take: ADAPTIVE_RULES.WINDOW, select: { isCorrect: true },
    });
    const accuracy = recent.length ? recent.filter((r) => r.isCorrect).length / recent.length : 0.6;
    if (accuracy >= ADAPTIVE_RULES.PROMOTE_ACCURACY) return [{ code: 1, share: 0.15 }, { code: 2, share: 0.30 }, { code: 3, share: 0.55 }];
    if (accuracy <= ADAPTIVE_RULES.DEMOTE_ACCURACY) return [{ code: 1, share: 0.50 }, { code: 2, share: 0.35 }, { code: 3, share: 0.15 }];
    return [{ code: 1, share: 0.30 }, { code: 2, share: 0.40 }, { code: 3, share: 0.30 }];
  }

  /** Distribute totalQuestions across weighted subjects, banding by difficulty
   * mix only where the subject's pool is large enough to satisfy each band. */
  private async distributeByWeightAndDifficulty(
    weights: { subjectId: string; weight: number; poolSize: number }[],
    mix: { code: number; share: number }[],
    totalQuestions: number,
  ): Promise<CompositionEntry[]> {
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const difficultyLevels = await this.prisma.difficultyLevel.findMany({ select: { id: true, code: true } });
    const idByCode = new Map(difficultyLevels.map((d) => [d.code, d.id]));

    const entries: CompositionEntry[] = [];
    for (const { subjectId, weight, poolSize } of weights) {
      const subjectCount = Math.max(1, Math.round(totalQuestions * (weight / totalWeight)));
      if (poolSize < MIN_POOL_FOR_DIFFICULTY_SPLIT) {
        entries.push({ subjectId, count: Math.min(subjectCount, poolSize) });
        continue;
      }
      for (const { code, share } of mix) {
        const difficultyLevelId = idByCode.get(code);
        const count = Math.round(subjectCount * share);
        if (count > 0 && difficultyLevelId) entries.push({ subjectId, count, difficultyLevelId });
      }
    }
    return entries;
  }

  // ── helpers ───────────────────────────────────────────────────────────────────
  private sample<T>(arr: T[], n: number): T[] {
    return this.shuffle([...arr]).slice(0, n);
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }
}
