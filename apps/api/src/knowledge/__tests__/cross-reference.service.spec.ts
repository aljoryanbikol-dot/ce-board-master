/**
 * @file cross-reference.service.spec.ts
 * @module Knowledge/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { CrossReferenceService } from '../services/cross-reference.service';

const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' as const };

const mockPrisma = {
  knowledgeCrossReference: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
};
const mockEvents = { emit: vi.fn() };
const build = () => new CrossReferenceService(mockPrisma as never, mockEvents as never);

describe('CrossReferenceService', () => {
  let svc: CrossReferenceService;
  beforeEach(() => { vi.clearAllMocks(); svc = build(); });

  describe('create', () => {
    it('creates a cross-reference edge', async () => {
      mockPrisma.knowledgeCrossReference.findFirst.mockResolvedValue(null);
      mockPrisma.knowledgeCrossReference.create.mockResolvedValue({ id: 'x-1', referenceType: 'lo_to_formula', fromType: 'learning_objective', fromId: 'lo-1', fromPublicId: 'LO-STR-001-003-001', toType: 'formula', toId: 'f-1', toPublicId: 'ST-F-0015', weight: 1, note: null, createdAt: new Date() });
      const ref = await svc.create({ referenceType: 'lo_to_formula', fromType: 'learning_objective', fromId: 'lo-1', toType: 'formula', toId: 'f-1', weight: 1 } as never, user);
      expect(ref.referenceType).toBe('lo_to_formula');
      expect(mockEvents.emit).toHaveBeenCalledWith('knowledge.xref.created', expect.anything());
    });

    it('rejects a duplicate edge', async () => {
      mockPrisma.knowledgeCrossReference.findFirst.mockResolvedValue({ id: 'existing' });
      const err = await svc.create({ referenceType: 'lo_to_formula', fromType: 'learning_objective', fromId: 'lo-1', toType: 'formula', toId: 'f-1', weight: 1 } as never, user).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('CROSS_REFERENCE_EXISTS');
    });

    it('rejects a prerequisite edge that would create a cycle', async () => {
      mockPrisma.knowledgeCrossReference.findFirst.mockResolvedValue(null);
      // to-node (lo-B) already reaches from-node (lo-A): lo-B → lo-A exists.
      mockPrisma.knowledgeCrossReference.findMany.mockImplementation(async ({ where }: { where: { fromId: string } }) => {
        if (where.fromId === 'lo-B') return [{ toId: 'lo-A' }];
        return [];
      });
      const err = await svc.create({ referenceType: 'lo_prerequisite', fromType: 'learning_objective', fromId: 'lo-A', toType: 'learning_objective', toId: 'lo-B', weight: 1 } as never, user).catch((e) => e);
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect(err.getResponse().code).toBe('CYCLE_DETECTED');
    });

    it('allows a prerequisite edge with no cycle', async () => {
      mockPrisma.knowledgeCrossReference.findFirst.mockResolvedValue(null);
      mockPrisma.knowledgeCrossReference.findMany.mockResolvedValue([]); // to-node reaches nothing
      mockPrisma.knowledgeCrossReference.create.mockResolvedValue({ id: 'x-2', referenceType: 'lo_prerequisite', fromType: 'learning_objective', fromId: 'lo-A', fromPublicId: null, toType: 'learning_objective', toId: 'lo-B', toPublicId: null, weight: 1, note: null, createdAt: new Date() });
      const ref = await svc.create({ referenceType: 'lo_prerequisite', fromType: 'learning_objective', fromId: 'lo-A', toType: 'learning_objective', toId: 'lo-B', weight: 1 } as never, user);
      expect(ref.referenceType).toBe('lo_prerequisite');
    });
  });

  describe('listForEntity', () => {
    it('returns outgoing and incoming edges', async () => {
      mockPrisma.knowledgeCrossReference.findMany
        .mockResolvedValueOnce([{ id: 'o-1', referenceType: 'lo_to_formula', fromType: 'learning_objective', fromId: 'lo-1', fromPublicId: null, toType: 'formula', toId: 'f-1', toPublicId: null, weight: 1, note: null, createdAt: new Date() }])
        .mockResolvedValueOnce([{ id: 'i-1', referenceType: 'blueprint_to_lo', fromType: 'blueprint', fromId: 'bp-1', fromPublicId: null, toType: 'learning_objective', toId: 'lo-1', toPublicId: null, weight: 1, note: null, createdAt: new Date() }]);
      const result = await svc.listForEntity('learning_objective', 'lo-1');
      expect(result.outgoing).toHaveLength(1);
      expect(result.incoming).toHaveLength(1);
    });
  });

  describe('buildGraph', () => {
    it('traverses outgoing edges breadth-first', async () => {
      // lo-1 → f-1 ; f-1 → lo-2
      mockPrisma.knowledgeCrossReference.findMany.mockImplementation(async ({ where }: { where: { fromId: string } }) => {
        if (where.fromId === 'lo-1') return [{ fromId: 'lo-1', toId: 'f-1', toType: 'formula', toPublicId: 'ST-F-0015', referenceType: 'lo_to_formula', weight: 1 }];
        if (where.fromId === 'f-1') return [{ fromId: 'f-1', toId: 'lo-2', toType: 'learning_objective', toPublicId: 'LO-STR-001-003-002', referenceType: 'formula_to_lo', weight: 1 }];
        return [];
      });
      const graph = await svc.buildGraph('learning_objective', 'lo-1');
      expect(graph.nodes.length).toBe(3); // lo-1, f-1, lo-2
      expect(graph.edges.length).toBe(2);
      expect(graph.rootId).toBe('lo-1');
    });

    it('respects the depth cap', async () => {
      mockPrisma.knowledgeCrossReference.findMany.mockResolvedValue([]);
      const graph = await svc.buildGraph('learning_objective', 'lo-1', 1);
      expect(graph.nodes.length).toBe(1);
      expect(graph.edges).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('throws on a missing reference', async () => {
      mockPrisma.knowledgeCrossReference.findUnique.mockResolvedValue(null);
      await expect(svc.remove('ghost')).rejects.toThrow('Cross-reference not found');
    });
    it('deletes an existing reference', async () => {
      mockPrisma.knowledgeCrossReference.findUnique.mockResolvedValue({ id: 'x-1' });
      mockPrisma.knowledgeCrossReference.delete.mockResolvedValue({});
      await svc.remove('x-1');
      expect(mockPrisma.knowledgeCrossReference.delete).toHaveBeenCalledWith({ where: { id: 'x-1' } });
    });
  });
});
