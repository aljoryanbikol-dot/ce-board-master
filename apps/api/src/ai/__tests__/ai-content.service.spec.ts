/**
 * @file ai-content.service.spec.ts
 * @module AI/Tests
 *
 * Orchestrator test. All 9 dependencies mocked; $transaction passes a tx double
 * straight through. Covers generation (LO/blueprint/variants), the validation
 * gate driving status, the promote state machine, quota enforcement, and reads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AIContentService } from '../services/ai-content.service';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { GeneratedQuestionDraft, GenerationContext, PipelineValidationReport } from '../types/ai.types';

const user: AuthenticatedUser = { id: 'u-1', email: 'a@b.com', role: 'content_author', subscriptionTier: 'pro' } as never;

const ctx: GenerationContext = {
  learningObjective: { id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'Compute stress.', bloomLevel: 'apply', subjectCode: 'STR' },
  blueprint: null,
  formulas: [{ id: 'f-1', name: 'Normal Stress Equation', expressionText: 'σ = P/A' }],
  misconceptions: [{ id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'X', category: 'FRM', description: 'y' }],
  subjectCode: 'STR', topicCode: '001', difficultyBand: 'moderate',
};
const draft: GeneratedQuestionDraft = {
  stemText: 'Compute the normal stress.', choices: [
    { letter: 'A', text: 'Correct.', isCorrect: true },
    { letter: 'B', text: 'Wrong.', isCorrect: false, misconceptionId: 'MC-STR-003-002-FRM-001' },
    { letter: 'C', text: 'Wrong 2.', isCorrect: false },
  ], correctChoice: 'A', explanationText: 'Applies the governing equation σ = P/A.', solutionSteps: ['s1'],
  bloomLevel: 'apply', difficultyBand: 'moderate', learningObjectiveId: 'LO-STR-001-003-001', blueprintId: null,
  formulaIds: ['Normal Stress Equation'], misconceptionIds: ['MC-STR-003-002-FRM-001'], estSolvingTimeSec: 120,
  variantType: 'base', contentHash: 'hash-1',
};
const passReport: PipelineValidationReport = { outcome: 'passed', issues: [], stages: [] };

function makeMocks() {
  const tx = {
    aiGenerationRequest: { create: vi.fn().mockImplementation(async ({ data }: { data: { status: string; kind: string } }) => ({ id: 'req-1', kind: data.kind ?? 'question_from_lo', status: data.status })), update: vi.fn().mockResolvedValue({ id: 'req-1', status: 'promoted' }) },
    aiGeneratedVariant: { create: vi.fn().mockResolvedValue({}) },
    aiGenerationAuditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    aiGenerationRequest: { findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    aiGeneratedVariant: { findFirst: vi.fn() },
    aiGenerationAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const cache = { invalidatePattern: vi.fn() };
  const contextBuilder = { fromLearningObjective: vi.fn().mockResolvedValue(ctx) };
  const blueprintExec = { buildContext: vi.fn().mockResolvedValue(ctx), execute: vi.fn().mockResolvedValue([draft]) };
  const variation = { generateVariants: vi.fn().mockResolvedValue([draft]) };
  const explanation = { enrich: vi.fn().mockResolvedValue(draft) };
  const validation = { validate: vi.fn().mockResolvedValue(passReport) };
  const promptBuilder = { buildQuestionPrompt: vi.fn().mockReturnValue('PROMPT') };
  const provider = { name: 'deterministic', generateQuestion: vi.fn().mockResolvedValue(draft) };
  const events = { emit: vi.fn() };
  const svc = new AIContentService(
    prisma as never, cache as never, contextBuilder as never, blueprintExec as never, variation as never,
    explanation as never, validation as never, promptBuilder as never, provider as never, events as never,
  );
  return { svc, prisma, cache, contextBuilder, blueprintExec, variation, validation, provider, events, tx };
}

describe('AIContentService (orchestrator)', () => {
  let m: ReturnType<typeof makeMocks>;
  beforeEach(() => { m = makeMocks(); });

  describe('generateFromLearningObjective', () => {
    it('builds context, generates, validates, and persists with status validated', async () => {
      const result = await m.svc.generateFromLearningObjective({ learningObjectiveId: 'LO-STR-001-003-001', difficultyBand: 'moderate', variantType: 'base', count: 1 } as never, user);
      expect(m.contextBuilder.fromLearningObjective).toHaveBeenCalledWith('LO-STR-001-003-001', 'moderate');
      expect(m.validation.validate).toHaveBeenCalled();
      expect(m.tx.aiGenerationRequest.create).toHaveBeenCalled();
      expect(m.tx.aiGeneratedVariant.create).toHaveBeenCalled();
      expect(m.tx.aiGenerationAuditLog.create).toHaveBeenCalledTimes(2);
      expect(m.cache.invalidatePattern).toHaveBeenCalled();
      expect(result.status).toBe('validated');
    });

    it('uses the variation service for numerical variants', async () => {
      await m.svc.generateFromLearningObjective({ learningObjectiveId: 'LO-STR-001-003-001', difficultyBand: 'moderate', variantType: 'numerical', count: 3 } as never, user);
      expect(m.variation.generateVariants).toHaveBeenCalledWith(ctx, 'numerical', 3, expect.any(String));
    });

    it('persists rejected status when all drafts fail validation', async () => {
      m.validation.validate.mockResolvedValue({ outcome: 'failed', issues: [{ code: 'X', stage: 'structure', message: 'bad', severity: 'error' }], stages: [] });
      const result = await m.svc.generateFromLearningObjective({ learningObjectiveId: 'LO-STR-001-003-001', difficultyBand: 'moderate', variantType: 'base', count: 1 } as never, user);
      expect(result.status).toBe('rejected');
    });
  });

  describe('generateFromBlueprint', () => {
    it('executes the blueprint and persists', async () => {
      const result = await m.svc.generateFromBlueprint({ blueprintId: 'BP-STR-004-002-CMP-001', difficultyBand: 'moderate', count: 1 } as never, user);
      expect(m.blueprintExec.buildContext).toHaveBeenCalledWith('BP-STR-004-002-CMP-001', 'moderate');
      expect(m.blueprintExec.execute).toHaveBeenCalled();
      expect(result.status).toBe('validated');
    });
  });

  describe('generateVariants', () => {
    it('rejects when the source request does not exist', async () => {
      m.prisma.aiGenerationRequest.findFirst.mockResolvedValue(null);
      await expect(m.svc.generateVariants({ sourceRequestId: '00000000-0000-0000-0000-000000000000', variantType: 'numerical', count: 3 } as never, user)).rejects.toThrow(NotFoundException);
    });
    it('re-grounds in the source LO and generates variants', async () => {
      m.prisma.aiGenerationRequest.findFirst.mockResolvedValue({ id: 'src', learningObjectiveId: 'LO-STR-001-003-001', blueprintId: null, difficultyBand: 'moderate' });
      const result = await m.svc.generateVariants({ sourceRequestId: 'src', variantType: 'numerical', count: 2 } as never, user);
      expect(m.contextBuilder.fromLearningObjective).toHaveBeenCalled();
      expect(result.status).toBe('validated');
    });
  });

  describe('promote (state machine)', () => {
    it('promotes a validated generation', async () => {
      m.prisma.aiGenerationRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'validated' });
      m.prisma.aiGeneratedVariant.findFirst.mockResolvedValue({ id: 'v-1', payload: draft, isDuplicate: false, validationOutcome: 'passed' });
      const result = await m.svc.promote('req-1', { variantIndex: 0 } as never, user);
      expect(result.status).toBe('promoted');
      expect(m.events.emit).toHaveBeenCalledWith(expect.stringContaining('promoted'), expect.any(Object));
    });
    it('rejects promotion of a non-validated generation', async () => {
      m.prisma.aiGenerationRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'pending' });
      await expect(m.svc.promote('req-1', { variantIndex: 0 } as never, user)).rejects.toThrow(UnprocessableEntityException);
    });
    it('rejects double promotion', async () => {
      m.prisma.aiGenerationRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'promoted' });
      await expect(m.svc.promote('req-1', { variantIndex: 0 } as never, user)).rejects.toThrow(ConflictException);
    });
    it('rejects promotion of a not-found generation', async () => {
      m.prisma.aiGenerationRequest.findFirst.mockResolvedValue(null);
      await expect(m.svc.promote('req-1', { variantIndex: 0 } as never, user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('enforceQuota', () => {
    it('throws when the daily quota is exhausted', async () => {
      m.prisma.aiGenerationRequest.count.mockResolvedValue(100); // pro tier limit
      await expect(m.svc.generateFromLearningObjective({ learningObjectiveId: 'LO-STR-001-003-001', difficultyBand: 'moderate', variantType: 'base', count: 1 } as never, user)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reads', () => {
    it('findById throws for unknown id', async () => {
      m.prisma.aiGenerationRequest.findFirst.mockResolvedValue(null);
      await expect(m.svc.findById('x')).rejects.toThrow(NotFoundException);
    });
    it('list returns paginated data', async () => {
      m.prisma.aiGenerationRequest.findMany.mockResolvedValue([{ id: 'r-1', kind: 'question_from_lo', status: 'validated', learningObjectiveId: 'LO-STR-001-003-001', blueprintId: null, validationOutcome: 'passed', createdAt: new Date() }]);
      m.prisma.aiGenerationRequest.count.mockResolvedValue(1);
      const result = await m.svc.list({ limit: 20 } as never);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
    });
    it('getAuditLog throws for unknown request', async () => {
      m.prisma.aiGenerationRequest.findFirst.mockResolvedValue(null);
      await expect(m.svc.getAuditLog('x')).rejects.toThrow(NotFoundException);
    });
  });
});
