/**
 * @file subscription.controller.spec.ts
 * @module Subscriptions/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController, PlanController } from '../controllers/subscription.controller';
import { SubscriptionService } from '../services/subscription.service';
import { PlanService } from '../services/plan.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const mockSub = { getMySubscription: vi.fn(), subscribe: vi.fn(), changePlan: vi.fn(), cancel: vi.fn(), getById: vi.fn() };
const mockPlan = { listActive: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), softDelete: vi.fn() };
const user = { id: 'user-1', email: 'u@test.com', role: 'subscriber', subscriptionTier: 'free' };
const allow = { canActivate: () => true };

async function build() {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [SubscriptionController, PlanController],
    providers: [
      { provide: SubscriptionService, useValue: mockSub },
      { provide: PlanService, useValue: mockPlan },
    ],
  })
    .overrideGuard(JwtAuthGuard).useValue(allow)
    .overrideGuard(RolesGuard).useValue(allow)
    .overrideGuard(PermissionGuard).useValue(allow)
    .compile();
  return { sub: moduleRef.get(SubscriptionController), plan: moduleRef.get(PlanController) };
}

describe('SubscriptionController', () => {
  let sub: SubscriptionController;
  let plan: PlanController;
  beforeEach(async () => { vi.clearAllMocks(); ({ sub, plan } = await build()); });

  it('getMine delegates to service', async () => {
    mockSub.getMySubscription.mockResolvedValue({ id: 'sub-1' });
    await sub.getMine(user as never);
    expect(mockSub.getMySubscription).toHaveBeenCalledWith(user);
  });

  it('subscribe delegates with body', async () => {
    mockSub.subscribe.mockResolvedValue({ subscription: {}, payment: null });
    await sub.subscribe(user as never, { planId: 'plan-1' } as never);
    expect(mockSub.subscribe).toHaveBeenCalledWith(user, { planId: 'plan-1' });
  });

  it('changePlan delegates with body', async () => {
    mockSub.changePlan.mockResolvedValue({ subscription: {}, payment: null });
    await sub.changePlan(user as never, { planId: 'plan-2' } as never);
    expect(mockSub.changePlan).toHaveBeenCalled();
  });

  it('cancel delegates with body', async () => {
    mockSub.cancel.mockResolvedValue({ id: 'sub-1', status: 'active', cancelAtPeriodEnd: true });
    await sub.cancel(user as never, { atPeriodEnd: true } as never);
    expect(mockSub.cancel).toHaveBeenCalledWith(user, { atPeriodEnd: true });
  });

  it('PlanController.list delegates', async () => {
    mockPlan.listActive.mockResolvedValue([]);
    await plan.list();
    expect(mockPlan.listActive).toHaveBeenCalled();
  });

  it('PlanController.create delegates', async () => {
    mockPlan.create.mockResolvedValue({ id: 'plan-1' });
    await plan.create({ name: 'X', slug: 'x', tier: 'pro', interval: 'monthly', priceMinor: 1, currency: 'PHP', trialDays: 0, features: [], sortOrder: 0 } as never);
    expect(mockPlan.create).toHaveBeenCalled();
  });
});
