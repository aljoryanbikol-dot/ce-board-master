/**
 * @file ai-content.service.ts
 * @module AI/Services
 *
 * AIContentService — the orchestrator of the AI Content Generation Engine. It
 * owns the end-to-end lifecycle and the persistence of every generation:
 *
 *   1. enforce subscription quota (per-tier daily limit)
 *   2. build a grounded context from the Knowledge Base (LO or Blueprint)
 *   3. generate draft(s) via the provider (+ explanation enrichment)
 *   4. run the validation pipeline on each draft
 *   5. persist the request, its variants, and an append-only audit log
 *   6. expose validated drafts for promotion into the CMS / Question Bank
 *
 * Generation is grounded EXCLUSIVELY in the Knowledge Base; a request that
 * cannot be grounded in a published LO/Blueprint is rejected. Only drafts whose
 * pipeline outcome is `passed`/`passed_with_warnings` reach `validated` status,
 * and only `validated` requests can be promoted.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { ContextBuilderService } from './context-builder.service';
import { BlueprintExecutionService } from './blueprint-execution.service';
import { QuestionVariationService } from './question-variation.service';
import { ExplanationService } from './explanation.service';
import { ValidationService } from './validation.service';
import { PromptBuilderService } from './prompt-builder.service';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import { AiErrors } from '../errors/ai.errors';
import { EVENTS } from '../../common/constants';
import { AI_TIER_DAILY_QUOTA, AI_CACHE_PREFIX } from '../constants/ai.constants';
import type { GenerateFromLoDto, GenerateFromBlueprintDto, GenerateVariantsDto, ListGenerationsDto, PromoteGenerationDto } from '../dto/ai.dto';
import type { GeneratedQuestionDraft, GenerationContext, PipelineValidationReport } from '../types/ai.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class AIContentService {
  private readonly logger = new Logger(AIContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly blueprintExec: BlueprintExecutionService,
    private readonly variation: QuestionVariationService,
    private readonly explanation: ExplanationService,
    private readonly validation: ValidationService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly provider: DeterministicGenerationProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Generation entry points ───────────────────────────────────────────────────

  async generateFromLearningObjective(dto: GenerateFromLoDto, user: AuthenticatedUser) {
    await this.enforceQuota(user);
    const context = await this.contextBuilder.fromLearningObjective(dto.learningObjectiveId, dto.difficultyBand);
    const seedBase = dto.seed ?? `lo:${dto.learningObjectiveId}:${Date.now()}`;

    let drafts: GeneratedQuestionDraft[];
    if (dto.variantType === 'base') {
      drafts = [];
      const seen = new Set<string>();
      for (let i = 0; i < dto.count; i++) {
        let d = await this.provider.generateQuestion({ context, variantType: 'base', seed: `${seedBase}:${i}` });
        d = await this.explanation.enrich(d);
        if (seen.has(d.contentHash)) continue;
        seen.add(d.contentHash);
        drafts.push(d);
      }
    } else {
      drafts = await this.variation.generateVariants(context, dto.variantType, dto.count, seedBase);
    }
    return this.persistGeneration('question_from_lo', context, drafts, dto.variantType, user, { learningObjectiveId: dto.learningObjectiveId, difficultyBand: dto.difficultyBand, seed: seedBase, count: dto.count });
  }

  async generateFromBlueprint(dto: GenerateFromBlueprintDto, user: AuthenticatedUser) {
    await this.enforceQuota(user);
    const context = await this.blueprintExec.buildContext(dto.blueprintId, dto.difficultyBand);
    const seedBase = dto.seed ?? `bp:${dto.blueprintId}:${Date.now()}`;
    const drafts = await this.blueprintExec.execute(context, dto.count, seedBase);
    return this.persistGeneration('question_from_blueprint', context, drafts, 'base', user, { blueprintId: dto.blueprintId, difficultyBand: dto.difficultyBand, seed: seedBase, count: dto.count });
  }

  async generateVariants(dto: GenerateVariantsDto, user: AuthenticatedUser) {
    await this.enforceQuota(user);
    const source = await this.prisma.aiGenerationRequest.findFirst({ where: { id: dto.sourceRequestId }, select: { id: true, learningObjectiveId: true, blueprintId: true, difficultyBand: true } });
    if (!source) throw AiErrors.generationNotFound(dto.sourceRequestId);

    let context: GenerationContext;
    if (source.learningObjectiveId) context = await this.contextBuilder.fromLearningObjective(source.learningObjectiveId, source.difficultyBand ?? 'moderate');
    else if (source.blueprintId) context = await this.blueprintExec.buildContext(source.blueprintId, source.difficultyBand ?? 'moderate');
    else throw AiErrors.groundingRequired();

    const seedBase = dto.seed ?? `var:${dto.sourceRequestId}:${Date.now()}`;
    const drafts = await this.variation.generateVariants(context, dto.variantType, dto.count, seedBase);
    const kind = dto.variantType === 'numerical' ? 'numerical_variant' : 'conceptual_variant';
    return this.persistGeneration(kind, context, drafts, dto.variantType, user, { sourceRequestId: dto.sourceRequestId, variantType: dto.variantType, seed: seedBase, count: dto.count });
  }

  // ── Persistence + validation pipeline ─────────────────────────────────────────

  private async persistGeneration(
    kind: string,
    context: GenerationContext,
    drafts: GeneratedQuestionDraft[],
    variantType: string,
    user: AuthenticatedUser,
    parameters: Record<string, unknown>,
  ) {
    if (drafts.length === 0) throw AiErrors.generationFailed('The provider produced no drafts.');

    const prompt = this.promptBuilder.buildQuestionPrompt(context, variantType);

    // Validate every draft through the pipeline.
    const reports: PipelineValidationReport[] = [];
    for (const draft of drafts) reports.push(await this.validation.validate(draft, { requirePublished: true }));

    const anyPassed = reports.some((r) => r.outcome !== 'failed');
    const aggregateOutcome = reports.every((r) => r.outcome === 'passed')
      ? 'passed'
      : anyPassed ? 'passed_with_warnings' : 'failed';
    const status = anyPassed ? 'validated' : 'rejected';

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.aiGenerationRequest.create({
        data: {
          kind: kind as never, status: status as never,
          learningObjectiveId: context.learningObjective?.publicId ?? null,
          blueprintId: context.blueprint?.publicId ?? null,
          subjectCode: context.subjectCode, topicCode: context.topicCode,
          difficultyBand: context.difficultyBand,
          parameters: parameters as unknown as Prisma.InputJsonValue,
          prompt, output: drafts as unknown as Prisma.InputJsonValue,
          validationOutcome: aggregateOutcome as never,
          validationReport: reports as unknown as Prisma.InputJsonValue,
          providerName: this.provider.name, seed: String(parameters.seed ?? ''),
          contentHash: drafts[0]!.contentHash, requestedBy: user.id,
          completedAt: new Date(),
        },
      });

      for (let i = 0; i < drafts.length; i++) {
        const draft = drafts[i]!;
        await tx.aiGeneratedVariant.create({
          data: {
            requestId: request.id, variantIndex: i, variantType: draft.variantType,
            payload: draft as unknown as Prisma.InputJsonValue, contentHash: draft.contentHash,
            isDuplicate: reports[i]!.issues.some((iss) => iss.stage === 'duplicate' && iss.severity === 'error'),
            validationOutcome: reports[i]!.outcome as never,
          },
        });
      }

      await tx.aiGenerationAuditLog.create({
        data: { requestId: request.id, stage: 'generated', status: 'ok', message: `${drafts.length} draft(s) generated`, detail: { count: drafts.length } as unknown as Prisma.InputJsonValue, actorId: user.id },
      });
      await tx.aiGenerationAuditLog.create({
        data: { requestId: request.id, stage: 'validated', status: aggregateOutcome, message: `Pipeline outcome: ${aggregateOutcome}`, detail: { reports } as unknown as Prisma.InputJsonValue, actorId: user.id },
      });

      return request;
    });

    await this.cache.invalidatePattern(`${AI_CACHE_PREFIX}*`);
    this.eventEmitter.emit(EVENTS.AI_GENERATION_COMPLETED, { requestId: created.id, kind, outcome: aggregateOutcome, variants: drafts.length, actorId: user.id, timestamp: new Date().toISOString() });
    if (status === 'validated') this.eventEmitter.emit(EVENTS.AI_GENERATION_VALIDATED, { requestId: created.id, actorId: user.id });
    else this.eventEmitter.emit(EVENTS.AI_GENERATION_REJECTED, { requestId: created.id, actorId: user.id });

    this.logger.log({ message: 'Generation persisted', requestId: created.id, kind, status, variants: drafts.length, outcome: aggregateOutcome });
    return this.toRequestView(created, drafts, reports);
  }

  // ── Promotion to the Question Bank / CMS ───────────────────────────────────────

  async promote(requestId: string, dto: PromoteGenerationDto, user: AuthenticatedUser) {
    const request = await this.prisma.aiGenerationRequest.findFirst({ where: { id: requestId } });
    if (!request) throw AiErrors.generationNotFound(requestId);
    if (request.status === 'promoted') throw AiErrors.alreadyPromoted(requestId);
    if (request.status !== 'validated') throw AiErrors.notValidated(request.status);

    const variant = await this.prisma.aiGeneratedVariant.findFirst({ where: { requestId, variantIndex: dto.variantIndex } });
    if (!variant) throw AiErrors.invalidVariantRequest(`No variant at index ${dto.variantIndex}.`);
    if (variant.isDuplicate) throw AiErrors.duplicateContent();
    if (variant.validationOutcome === 'failed') throw AiErrors.validationFailed({ variantIndex: dto.variantIndex });

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.aiGenerationAuditLog.create({
        data: { requestId, stage: 'promoted', status: 'ok', message: `Variant ${dto.variantIndex} promoted to CMS draft`, detail: { variantIndex: dto.variantIndex, questionCode: dto.questionCode ?? null } as unknown as Prisma.InputJsonValue, actorId: user.id },
      });
      return tx.aiGenerationRequest.update({ where: { id: requestId }, data: { status: 'promoted' } });
    });

    await this.cache.invalidatePattern(`${AI_CACHE_PREFIX}*`);
    this.eventEmitter.emit(EVENTS.AI_GENERATION_PROMOTED, { requestId, variantIndex: dto.variantIndex, payload: variant.payload, questionCode: dto.questionCode ?? null, actorId: user.id, timestamp: new Date().toISOString() });
    this.logger.log({ message: 'Generation promoted to CMS draft', requestId, variantIndex: dto.variantIndex });
    return { id: updated.id, status: updated.status, variantIndex: dto.variantIndex, draft: variant.payload };
  }

  // ── Reads ─────────────────────────────────────────────────────────────────────

  async findById(id: string) {
    const request = await this.prisma.aiGenerationRequest.findFirst({ where: { id }, include: { variants: { orderBy: { variantIndex: 'asc' } } } });
    if (!request) throw AiErrors.generationNotFound(id);
    return this.toDetailView(request);
  }

  async getAuditLog(id: string) {
    const request = await this.prisma.aiGenerationRequest.findFirst({ where: { id }, select: { id: true } });
    if (!request) throw AiErrors.generationNotFound(id);
    const logs = await this.prisma.aiGenerationAuditLog.findMany({ where: { requestId: id }, orderBy: { createdAt: 'asc' } });
    return logs.map((l: { id: string; stage: string; status: string; message: string | null; detail: unknown; createdAt: Date }) => ({
      id: l.id, stage: l.stage, status: l.status, message: l.message, detail: l.detail, createdAt: l.createdAt.toISOString(),
    }));
  }

  async list(dto: ListGenerationsDto) {
    const where: Prisma.AiGenerationRequestWhereInput = {
      ...(dto.status && { status: dto.status as never }),
      ...(dto.kind && { kind: dto.kind as never }),
      ...(dto.cursor && { id: { gt: dto.cursor } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.aiGenerationRequest.findMany({ where, orderBy: { id: 'asc' }, take: dto.limit + 1 }),
      this.prisma.aiGenerationRequest.count({ where }),
    ]);
    const hasMore = rows.length > dto.limit;
    const page = hasMore ? rows.slice(0, dto.limit) : rows;
    return {
      data: page.map((r: { id: string; kind: string; status: string; learningObjectiveId: string | null; blueprintId: string | null; validationOutcome: string | null; createdAt: Date }) => ({
        id: r.id, kind: r.kind, status: r.status, learningObjectiveId: r.learningObjectiveId, blueprintId: r.blueprintId, validationOutcome: r.validationOutcome, createdAt: r.createdAt.toISOString(),
      })),
      pagination: { cursor: hasMore && page.length ? page[page.length - 1]!.id : null, hasMore, total },
    };
  }

  // ── Quota ─────────────────────────────────────────────────────────────────────

  private async enforceQuota(user: AuthenticatedUser): Promise<void> {
    const tier = String(user.subscriptionTier ?? 'free');
    const limit = AI_TIER_DAILY_QUOTA[tier] ?? AI_TIER_DAILY_QUOTA.free!;
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const used = await this.prisma.aiGenerationRequest.count({ where: { requestedBy: user.id, createdAt: { gte: since } } });
    if (used >= limit) {
      this.eventEmitter.emit(EVENTS.AI_GENERATION_FAILED, { actorId: user.id, reason: 'quota_exceeded', limit });
      throw AiErrors.quotaExceeded(limit);
    }
  }

  // ── View mappers ────────────────────────────────────────────────────────────

  private toRequestView(request: { id: string; kind: string; status: string }, drafts: GeneratedQuestionDraft[], reports: PipelineValidationReport[]) {
    return {
      requestId: request.id, kind: request.kind, status: request.status,
      variants: drafts, validation: reports[0]!, validationReports: reports,
    };
  }

  private toDetailView(request: {
    id: string; kind: string; status: string; learningObjectiveId: string | null; blueprintId: string | null;
    subjectCode: string | null; topicCode: string | null; difficultyBand: string | null; validationOutcome: string | null;
    validationReport: unknown; prompt: string | null; createdAt: Date; completedAt: Date | null;
    variants: { id: string; variantIndex: number; variantType: string; payload: unknown; contentHash: string; isDuplicate: boolean; validationOutcome: string | null }[];
  }) {
    return {
      id: request.id, kind: request.kind, status: request.status,
      learningObjectiveId: request.learningObjectiveId, blueprintId: request.blueprintId,
      subjectCode: request.subjectCode, topicCode: request.topicCode, difficultyBand: request.difficultyBand,
      validationOutcome: request.validationOutcome, validationReport: request.validationReport, prompt: request.prompt,
      createdAt: request.createdAt.toISOString(), completedAt: request.completedAt?.toISOString() ?? null,
      variants: request.variants.map((v) => ({ id: v.id, variantIndex: v.variantIndex, variantType: v.variantType, payload: v.payload, contentHash: v.contentHash, isDuplicate: v.isDuplicate, validationOutcome: v.validationOutcome })),
    };
  }
}
