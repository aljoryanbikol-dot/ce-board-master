import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormulaController } from '../controllers/formula.controller';

const formulas = { search: vi.fn(), create: vi.fn(), findById: vi.fn(), update: vi.fn(), deactivate: vi.fn() };
const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' };

describe('FormulaController', () => {
  let ctrl: FormulaController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new FormulaController(formulas as never); });

  it('delegates all endpoints', async () => {
    Object.values(formulas).forEach((fn) => fn.mockResolvedValue({}));
    await ctrl.search({ limit: 20 } as never);
    await ctrl.create({ name: 'Stress' } as never, user as never);
    await ctrl.findOne('f-1');
    await ctrl.update('f-1', { name: 'Updated' } as never, user as never);
    await ctrl.deactivate('f-1');
    expect(formulas.create).toHaveBeenCalledWith({ name: 'Stress' }, user);
    expect(formulas.update).toHaveBeenCalledWith('f-1', { name: 'Updated' }, user);
    expect(formulas.deactivate).toHaveBeenCalledWith('f-1');
  });
});
