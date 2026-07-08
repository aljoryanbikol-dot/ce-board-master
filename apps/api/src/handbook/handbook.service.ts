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

  /**
   * Searchable engineering symbol index, derived from FormulaLibrary
   * variables — every symbol with its meanings, units, and the formulas it
   * appears in. Aggregated once and cached (the formula pool changes only on
   * Knowledge Library sync).
   */
  async symbols(q?: string) {
    const key = this.cache.buildKey(CacheNamespace.KNOWLEDGE, 'handbook', 'symbols');
    const index = await this.cache.remember(key, CacheTTL.KNOWLEDGE, async () => {
      const formulas = await this.prisma.formulaLibrary.findMany({
        where: { isActive: true, subject: { isActive: true } },
        select: { slug: true, name: true, variables: true, subject: { select: { code: true } } },
      });
      const bySymbol = new Map<string, { symbol: string; meanings: Set<string>; units: Set<string>; formulas: Array<{ slug: string; name: string }> }>();
      for (const f of formulas) {
        const vars = Array.isArray(f.variables) ? (f.variables as Array<{ symbol?: string; name?: string; unit?: string }>) : [];
        for (const v of vars) {
          if (!v?.symbol) continue;
          const entry = bySymbol.get(v.symbol) ?? { symbol: v.symbol, meanings: new Set<string>(), units: new Set<string>(), formulas: [] };
          if (v.name) entry.meanings.add(v.name);
          if (v.unit) entry.units.add(v.unit);
          if (entry.formulas.length < 8) entry.formulas.push({ slug: f.slug, name: f.name });
          bySymbol.set(v.symbol, entry);
        }
      }
      return Array.from(bySymbol.values())
        .map((e) => ({ symbol: e.symbol, meanings: Array.from(e.meanings).slice(0, 6), units: Array.from(e.units).slice(0, 4), formulas: e.formulas }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
    });
    if (!q) return index.slice(0, 200);
    const needle = q.toLowerCase();
    return index
      .filter((e) => e.symbol.toLowerCase().includes(needle) || e.meanings.some((m) => m.toLowerCase().includes(needle)))
      .slice(0, 200);
  }

  /** Searchable glossary over published Concepts, with related records. */
  async glossary(params: { q?: string; subjectCode?: string; page: number; limit: number }) {
    const { q, subjectCode, page, limit } = params;
    const where = {
      status: 'published' as const,
      ...(subjectCode ? { subjectCode } : {}),
      ...(q
        ? { OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { body: { contains: q, mode: 'insensitive' as const } },
            { keywords: { has: q } },
          ] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.concept.findMany({
        where, orderBy: { title: 'asc' }, skip: (page - 1) * limit, take: limit,
        select: { publicId: true, title: true, body: true, subjectCode: true, topicCode: true, keywords: true },
      }),
      this.prisma.concept.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Engineering Foundations — review pages composed from existing
   * ReviewNotes, grouped by subject/topic (MATH topics cover algebra through
   * statistics; EM and SOM cover mechanics fundamentals).
   */
  async foundations() {
    const key = this.cache.buildKey(CacheNamespace.KNOWLEDGE, 'handbook', 'foundations');
    return this.cache.remember(key, CacheTTL.KNOWLEDGE, async () => {
      const notes = await this.prisma.reviewNote.findMany({
        where: { status: 'published' },
        orderBy: [{ subjectCode: 'asc' }, { topicCode: 'asc' }],
        select: { publicId: true, subjectCode: true, topicCode: true, title: true, examWeight: true },
      });
      const topics = await this.prisma.topic.findMany({
        where: { subject: { isActive: true } },
        select: { code: true, name: true, subject: { select: { code: true, name: true } } },
      });
      const topicByCode = new Map(topics.map((t) => [t.code, t]));
      const groups = new Map<string, { subjectCode: string; subjectName: string; pages: Array<{ publicId: string; title: string; topicName: string | null; examWeight: number | null }> }>();
      for (const n of notes) {
        const topic = n.topicCode ? topicByCode.get(n.topicCode) : undefined;
        const sCode = topic?.subject.code ?? n.subjectCode ?? '—';
        const sName = topic?.subject.name ?? n.subjectCode ?? 'Other';
        const g = groups.get(sCode) ?? { subjectCode: sCode, subjectName: sName, pages: [] };
        g.pages.push({ publicId: n.publicId, title: n.title, topicName: topic?.name ?? null, examWeight: n.examWeight ? Number(n.examWeight) : null });
        groups.set(sCode, g);
      }
      return Array.from(groups.values());
    });
  }

  /** One foundations page: the review note plus the topic's formulas and concepts. */
  async foundationPage(publicId: string) {
    const note = await this.prisma.reviewNote.findUnique({
      where: { publicId },
      select: { publicId: true, title: true, body: true, topicCode: true, subjectCode: true },
    });
    if (!note) return null;
    const topic = note.topicCode
      ? await this.prisma.topic.findUnique({ where: { code: note.topicCode }, select: { id: true, name: true, subject: { select: { name: true, code: true } } } })
      : null;
    const [formulas, concepts] = await Promise.all([
      topic ? this.prisma.formulaLibrary.findMany({ where: { isActive: true, topicId: topic.id }, take: 12, select: { slug: true, name: true, expressionLatex: true } }) : [],
      note.topicCode ? this.prisma.concept.findMany({ where: { status: 'published', topicCode: note.topicCode }, take: 8, select: { publicId: true, title: true, body: true } }) : [],
    ]);
    return {
      publicId: note.publicId, title: note.title, body: note.body,
      topicName: topic?.name ?? null, subject: topic?.subject ?? null,
      formulas, concepts: concepts.map((c) => ({ publicId: c.publicId, title: c.title, summary: c.body.slice(0, 240) })),
    };
  }

  /** "Last Minute Review" — the highest-yield records across the whole library. */
  async lastMinute() {
    const key = this.cache.buildKey(CacheNamespace.KNOWLEDGE, 'handbook', 'last-minute');
    return this.cache.remember(key, CacheTTL.KNOWLEDGE, async () => {
      const [topFormulas, mistakesRaw, tips] = await Promise.all([
        this.prisma.formulaLibrary.findMany({
          where: { isActive: true, subject: { isActive: true }, questionFormulas: { some: {} } },
          orderBy: { questionFormulas: { _count: 'desc' } },
          take: 100,
          select: { slug: true, name: true, expressionLatex: true, expressionText: true, subject: { select: { code: true } }, _count: { select: { questionFormulas: true } } },
        }),
        this.prisma.questionIntelligence.findMany({
          where: { commonMistakes: { not: { equals: null } } },
          take: 400,
          select: { commonMistakes: true },
        }),
        this.prisma.engineeringTip.findMany({ where: { status: 'published' }, take: 40, orderBy: { publicId: 'asc' }, select: { title: true, tip: true, subjectCode: true } }),
      ]);
      // Dedupe/flatten a sample of common mistakes across the bank.
      const mistakes: string[] = [];
      const seen = new Set<string>();
      for (const row of mistakesRaw) {
        if (!Array.isArray(row.commonMistakes)) continue;
        for (const m of row.commonMistakes as string[]) {
          const norm = m.trim();
          if (norm.length < 12 || seen.has(norm)) continue;
          seen.add(norm);
          mistakes.push(norm);
          if (mistakes.length >= 60) break;
        }
        if (mistakes.length >= 60) break;
      }
      return { topFormulas, commonMistakes: mistakes, boardTips: tips };
    });
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
      const [formula, concept, tip, definition] = await Promise.all([
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
        // Definition of the Day: a second, independently-offset concept pick.
        conceptCount
          ? this.prisma.concept.findMany({
              where: { status: 'published' },
              orderBy: { publicId: 'asc' }, skip: (day * 7 + 3) % conceptCount, take: 1,
              select: { publicId: true, title: true, body: true, subjectCode: true },
            }).then((r) => r[0] ?? null)
          : null,
      ]);
      return { formula, concept, tip, definition };
    });
  }
}
