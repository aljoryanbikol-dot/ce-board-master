import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MisconceptionController } from '../controllers/misconception.controller';

const misconceptions = { search: vi.fn(), create: vi.fn(), findById: vi.fn(), setStatus: vi.fn(), publish: vi.fn() };
const user = { id: 'u-1', email: 'a@b.com', role: 'content_admin', subscriptionTier: 'pro' };

describe('MisconceptionController', () => {
  let ctrl: MisconceptionController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new MisconceptionController(misconceptions as never); });

  it('delegates all endpoints', async () => {
    Object.values(misconceptions).forEach((fn) => fn.mockResolvedValue({}));
    await ctrl.search({ limit: 20 } as never);
    await ctrl.create({ subjectCode: 'STR' } as never, user as never);
    await ctrl.findOne('mc-1');
    await ctrl.submit('mc-1');
    await ctrl.approve('mc-1');
    await ctrl.publish('mc-1', user as never);
    expect(misconceptions.create).toHaveBeenCalledWith({ subjectCode: 'STR' }, user);
    expect(misconceptions.setStatus).toHaveBeenCalledWith('mc-1', 'in_review', ['draft']);
    expect(misconceptions.setStatus).toHaveBeenCalledWith('mc-1', 'approved', ['in_review']);
    expect(misconceptions.publish).toHaveBeenCalledWith('mc-1', user);
  });
});
