/**
 * @file ai-generation.integration.spec.ts
 * @module AI/Integration
 *
 * Wires the REAL AI services together (DeterministicGenerationProvider,
 * ContextBuilderService, ExplanationService, QuestionVariationService,
 * BlueprintExecutionService, ValidationService, PromptBuilderService,
 * DifficultyScalingService, AIContentService) with only the persistence edges
 * mocked (Prisma, Cache, Events, KnowledgeIntegrationService, PublicIdService).
 *
 * Exercises the full pipeline end-to-end: build a grounded context from the
 * Knowledge Base → generate from an LO → run the validation pipeline → persist
 * request + variants + audit log → promote a validated variant. This proves the
 * services compose correctly, not just that each works in isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIContentService } from '../../src/ai/services/ai-content.service';
import { ContextBuilderService } from '../../src/ai/services/context-builder.service';
import { BlueprintExecutionService } from '../../src/ai/services/blueprint-execution.service';
import { QuestionVariationService } from '../../src/ai/services/question-variation.service';
import { ExplanationService } from '../../src/ai/services/explanation.service';
import { ValidationService } from '../../src/ai/services/validation.service';
import { PromptBuilderService } from '../../src/ai/services/prompt-builder.service';
import { DifficultyScalingService } from '../../src/ai/services/difficulty-scaling.service';
import { DeterministicGenerationProvider } from '../../src/ai/providers/deterministic.provider';
import { PublicIdService } from '../../src/knowledge/services/public-id.service';
import type { AuthenticatedUser } from '../../src/auth/auth.types';

const user: AuthenticatedUser = { id: 'u-1', email: 'author@ce.com', role: 'content_author', subscriptionTier: 'pro' } as never;

const publishedLo = { id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'Compute the normal stress in an axially loaded member.', bloomLevel: 'apply', subjectCode: 'STR', topicCode: '001', status: 'published' };
const publishedMc = { id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'Stress vs strain confusion', category: 'FRM', description: 'Applies the stress formula when strain is required.', status: 'published' };

function buildHarness() {
  // In-memory persistence doubles.
  const store = { requests: [] as any[], variants: [] as any[], audits: [] as any[] };
  const tx = {
    aiGenerationRequest: { create: vi.fn(async ({ data }: any) => { const r = { id: `req-${store.requests.length + 1}`, ...data }; store.requests.push(r); return r; }), update: vi.fn(async ({ where, data }: any) => { const r = store.requests.find((x) => x.id === where.id); Object.assign(r, data); return r; }) },
    aiGeneratedVariant: { create: vi.fn(async ({ data }: any) => { const v = { id: `var-${store.variants.length + 1}`, ...data }; store.variants.push(v); return v; }) },
    aiGenerationAuditLog: { create: vi.fn(async ({ data }: any) => { const a = { id: `aud-${store.audits.length + 1}`, ...data }; store.audits.push(a); return a; }) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    learningObjective: { findFirst: vi.fn(async () => publishedLo) },
    questionBlueprint: { findFirst: vi.fn() },
    subject: { findFirst: vi.fn(async () => ({ id: 's-1' })) },
    formulaLibrary: { findMany: vi.fn(async () => [{ id: 'f-1', name: 'Normal Stress Equation', expressionText: 'σ = P / A' }]), findFirst: vi.fn(async () => ({ id: 'f-1' })) },
    misconception: { findFirst: vi.fn(async () => publishedMc) },
    aiGeneratedVariant: { findFirst: vi.fn(async (args: any) => store.variants.find((v) => v.requestId === args.where?.requestId && v.variantIndex === args.where?.variantIndex) ?? null) },
    aiGenerationRequest: { findFirst: vi.fn(async (args: any) => store.requests.find((r) => r.id === args.where?.id) ?? null), count: vi.fn(async () => 0), findMany: vi.fn(async () => store.requests) },
    aiGenerationAuditLog: { findMany: vi.fn(async () => store.audits) },
  };
  const cache = { invalidatePattern: vi.fn() };
  const events = { emit: vi.fn() };
  const knowledge = {
    verifyQuestionReferences: vi.fn(async () => ({ valid: true, errors: [], checks: [] })),
    getGenerationContext: vi.fn(async () => ({ blueprints: [], misconceptions: [publishedMc] })),
  };

  const provider = new DeterministicGenerationProvider();
  const difficulty = new DifficultyScalingService();
  const explanation = new ExplanationService(provider);
  const contextBuilder = new ContextBuilderService(prisma as never, knowledge as never, new PublicIdService(), difficulty);
  const variation = new QuestionVariationService(provider, explanation);
  const blueprintExec = new BlueprintExecutionService(contextBuilder as never, provider, explanation);
  const validation = new ValidationService(prisma as never, knowledge as never);
  const promptBuilder = new PromptBuilderService();
  const ai = new AIContentService(prisma as never, cache as never, contextBuilder as never, blueprintExec as never, variation as never, explanation as never, validation as never, promptBuilder as never, provider, events as never);

  return { ai, prisma, events, store, knowledge };
}

describe('AI generation — integration (real services)', () => {
  let h: ReturnType<typeof buildHarness>;
  beforeEach(() => { h = buildHarness(); });

  it('runs the full flow: ground → generate → validate → persist (validated)', async () => {
    const result = await h.ai.generateFromLearningObjective(
      { learningObjectiveId: 'LO-STR-001-003-001', difficultyBand: 'moderate', variantType: 'base', count: 1 } as never,
      user,
    );
    expect(result.status).toBe('validated');
    expect(result.variants.length).toBe(1);
    expect(result.variants[0]!.learningObjectiveId).toBe('LO-STR-001-003-001');
    // Persistence happened through the pipeline.
    expect(h.store.requests).toHaveLength(1);
    expect(h.store.variants).toHaveLength(1);
    expect(h.store.audits.length).toBeGreaterThanOrEqual(2);
    // The KB was consulted for grounding and validation.
    expect(h.knowledge.getGenerationContext).toHaveBeenCalled();
    expect(h.knowledge.verifyQuestionReferences).toHaveBeenCalled();
  });

  it('promotes a validated variant to a CMS draft and emits the event', async () => {
    const gen = await h.ai.generateFromLearningObjective(
      { learningObjectiveId: 'LO-STR-001-003-001', difficultyBand: 'moderate', variantType: 'base', count: 1 } as never,
      user,
    );
    const promoted = await h.ai.promote(gen.requestId, { variantIndex: 0 } as never, user);
    expect(promoted.status).toBe('promoted');
    expect(promoted.draft).toBeDefined();
    expect(h.events.emit).toHaveBeenCalledWith(expect.stringContaining('promoted'), expect.any(Object));
    // The audit log recorded the promotion.
    expect(h.store.audits.some((a) => a.stage === 'promoted')).toBe(true);
  });

  it('rejects generation grounded in an unpublished LO before any persistence', async () => {
    h.prisma.learningObjective.findFirst.mockResolvedValue({ ...publishedLo, status: 'draft' });
    await expect(
      h.ai.generateFromLearningObjective({ learningObjectiveId: 'LO-STR-001-003-001', difficultyBand: 'moderate', variantType: 'base', count: 1 } as never, user),
    ).rejects.toThrow();
    expect(h.store.requests).toHaveLength(0); // nothing persisted
  });

  it('produces multiple unique numerical variants in one request', async () => {
    const result = await h.ai.generateFromLearningObjective(
      { learningObjectiveId: 'LO-STR-001-003-001', difficultyBand: 'difficult', variantType: 'numerical', count: 3 } as never,
      user,
    );
    expect(result.variants.length).toBe(3);
    const hashes = new Set(result.variants.map((v) => v.contentHash));
    expect(hashes.size).toBe(3);
  });
});
