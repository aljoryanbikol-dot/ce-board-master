/**
 * @file context-builder.service.ts
 * @module AI/Services
 *
 * ContextBuilderService — assembles a grounded GenerationContext from the
 * Sprint 2.8 Knowledge Base. This is the chokepoint that enforces "the Knowledge
 * Base is the ONLY authoritative source": generation context can ONLY be built
 * from a published Learning Objective or Blueprint plus the formulas and
 * misconceptions linked to that subject/topic. Nothing the caller types becomes
 * generation grounding.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KnowledgeIntegrationService } from '../../knowledge/services/knowledge-integration.service';
import { PublicIdService } from '../../knowledge/services/public-id.service';
import { DifficultyScalingService } from './difficulty-scaling.service';
import { AiErrors } from '../errors/ai.errors';
import type { GenerationContext } from '../types/ai.types';

@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeIntegrationService,
    private readonly publicId: PublicIdService,
    private readonly difficulty: DifficultyScalingService,
  ) {}

  /** Build a context grounded in a published Learning Objective. */
  async fromLearningObjective(loPublicId: string, band: string): Promise<GenerationContext> {
    if (!this.publicId.validateLearningObjectiveId(loPublicId)) throw AiErrors.loNotFound(loPublicId);
    const lo = await this.prisma.learningObjective.findFirst({
      where: { publicId: loPublicId, deletedAt: null },
      select: { id: true, publicId: true, statement: true, bloomLevel: true, subjectCode: true, topicCode: true, status: true },
    });
    if (!lo) throw AiErrors.loNotFound(loPublicId);
    if (lo.status !== 'published') throw AiErrors.loNotPublished(loPublicId);

    const generationCtx = await this.knowledge.getGenerationContext(lo.subjectCode, lo.topicCode);
    const formulas = await this.formulasForSubject(lo.subjectCode);

    return {
      learningObjective: { id: lo.id, publicId: lo.publicId, statement: lo.statement, bloomLevel: lo.bloomLevel, subjectCode: lo.subjectCode },
      blueprint: null,
      formulas,
      misconceptions: generationCtx.misconceptions.map((m: { id: string; publicId: string; title: string; category: string; description: string }) => ({ id: m.id, publicId: m.publicId, title: m.title, category: m.category, description: m.description })),
      subjectCode: lo.subjectCode,
      topicCode: lo.topicCode,
      difficultyBand: this.difficulty.normalizeBand(band),
    };
  }

  /** Build a context grounded in a published Blueprint. */
  async fromBlueprint(bpPublicId: string, band: string): Promise<GenerationContext> {
    if (!this.publicId.validateBlueprintId(bpPublicId)) throw AiErrors.blueprintNotFound(bpPublicId);
    const bp = await this.prisma.questionBlueprint.findFirst({
      where: { publicId: bpPublicId, deletedAt: null },
      select: { id: true, publicId: true, name: true, blueprintType: true, structure: true, subjectCode: true, topicCode: true, status: true, primaryObjectiveId: true, difficultyBand: true },
    });
    if (!bp) throw AiErrors.blueprintNotFound(bpPublicId);
    if (bp.status !== 'published') throw AiErrors.blueprintNotPublished(bpPublicId);

    // Resolve the blueprint's primary Learning Objective (if linked).
    let lo: GenerationContext['learningObjective'] = null;
    if (bp.primaryObjectiveId) {
      const loRow = await this.prisma.learningObjective.findFirst({
        where: { id: bp.primaryObjectiveId, deletedAt: null },
        select: { id: true, publicId: true, statement: true, bloomLevel: true, subjectCode: true },
      });
      if (loRow) lo = { id: loRow.id, publicId: loRow.publicId, statement: loRow.statement, bloomLevel: loRow.bloomLevel, subjectCode: loRow.subjectCode };
    }

    const generationCtx = await this.knowledge.getGenerationContext(bp.subjectCode, bp.topicCode);
    const formulas = await this.formulasForSubject(bp.subjectCode);

    return {
      learningObjective: lo,
      blueprint: { id: bp.id, publicId: bp.publicId, name: bp.name, blueprintType: bp.blueprintType, structure: bp.structure },
      formulas,
      misconceptions: generationCtx.misconceptions.map((m: { id: string; publicId: string; title: string; category: string; description: string }) => ({ id: m.id, publicId: m.publicId, title: m.title, category: m.category, description: m.description })),
      subjectCode: bp.subjectCode,
      topicCode: bp.topicCode,
      difficultyBand: this.difficulty.normalizeBand(band ?? bp.difficultyBand),
    };
  }

  private async formulasForSubject(subjectCode: string): Promise<{ id: string; name: string; expressionText: string }[]> {
    // Subject codes on the LO/Blueprint are 3-letter; FormulaLibrary links via subjectId.
    // Resolve via Subject.code when available; otherwise return an empty grounded set.
    const subject = await this.prisma.subject.findFirst({ where: { code: subjectCode }, select: { id: true } });
    if (!subject) return [];
    const formulas = await this.prisma.formulaLibrary.findMany({
      where: { subjectId: subject.id, isActive: true },
      select: { id: true, name: true, expressionText: true }, take: 25,
    });
    return formulas.map((f: { id: string; name: string; expressionText: string }) => ({ id: f.id, name: f.name, expressionText: f.expressionText }));
  }
}
