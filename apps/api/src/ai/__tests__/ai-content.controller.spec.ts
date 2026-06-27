/**
 * @file ai-content.controller.spec.ts
 * @module AI/Tests
 *
 * Direct-instantiation controller test (esbuild has no DI metadata). Verifies
 * each endpoint delegates to AIContentService with the right arguments.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIContentController } from '../controllers/ai-content.controller';
import type { AuthenticatedUser } from '../../auth/auth.types';

const user: AuthenticatedUser = { id: 'u-1', email: 'a@b.com', role: 'content_author', subscriptionTier: 'pro' } as never;

describe('AIContentController', () => {
  const ai = {
    generateFromLearningObjective: vi.fn().mockResolvedValue({ requestId: 'r-1' }),
    generateFromBlueprint: vi.fn().mockResolvedValue({ requestId: 'r-2' }),
    generateVariants: vi.fn().mockResolvedValue({ requestId: 'r-3' }),
    promote: vi.fn().mockResolvedValue({ id: 'r-1', status: 'promoted' }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    findById: vi.fn().mockResolvedValue({ id: 'r-1' }),
    getAuditLog: vi.fn().mockResolvedValue([]),
  };
  let controller: AIContentController;
  beforeEach(() => { vi.clearAllMocks(); controller = new AIContentController(ai as never); });

  it('delegates from-learning-objective', async () => {
    await controller.fromLo({ learningObjectiveId: 'LO-STR-001-003-001' } as never, user);
    expect(ai.generateFromLearningObjective).toHaveBeenCalledWith({ learningObjectiveId: 'LO-STR-001-003-001' }, user);
  });
  it('delegates from-blueprint', async () => {
    await controller.fromBlueprint({ blueprintId: 'BP-STR-004-002-CMP-001' } as never, user);
    expect(ai.generateFromBlueprint).toHaveBeenCalledWith({ blueprintId: 'BP-STR-004-002-CMP-001' }, user);
  });
  it('delegates variants', async () => {
    await controller.variants({ sourceRequestId: 'r-1', variantType: 'numerical' } as never, user);
    expect(ai.generateVariants).toHaveBeenCalled();
  });
  it('delegates promote with id + body + user', async () => {
    await controller.promote('r-1', { variantIndex: 0 } as never, user);
    expect(ai.promote).toHaveBeenCalledWith('r-1', { variantIndex: 0 }, user);
  });
  it('delegates list', async () => {
    await controller.list({ limit: 20 } as never);
    expect(ai.list).toHaveBeenCalled();
  });
  it('delegates findOne', async () => {
    await controller.findOne('r-1');
    expect(ai.findById).toHaveBeenCalledWith('r-1');
  });
  it('delegates audit-log', async () => {
    await controller.auditLog('r-1');
    expect(ai.getAuditLog).toHaveBeenCalledWith('r-1');
  });
});
