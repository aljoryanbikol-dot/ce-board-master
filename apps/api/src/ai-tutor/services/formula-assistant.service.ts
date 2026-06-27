/**
 * @file formula-assistant.service.ts
 * @module AITutor/Services
 *
 * FormulaAssistantService — answers formula lookups by reading the frozen
 * FormulaLibrary (active formulas only) and composing usage guidance via the
 * provider. Returns the matching formulas (expression + LaTeX) plus a short
 * grounded note. Reuses the Knowledge Base; no duplicated formula storage.
 */
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TutorContextService } from './tutor-context.service';
import { TUTOR_PROVIDER, type TutorProvider } from '../providers/tutor-provider.interface';
import type { FormulaAnswer } from '../types/tutor.types';

@Injectable()
export class FormulaAssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TutorContextService,
    @Inject(TUTOR_PROVIDER) private readonly provider: TutorProvider,
  ) {}

  async assist(query: string, opts: { subjectId?: string; topicId?: string }): Promise<FormulaAnswer> {
    const where: Prisma.FormulaLibraryWhereInput = {
      isActive: true,
      ...(opts.subjectId && { subjectId: opts.subjectId }),
      ...(opts.topicId && { topicId: opts.topicId }),
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { expressionText: { contains: query, mode: 'insensitive' } },
      ],
    };
    const rows = await this.prisma.formulaLibrary.findMany({
      where, select: { id: true, name: true, expressionText: true, expressionLatex: true, subjectId: true }, take: 5,
    });

    const formulas = rows.map((f: { id: string; name: string; expressionText: string; expressionLatex: string; subjectId: string }) => ({
      id: f.id, name: f.name, expression: f.expressionText, latex: f.expressionLatex, subjectId: f.subjectId,
    }));

    const ctx = await this.context.build({ subjectId: opts.subjectId ?? formulas[0]?.subjectId ?? null, topicId: opts.topicId ?? null });
    // Reflect the found formulas into the context so the provider can ground its guidance.
    ctx.formulas = formulas.map((f: { id: string; name: string; expression: string }) => ({ id: f.id, name: f.name, expression: f.expression }));
    const out = await this.provider.respond({ intent: 'formula_help', prompt: query, context: ctx });

    return { query, formulas, guidance: out.content };
  }
}
