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
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ExamErrors } from '../errors/exam.errors';
import type { CompositionEntry, BuiltExamQuestion } from '../types/exam.types';
import type { CreateTemplateDto } from '../dto/exam.dto';

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
