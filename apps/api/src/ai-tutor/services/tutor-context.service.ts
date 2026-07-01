/**
 * @file tutor-context.service.ts
 * @module AITutor/Services
 *
 * TutorContextService — the Knowledge Base grounding chokepoint. Before the
 * tutor answers anything, this service assembles a TutorContext from PUBLISHED
 * learning objectives, ACTIVE formulas, and PUBLISHED misconceptions for the
 * relevant subject/topic, plus the conversation's session memory. Every fact the
 * tutor asserts must trace back to an item assembled here — this is what makes
 * the tutor grounded and its citations verifiable.
 *
 * Read-only over the frozen Knowledge Base. Cached briefly per subject/topic.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService, CacheTTL } from '../../cache/cache.service';
import { CACHE_KEYS } from '../../common/constants';
import { TUTOR_LIMITS } from '../constants/tutor.constants';
import type { TutorContext, Citation } from '../types/tutor.types';

@Injectable()
export class TutorContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Assemble grounding context for a subject/topic (+ optional memory & recent turns). */
  async build(params: {
    subjectId: string | null;
    topicId: string | null;
    queryText?: string;
    keywords?: string[];
    memorySummary?: string | null;
    recentTurns?: { role: string; content: string }[];
  }): Promise<TutorContext> {
    const searchKeywords = this.extractKeywords(params.queryText);
    // Query-driven lookups aren't cacheable by subject/topic alone (the result
    // depends on the message text), so only the pure ID-scoped path is cached.
    const kb = searchKeywords.length
      ? await this.loadKb(params.subjectId, params.topicId, searchKeywords)
      : await this.cache.remember(
          CACHE_KEYS.tutor.context(params.subjectId ?? 'none', params.topicId ?? 'none'),
          CacheTTL.TUTOR,
          () => this.loadKb(params.subjectId, params.topicId, []),
        );
    return {
      subjectId: params.subjectId,
      topicId: params.topicId,
      learningObjectives: kb.learningObjectives,
      formulas: kb.formulas,
      misconceptions: kb.misconceptions,
      memorySummary: params.memorySummary ?? null,
      recentTurns: params.recentTurns ?? [],
    };
  }

  private static readonly STOPWORDS = new Set([
    'how', 'do', 'does', 'did', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for',
    'and', 'or', 'with', 'using', 'use', 'i', 'you', 'what', 'when', 'where', 'why', 'which', 'who', 'this',
    'that', 'these', 'those', 'can', 'could', 'would', 'should', 'me', 'my', 'it', 'its', 'be', 'been', 'am',
    'im', 'explain', 'give', 'show', 'tell', 'help', 'please', 'about', 'into', 'from', 'by', 'at', 'as',
  ]);

  /** Pull significant words out of a free-text question for a keyword-relevance search. */
  private extractKeywords(text?: string): string[] {
    if (!text) return [];
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !TutorContextService.STOPWORDS.has(w));
    return Array.from(new Set(words)).slice(0, 12);
  }

  /** Rank candidates by how many keywords appear in the given text fields, best first. */
  private rankByKeywordHits<T>(items: T[], keywords: string[], textOf: (item: T) => string, take: number): T[] {
    return items
      .map((item) => {
        const haystack = textOf(item).toLowerCase();
        const hits = keywords.reduce((n, kw) => (haystack.includes(kw) ? n + 1 : n), 0);
        return { item, hits };
      })
      .filter((r) => r.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, take)
      .map((r) => r.item);
  }

  /** Build citations from a context (what the tutor actually used). */
  citationsFromContext(ctx: TutorContext): Citation[] {
    const cites: Citation[] = [];
    for (const lo of ctx.learningObjectives.slice(0, 3)) cites.push({ kind: 'learning_objective', refId: lo.publicId, label: lo.statement.slice(0, 280) });
    for (const f of ctx.formulas.slice(0, 3)) cites.push({ kind: 'formula', refId: f.id, label: f.name, snippet: f.expression });
    for (const m of ctx.misconceptions.slice(0, 2)) cites.push({ kind: 'misconception', refId: m.publicId, label: m.title, snippet: m.description.slice(0, 280) });
    return cites.slice(0, TUTOR_LIMITS.MAX_CITATIONS_PER_MESSAGE);
  }

  private async loadKb(subjectId: string | null, topicId: string | null, keywords: string[]) {
    const subjectCode = subjectId
      ? (await this.prisma.subject.findUnique({ where: { id: subjectId }, select: { code: true } }))?.code
      : undefined;

    // No query text to search by: fall back to the prior ID-scoped-only behavior
    // (still used by explain/hint/solve flows, which already carry a real
    // subjectId/topicId from the question and don't need keyword search).
    if (!keywords.length) {
      if (!subjectId) return { learningObjectives: [], formulas: [], misconceptions: [] };
      const [los, formulas, misconceptions] = await Promise.all([
        subjectCode
          ? this.prisma.learningObjective.findMany({ where: { subjectCode, status: 'published' }, select: { publicId: true, statement: true }, take: 5, orderBy: { sequenceNumber: 'asc' } })
          : Promise.resolve([]),
        this.prisma.formulaLibrary.findMany({ where: { subjectId, ...(topicId && { topicId }), isActive: true }, select: { id: true, name: true, expressionText: true }, take: 5 }),
        this.prisma.misconception.findMany({ where: { status: 'published', ...(subjectCode && { subjectCode }) }, select: { publicId: true, title: true, description: true }, take: 4 }).catch(() => []),
      ]);
      return {
        learningObjectives: los.map((l: { publicId: string; statement: string }) => ({ publicId: l.publicId, statement: l.statement })),
        formulas: formulas.map((f: { id: string; name: string; expressionText: string }) => ({ id: f.id, name: f.name, expression: f.expressionText })),
        misconceptions: (misconceptions as { publicId: string; title: string; description: string }[]).map((m) => ({ publicId: m.publicId, title: m.title, description: m.description })),
      };
    }

    // Query-driven: search across the imported knowledge base by keyword instead
    // of relying solely on subject/topic IDs — scope to the subject when known,
    // but search all subjects when it isn't (e.g. no subject pre-selected in chat).
    const orContains = (field: string) => keywords.map((kw) => ({ [field]: { contains: kw, mode: 'insensitive' as const } }));
    const [loCandidates, formulaCandidates, miscCandidates] = await Promise.all([
      this.prisma.learningObjective.findMany({
        where: { status: 'published', ...(subjectCode && { subjectCode }), OR: orContains('statement') },
        select: { publicId: true, statement: true }, take: 40,
      }),
      this.prisma.formulaLibrary.findMany({
        where: { isActive: true, ...(subjectId && { subjectId }), OR: [...orContains('name'), ...orContains('expressionText')] },
        select: { id: true, name: true, expressionText: true }, take: 40,
      }),
      this.prisma.misconception.findMany({
        where: { status: 'published', ...(subjectCode && { subjectCode }), OR: [...orContains('title'), ...orContains('description')] },
        select: { publicId: true, title: true, description: true }, take: 40,
      }).catch(() => []),
    ]);

    const los = this.rankByKeywordHits(loCandidates, keywords, (l) => l.statement, 5);
    const formulas = this.rankByKeywordHits(formulaCandidates, keywords, (f) => `${f.name} ${f.expressionText}`, 5);
    const misconceptions = this.rankByKeywordHits(miscCandidates, keywords, (m) => `${m.title} ${m.description}`, 4);

    return {
      learningObjectives: los.map((l) => ({ publicId: l.publicId, statement: l.statement })),
      formulas: formulas.map((f) => ({ id: f.id, name: f.name, expression: f.expressionText })),
      misconceptions: misconceptions.map((m) => ({ publicId: m.publicId, title: m.title, description: m.description })),
    };
  }
}
