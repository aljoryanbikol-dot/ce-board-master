/**
 * @file knowledge-integration.service.spec.ts
 * @module Knowledge/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeIntegrationService } from '../services/knowledge-integration.service';
import { PublicIdService } from '../services/public-id.service';

const mockPrisma = {
  learningObjective: { findFirst: vi.fn() },
  questionBlueprint: { findMany: vi.fn(), findFirst: vi.fn() },
  misconception: { findFirst: vi.fn(), findMany: vi.fn() },
  formulaLibrary: { findFirst: vi.fn() },
};
const build = () => new KnowledgeIntegrationService(mockPrisma as never, new PublicIdService());

describe('KnowledgeIntegrationService (CMS + Question Bank bridge)', () => {
  let svc: KnowledgeIntegrationService;
  beforeEach(() => { vi.clearAllMocks(); svc = build(); });

  describe('verifyQuestionReferences', () => {
    it('passes when the referenced LO exists', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ status: 'published' });
      const verdict = await svc.verifyQuestionReferences({ learningObjectiveId: 'LO-STR-001-003-001' });
      expect(verdict.valid).toBe(true);
      expect(verdict.checks[0]!.exists).toBe(true);
    });

    it('fails when no LO is referenced at all', async () => {
      const verdict = await svc.verifyQuestionReferences({});
      expect(verdict.valid).toBe(false);
      expect(verdict.errors[0]).toContain('must reference a Learning Objective');
    });

    it('fails on a malformed LO id (without hitting the DB)', async () => {
      const verdict = await svc.verifyQuestionReferences({ learningObjectiveId: 'LO-BAD' });
      expect(verdict.valid).toBe(false);
      expect(mockPrisma.learningObjective.findFirst).not.toHaveBeenCalled();
    });

    it('fails when requirePublished and LO is only approved', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ status: 'approved' });
      const verdict = await svc.verifyQuestionReferences({ learningObjectiveId: 'LO-STR-001-003-001' }, { requirePublished: true });
      expect(verdict.valid).toBe(false);
      expect(verdict.errors.some((e) => e.includes('not published'))).toBe(true);
    });

    it('validates blueprint + misconception references too', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ status: 'published' });
      mockPrisma.questionBlueprint.findFirst.mockResolvedValue({ status: 'published' });
      mockPrisma.misconception.findFirst.mockResolvedValue({ status: 'published' });
      const verdict = await svc.verifyQuestionReferences({ learningObjectiveId: 'LO-STR-001-003-001', blueprintId: 'BP-STR-004-002-CMP-001', misconceptionIds: ['MC-STR-003-002-FRM-001'] });
      expect(verdict.valid).toBe(true);
      expect(verdict.checks).toHaveLength(3);
    });

    it('flags a missing blueprint', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ status: 'published' });
      mockPrisma.questionBlueprint.findFirst.mockResolvedValue(null);
      const verdict = await svc.verifyQuestionReferences({ learningObjectiveId: 'LO-STR-001-003-001', blueprintId: 'BP-STR-004-002-CMP-001' });
      expect(verdict.valid).toBe(false);
      expect(verdict.errors.some((e) => e.includes('does not exist'))).toBe(true);
    });
  });

  describe('resolveLearningObjective', () => {
    it('returns null for a malformed id', async () => {
      expect(await svc.resolveLearningObjective('nope')).toBeNull();
    });
    it('resolves a valid id', async () => {
      mockPrisma.learningObjective.findFirst.mockResolvedValue({ id: 'lo-1', publicId: 'LO-STR-001-003-001', statement: 'x', bloomLevel: 'apply', status: 'published', semver: '1.0.0' });
      const lo = await svc.resolveLearningObjective('LO-STR-001-003-001');
      expect(lo?.publicId).toBe('LO-STR-001-003-001');
    });
  });

  describe('getGenerationContext', () => {
    it('returns published blueprints + misconceptions for a subject', async () => {
      mockPrisma.questionBlueprint.findMany.mockResolvedValue([{ id: 'bp-1', publicId: 'BP-STR-004-002-CMP-001', name: 'X', blueprintType: 'CMP', primaryObjectiveId: null, structure: {} }]);
      mockPrisma.misconception.findMany.mockResolvedValue([{ id: 'mc-1', publicId: 'MC-STR-003-002-FRM-001', title: 'X', category: 'FRM', description: 'y' }]);
      const ctx = await svc.getGenerationContext('STR', '004');
      expect(ctx.blueprints).toHaveLength(1);
      expect(ctx.misconceptions).toHaveLength(1);
      expect(ctx.subjectCode).toBe('STR');
    });
  });
});
