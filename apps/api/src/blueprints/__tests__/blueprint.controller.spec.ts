import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlueprintController } from '../controllers/blueprint.controller';

const blueprints = { search: vi.fn(), create: vi.fn(), findById: vi.fn(), setStatus: vi.fn(), publish: vi.fn() };
const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' };

describe('BlueprintController', () => {
  let ctrl: BlueprintController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new BlueprintController(blueprints as never); });

  it('delegates all endpoints', async () => {
    Object.values(blueprints).forEach((fn) => fn.mockResolvedValue({}));
    await ctrl.search({ limit: 20 } as never);
    await ctrl.create({ subjectCode: 'STR' } as never, user as never);
    await ctrl.findOne('bp-1');
    await ctrl.submit('bp-1');
    await ctrl.approve('bp-1');
    await ctrl.publish('bp-1', user as never);
    expect(blueprints.create).toHaveBeenCalledWith({ subjectCode: 'STR' }, user);
    expect(blueprints.setStatus).toHaveBeenCalledWith('bp-1', 'in_review', ['draft']);
    expect(blueprints.setStatus).toHaveBeenCalledWith('bp-1', 'approved', ['in_review']);
    expect(blueprints.publish).toHaveBeenCalledWith('bp-1', user);
  });
});
