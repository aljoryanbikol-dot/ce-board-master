/**
 * @file knowledge-search.service.ts
 * @module Knowledge/Services
 *
 * KnowledgeSearchService — full-text search + indexing across the knowledge
 * base. Searches document sections and the structured entities (learning
 * objectives, formulas, blueprints, misconceptions) and returns ranked hits.
 *
 * Uses case-insensitive contains matching across the indexed columns. (In CI/
 * production this maps onto Postgres ILIKE; a future iteration can swap in a
 * tsvector GIN index without changing this service's contract.)
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KNOWLEDGE_SEARCH_LIMIT } from '../constants/knowledge.constants';
import type { KnowledgeSearchDto } from '../dto/knowledge.dto';
import type { SearchHit } from '../types/knowledge.types';

type EntityType = 'section' | 'learning_objective' | 'formula' | 'blueprint' | 'misconception';

@Injectable()
export class KnowledgeSearchService {
  private readonly logger = new Logger(KnowledgeSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(dto: KnowledgeSearchDto): Promise<{ query: string; total: number; hits: SearchHit[] }> {
    const limit = Math.min(dto.limit, KNOWLEDGE_SEARCH_LIMIT);
    const wanted = this.parseTypes(dto.types);
    const q = dto.q;
    const ci = { contains: q, mode: 'insensitive' as const };

    const hits: SearchHit[] = [];

    if (wanted.has('learning_objective')) {
      const los = await this.prisma.learningObjective.findMany({
        where: { deletedAt: null, OR: [{ statement: ci }, { publicId: { contains: q.toUpperCase() } }, { keywords: { has: q } }] },
        take: limit, select: { id: true, publicId: true, statement: true },
      });
      for (const lo of los) hits.push({ type: 'learning_objective', id: lo.id, publicId: lo.publicId, title: lo.publicId, snippet: this.snippet(lo.statement, q), score: this.score(lo.statement, q) });
    }

    if (wanted.has('formula')) {
      const formulas = await this.prisma.formulaLibrary.findMany({
        where: { isActive: true, OR: [{ name: ci }, { expressionText: ci }] },
        take: limit, select: { id: true, name: true, expressionText: true },
      });
      for (const f of formulas) hits.push({ type: 'formula', id: f.id, publicId: null, title: f.name, snippet: this.snippet(f.expressionText, q), score: this.score(f.name, q) });
    }

    if (wanted.has('blueprint')) {
      const bps = await this.prisma.questionBlueprint.findMany({
        where: { deletedAt: null, OR: [{ name: ci }, { publicId: { contains: q.toUpperCase() } }] },
        take: limit, select: { id: true, publicId: true, name: true, description: true },
      });
      for (const b of bps) hits.push({ type: 'blueprint', id: b.id, publicId: b.publicId, title: b.name, snippet: this.snippet(b.description ?? b.name, q), score: this.score(b.name, q) });
    }

    if (wanted.has('misconception')) {
      const mcs = await this.prisma.misconception.findMany({
        where: { deletedAt: null, OR: [{ title: ci }, { description: ci }, { publicId: { contains: q.toUpperCase() } }] },
        take: limit, select: { id: true, publicId: true, title: true, description: true },
      });
      for (const m of mcs) hits.push({ type: 'misconception', id: m.id, publicId: m.publicId, title: m.title, snippet: this.snippet(m.description, q), score: this.score(m.title, q) });
    }

    if (wanted.has('section')) {
      const sections = await this.prisma.knowledgeSection.findMany({
        where: { OR: [{ heading: ci }, { bodyText: ci }] },
        take: limit, select: { id: true, heading: true, bodyText: true, documentId: true },
      });
      for (const s of sections) hits.push({ type: 'section', id: s.id, publicId: null, title: s.heading, snippet: this.snippet(s.bodyText, q), score: this.score(s.heading, q) });
    }

    hits.sort((a, b) => b.score - a.score);
    const limited = hits.slice(0, limit);
    this.logger.log({ message: 'Knowledge search', query: q, total: limited.length });
    return { query: q, total: limited.length, hits: limited };
  }

  private parseTypes(types?: string): Set<EntityType> {
    const all: EntityType[] = ['section', 'learning_objective', 'formula', 'blueprint', 'misconception'];
    if (!types) return new Set(all);
    const requested = types.split(',').map((t) => t.trim()).filter(Boolean) as EntityType[];
    const valid = requested.filter((t) => all.includes(t));
    return new Set(valid.length > 0 ? valid : all);
  }

  private snippet(text: string, q: string): string {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text.slice(0, 160);
    const start = Math.max(0, idx - 60);
    return (start > 0 ? '…' : '') + text.slice(start, idx + q.length + 100).trim() + '…';
  }

  private score(text: string, q: string): number {
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    if (lower === ql) return 100;
    if (lower.startsWith(ql)) return 80;
    if (lower.includes(ql)) return 60 - Math.min(lower.indexOf(ql), 40);
    return 10;
  }
}
