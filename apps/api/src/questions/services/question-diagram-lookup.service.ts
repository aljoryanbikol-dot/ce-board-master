/**
 * @file question-diagram-lookup.service.ts
 * @module Questions/Services
 *
 * Resolves a question's linked diagram by naming convention rather than a
 * stored relation: the Knowledge Library sync always names a question's own
 * figure `FIG.<questionId-with-dots>`, and `questionCode` is that same id
 * with dots replaced by hyphens (`FIG.Q.STR.SA.1` <-> `Q-STR-SA-1`). This
 * lookup is batched and read-only — no schema change needed.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { QuestionDiagramView } from '../types/questions.types';

@Injectable()
export class QuestionDiagramLookupService {
  constructor(private readonly prisma: PrismaService) {}

  publicIdFor(questionCode: string): string {
    return `FIG.${questionCode.replace(/-/g, '.')}`;
  }

  /** Batch-resolve diagrams for a set of question codes. Returns questionCode -> diagram. */
  async resolveMany(questionCodes: string[]): Promise<Map<string, QuestionDiagramView>> {
    const codeByPublicId = new Map<string, string>();
    for (const code of questionCodes) codeByPublicId.set(this.publicIdFor(code), code);
    const publicIds = Array.from(codeByPublicId.keys());
    if (!publicIds.length) return new Map();

    const rows = await this.prisma.diagram.findMany({
      where: { publicId: { in: publicIds }, status: 'published' },
      select: { publicId: true, title: true, imageUrl: true, altText: true, caption: true, description: true },
    });

    const byCode = new Map<string, QuestionDiagramView>();
    for (const row of rows) {
      const code = codeByPublicId.get(row.publicId);
      if (code) byCode.set(code, row);
    }
    return byCode;
  }

  /** Resolve a single question's diagram, if any. */
  async resolveOne(questionCode: string): Promise<QuestionDiagramView | null> {
    const map = await this.resolveMany([questionCode]);
    return map.get(questionCode) ?? null;
  }
}
