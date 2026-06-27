import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LearningObjectiveController } from '../controllers/learning-objective.controller';

const los = { search: vi.fn(), create: vi.fn(), findByPublicId: vi.fn(), findById: vi.fn(), update: vi.fn(), submitForReview: vi.fn(), approve: vi.fn(), publish: vi.fn(), getVersions: vi.fn() };
const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' };

describe('LearningObjectiveController', () => {
  let ctrl: LearningObjectiveController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new LearningObjectiveController(los as never); });

  it('delegates all endpoints', async () => {
    Object.values(los).forEach((fn) => fn.mockResolvedValue({}));
    await ctrl.search({ limit: 20 } as never);
    await ctrl.create({ subjectCode: 'STR' } as never, user as never);
    await ctrl.byPublicId('LO-STR-001-003-001');
    await ctrl.findOne('lo-1');
    await ctrl.update('lo-1', { statement: 'x' } as never, user as never);
    await ctrl.submit('lo-1');
    await ctrl.approve('lo-1');
    await ctrl.publish('lo-1', user as never);
    await ctrl.versions('lo-1');
    expect(los.create).toHaveBeenCalledWith({ subjectCode: 'STR' }, user);
    expect(los.findByPublicId).toHaveBeenCalledWith('LO-STR-001-003-001');
    expect(los.publish).toHaveBeenCalledWith('lo-1', user);
  });
});
