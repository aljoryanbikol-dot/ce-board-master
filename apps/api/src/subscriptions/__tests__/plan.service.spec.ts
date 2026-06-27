/**
 * @file plan.service.spec.ts
 * @module Subscriptions/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanService } from '../services/plan.service';

const planRow = { id: 'plan-1', name: 'Pro Monthly', slug: 'pro_monthly', tier: 'pro', interval: 'monthly', priceMinor: 49900, currency: 'PHP', durationDays: 30, trialDays: 7, features: ['ai_tutor'], isActive: true, sortOrder: 10, deletedAt: null };

const mockPrisma = {
  subscriptionPlan: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
};
const mockCache = {
  remember: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  del: vi.fn(),
};

const build = () => new PlanService(mockPrisma as never, mockCache as never);

describe('PlanService', () => {
  let service: PlanService;
  beforeEach(() => { vi.clearAllMocks(); service = build(); });

  it('listActive returns mapped active plans (through cache.remember)', async () => {
    mockPrisma.subscriptionPlan.findMany.mockResolvedValue([planRow]);
    const result = await service.listActive();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('pro_monthly');
    expect(mockCache.remember).toHaveBeenCalled();
  });

  it('getById throws when not found', async () => {
    mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(null);
    await expect(service.getById('ghost')).rejects.toThrow();
  });

  it('create rejects a duplicate slug', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ name: 'X', slug: 'pro_monthly', tier: 'pro', interval: 'monthly', priceMinor: 1, currency: 'PHP', trialDays: 0, features: [], sortOrder: 0 })).rejects.toThrow();
  });

  it('create persists and invalidates the plan cache', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
    mockPrisma.subscriptionPlan.create.mockResolvedValue(planRow);
    await service.create({ name: 'Pro Monthly', slug: 'pro_monthly', tier: 'pro', interval: 'monthly', priceMinor: 49900, currency: 'PHP', trialDays: 7, features: ['ai_tutor'], sortOrder: 10 });
    expect(mockCache.del).toHaveBeenCalled();
  });

  it('update invalidates the plan cache', async () => {
    mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(planRow);
    mockPrisma.subscriptionPlan.update.mockResolvedValue({ ...planRow, priceMinor: 59900 });
    const result = await service.update('plan-1', { priceMinor: 59900 });
    expect(result.priceMinor).toBe(59900);
    expect(mockCache.del).toHaveBeenCalled();
  });

  it('softDelete sets deletedAt + isActive false', async () => {
    mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(planRow);
    mockPrisma.subscriptionPlan.update.mockResolvedValue({});
    await service.softDelete('plan-1');
    expect(mockPrisma.subscriptionPlan.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
  });
});
