/**
 * @file handbook.service.ts
 * @module Handbook
 *
 * Fundamentals Handbook — student-facing read model over the existing
 * Knowledge Library (FormulaLibrary, Concept, EngineeringTip, Diagram,
 * QuestionFormula). Nothing here duplicates content: every payload is a
 * projection of records the Library sync already owns.
 *
 * "Must memorize" is derived, not curated: the formulas most linked to real
 * board questions (QuestionFormula count) per subject — the closest
 * data-driven proxy for "you will need this in the exam room".
 *
 * Daily picks are date-seeded (UTC day number modulo pool size): stable for
 * the whole day, rotate at midnight, no cron and no schema.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CacheService, CacheNamespace, CacheTTL } from '../cache/cache.service';

const DAY_MS = 86_400_000;

@Injectable()
export class HandbookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Active subjects with their formula counts, for the handbook nav. */
  async subjects() {
    const key = this.cache.buildKey(CacheNamespace.KNOWLEDGE, 'handbook', 'subjects');
    return this.cache.remember(key, CacheTTL.KNOWLEDGE, async () =>
      this.prisma.subject.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, code: true, name: true,
          _count: { select: { formulas: { where: { isActive: true } } } },
        },
      }),
    );
  }

  /** Searchable, filterable formula list (name / expression / application text). */
  async listFormulas(params: { subjectCode?: string; q?: string; page: number; limit: number }) {
    const { subjectCode, q, page, limit } = params;
    const where = {
      isActive: true,
      subject: { isActive: true, ...(subjectCode ? { code: subjectCode } : {}) },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { expressionText: { contains: q, mode: 'insensitive' as const } },
              { expressionLatex: { contains: q, mode: 'insensitive' as const } },
              { exampleProblem: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.formulaLibrary.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          slug: true, name: true, expressionLatex: true, expressionText: true, unitsSystem: true,
          subject: { select: { code: true, name: true } },
          topic: { select: { name: true } },
        },
      }),
      this.prisma.formulaLibrary.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Most board-question-linked formulas per subject — the memorization shortlist. */
  async mustMemorize() {
    const key = this.cache.buildKey(CacheNamespace.KNOWLEDGE, 'handbook', 'must-memorize');
    return this.cache.remember(key, CacheTTL.KNOWLEDGE, async () => {
      const subjects = await this.prisma.subject.findMany({
        where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, code: true, name: true },
      });
      const groups = [];
      for (const s of subjects) {
        const formulas = await this.prisma.formulaLibrary.findMany({
          where: { isActive: true, subjectId: s.id, questionFormulas: { some: {} } },
          orderBy: { questionFormulas: { _count: 'desc' } },
          take: 10,
          select: {
            slug: true, name: true, expressionLatex: true, expressionText: true,
            _count: { select: { questionFormulas: true } },
          },
        });
        if (formulas.length) groups.push({ subjectCode: s.code, subjectName: s.name, formulas });
      }
      return groups;
    });
  }

  /** Full formula page: definitions, meaning, usage, and every related record. */
  async formulaDetail(slug: string) {
    const f = await this.prisma.formulaLibrary.findUnique({
      where: { slug },
      include: {
        subject: { select: { code: true, name: true } },
        topic: { select: { code: true, name: true } },
        questionFormulas: {
          take: 6,
          select: { question: { select: { questionCode: true, stemText: true } } },
        },
      },
    });
    if (!f || !f.isActive) return null;

    const [related, diagrams, concepts] = await Promise.all([
      this.prisma.formulaLibrary.findMany({
        where: { isActive: true, topicId: f.topicId ?? undefined, NOT: { id: f.id } },
        take: 6,
        select: { slug: true, name: true, expressionLatex: true },
      }),
      f.topic
        ? this.prisma.diagram.findMany({
            where: { topicCode: f.topic.code, status: 'published', diagramType: { not: 'question-figure' } },
            take: 2,
            select: { publicId: true, title: true, imageUrl: true, altText: true },
          })
        : Promise.resolve([]),
      f.topic
        ? this.prisma.concept.findMany({
            where: { topicCode: f.topic.code, status: 'published' },
            take: 4,
            select: { publicId: true, title: true, body: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      slug: f.slug, name: f.name,
      subject: f.subject, topic: f.topic ? { name: f.topic.name } : null,
      expressionLatex: f.expressionLatex, expressionText: f.expressionText,
      variables: f.variables, unitsSystem: f.unitsSystem, imperialExpression: f.imperialExpression,
      derivation: f.derivation, assumptions: f.assumptions, limitations: f.limitations,
      typicalApplications: f.typicalApplications, exampleProblem: f.exampleProblem,
      relatedFormulas: related,
      relatedQuestions: f.questionFormulas.map((qf) => ({
        questionCode: qf.question.questionCode,
        stem: qf.question.stemText.slice(0, 160),
      })),
      relatedDiagrams: diagrams,
      relatedConcepts: concepts.map((c) => ({ publicId: c.publicId, title: c.title, summary: c.body.slice(0, 240) })),
    };
  }

  /** Formula / Concept / Tip of the Day — date-seeded, stable for 24h. */
  async daily() {
    const day = Math.floor(Date.now() / DAY_MS);
    const key = this.cache.buildKey(CacheNamespace.KNOWLEDGE, 'handbook', 'daily', day);
    return this.cache.remember(key, CacheTTL.KNOWLEDGE, async () => {
      const activeSubject = { subject: { isActive: true } } as const;
      const [formulaCount, conceptCount, tipCount] = await this.prisma.$transaction([
        this.prisma.formulaLibrary.count({ where: { isActive: true, ...activeSubject } }),
        this.prisma.concept.count({ where: { status: 'published' } }),
        this.prisma.engineeringTip.count({ where: { status: 'published' } }),
      ]);
      const [formula, concept, tip] = await Promise.all([
        formulaCount
          ? this.prisma.formulaLibrary.findMany({
              where: { isActive: true, ...activeSubject },
              orderBy: { slug: 'asc' }, skip: day % formulaCount, take: 1,
              select: {
                slug: true, name: true, expressionLatex: true, expressionText: true,
                exampleProblem: true, typicalApplications: true,
                subject: { select: { code: true, name: true } },
              },
            }).then((r) => r[0] ?? null)
          : null,
        conceptCount
          ? this.prisma.concept.findMany({
              where: { status: 'published' },
              orderBy: { publicId: 'asc' }, skip: day % conceptCount, take: 1,
              select: { publicId: true, title: true, body: true, subjectCode: true },
            }).then((r) => r[0] ?? null)
          : null,
        tipCount
          ? this.prisma.engineeringTip.findMany({
              where: { status: 'published' },
              orderBy: { publicId: 'asc' }, skip: day % tipCount, take: 1,
              select: { publicId: true, title: true, tip: true, subjectCode: true },
            }).then((r) => r[0] ?? null)
          : null,
      ]);
      return { formula, concept, tip };
    });
  }
}
