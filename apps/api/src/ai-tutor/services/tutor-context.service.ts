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
    keywords?: string[];
    memorySummary?: string | null;
    recentTurns?: { role: string; content: string }[];
  }): Promise<TutorContext> {
    const kb = await this.cache.remember(
      CACHE_KEYS.tutor.context(params.subjectId ?? 'none', params.topicId ?? 'none'),
      CacheTTL.TUTOR,
      () => this.loadKb(params.subjectId, params.topicId),
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

  /** Build citations from a context (what the tutor actually used). */
  citationsFromContext(ctx: TutorContext): Citation[] {
    const cites: Citation[] = [];
    for (const lo of ctx.learningObjectives.slice(0, 3)) cites.push({ kind: 'learning_objective', refId: lo.publicId, label: lo.statement.slice(0, 280) });
    for (const f of ctx.formulas.slice(0, 3)) cites.push({ kind: 'formula', refId: f.id, label: f.name, snippet: f.expression });
    for (const m of ctx.misconceptions.slice(0, 2)) cites.push({ kind: 'misconception', refId: m.publicId, label: m.title, snippet: m.description.slice(0, 280) });
    return cites.slice(0, TUTOR_LIMITS.MAX_CITATIONS_PER_MESSAGE);
  }

  private async loadKb(subjectId: string | null, topicId: string | null) {
    if (!subjectId) return { learningObjectives: [], formulas: [], misconceptions: [] };

    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId }, select: { code: true } });
    const subjectCode = subject?.code;

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
}
