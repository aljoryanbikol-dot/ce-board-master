import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContextBuilderService } from '../services/context-builder.service';
import { PublicIdService } from '../../knowledge/services/public-id.service';
import { DifficultyScalingService } from '../services/difficulty-scaling.service';

const mockPrisma = {
  learningObjective: { findFirst: vi.fn() },
  questionBlueprint: { findFirst: vi.fn() },
  subject: { findFirst: vi.fn() },
  formulaLibrary: { findMany: vi.fn() },
};
const mockKnowledge = { getGenerationContext: vi.fn() };
const build = () => new ContextBuilderService(mockPrisma as never, mockKnowledge as never, new PublicIdService(), new DifficultyScalingService());

describe('ContextBuilderService (KB grounding chokepoint)', () => {
  let svc: ContextBuilderService;
  beforeEach(() => {
    vi.clearAllMocks();
    svc = build();
    mockKnowledge.getGenerationContext.mockResolvedValue({ blueprints: [], misconceptions: [{ id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'X', category: 'FRM', description: 'y' }] });
    mockPrisma.subject.findFirst.mockResolvedValue({ id: 's-1' });
    mockPrisma.formulaLibrary.findMany.mockResolvedValue([{ id: 'f-1', name: 'Normal Stress Equation', expressionText: 'σ = P/A' }]);
  });

  describe('fromLearningObjective', () => {
    it('builds a grounded context from a published LO', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'Compute stress.', bloomLevel: 'apply', subjectCode: 'STR', topicCode: '001', status: 'published' });
      const ctx = await svc.fromLearningObjective('LO-STR-001-003-001', 'moderate');
      expect(ctx.learningObjective?.publicId).toBe('LO-STR-001-003-001');
      expect(ctx.formulas).toHaveLength(1);
      expect(ctx.misconceptions).toHaveLength(1);
    });
    it('rejects a malformed LO id', async () => {
      await expect(svc.fromLearningObjective('BAD', 'moderate')).rejects.toThrow(NotFoundException);
    });
    it('rejects an unpublished LO', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'x', bloomLevel: 'apply', subjectCode: 'STR', topicCode: '001', status: 'draft' });
      await expect(svc.fromLearningObjective('LO-STR-001-003-001', 'moderate')).rejects.toThrow(UnprocessableEntityException);
    });
    it('rejects a missing LO', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue(null);
      await expect(svc.fromLearningObjective('LO-STR-001-003-001', 'moderate')).rejects.toThrow(NotFoundException);
    });
  });

  describe('fromBlueprint', () => {
    it('builds a grounded context from a published blueprint + its primary LO', async () => {
      mockPrisma.questionBlueprint.findFirst.mockResolvedValue({ id: 'bp-1', publicId: 'BP-STR-004-002-CMP-001', name: 'Axial stress', blueprintType: 'CMP', structure: {}, subjectCode: 'STR', topicCode: '004', status: 'published', primaryObjectiveId: 'lo-1', difficultyBand: 'difficult' });
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'x', bloomLevel: 'apply', subjectCode: 'STR' });
      const ctx = await svc.fromBlueprint('BP-STR-004-002-CMP-001', 'moderate');
      expect(ctx.blueprint?.publicId).toBe('BP-STR-004-002-CMP-001');
      expect(ctx.learningObjective?.id).toBe('lo-1');
    });
    it('rejects an unpublished blueprint', async () => {
      mockPrisma.questionBlueprint.findFirst.mockResolvedValue({ id: 'bp-1', publicId: 'BP-STR-004-002-CMP-001', name: 'x', blueprintType: 'CMP', structure: {}, subjectCode: 'STR', topicCode: '004', status: 'draft', primaryObjectiveId: null, difficultyBand: null });
      await expect(svc.fromBlueprint('BP-STR-004-002-CMP-001', 'moderate')).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
