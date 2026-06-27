/**
 * @file subscription.service.spec.ts
 * @module Subscriptions/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionStatus, PlanInterval } from '@prisma/client';
import { SubscriptionService } from '../services/subscription.service';

const freePlan = { id: 'plan-free', name: 'Free', interval: PlanInterval.free, priceMinor: 0, currency: 'PHP', durationDays: null, trialDays: 0, isActive: true };
const monthlyPlan = { id: 'plan-monthly', name: 'Pro Monthly', interval: PlanInterval.monthly, priceMinor: 49900, currency: 'PHP', durationDays: 30, trialDays: 0, isActive: true };
const annualPlan = { id: 'plan-annual', name: 'Pro Annual', interval: PlanInterval.annual, priceMinor: 479900, currency: 'PHP', durationDays: 365, trialDays: 0, isActive: true };

const mockPrisma = {
  subscription: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
};
const mockCache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() };
const mockPlanService = { getRawById: vi.fn() };
const mockPaymentService = { createPayment: vi.fn().mockResolvedValue({ id: 'pay-1', checkoutUrl: 'https://co' }) };
const mockUserRole = { hasPermission: vi.fn().mockResolvedValue(true) };
const mockConfig = { get: vi.fn((k: string) => (k === 'PAYMENT_GRACE_PERIOD_DAYS' ? 3 : k === 'PAYMENT_DEFAULT_PROVIDER' ? 'mock' : 'https://app')) };
const mockEvents = { emit: vi.fn() };

const build = () => new SubscriptionService(
  mockPrisma as never, mockCache as never, mockPlanService as never, mockPaymentService as never,
  mockUserRole as never, mockConfig as never, mockEvents as never,
);

const user = { id: 'user-1', email: 'u@test.com', role: 'subscriber', subscriptionTier: 'free' as const };

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  beforeEach(() => { vi.clearAllMocks(); service = build(); mockCache.get.mockResolvedValue(null); });

  describe('subscribe()', () => {
    it('activates a free plan immediately with no payment', async () => {
      mockPlanService.getRawById.mockResolvedValue(freePlan);
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-free', status: SubscriptionStatus.active, currentPeriodStart: new Date(), currentPeriodEnd: null, trialEndsAt: null, cancelAtPeriodEnd: false, autoRenew: false, version: 0 });

      const result = await service.subscribe(user, { planId: 'plan-free' });
      expect(result.payment).toBeNull();
      expect(mockPaymentService.createPayment).not.toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith('subscription.activated', expect.anything());
    });

    it('creates a payment + checkout for a paid plan', async () => {
      mockPlanService.getRawById.mockResolvedValue(monthlyPlan);
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-2', userId: 'user-1', planId: 'plan-monthly', status: SubscriptionStatus.trialing, currentPeriodStart: null, currentPeriodEnd: null, trialEndsAt: null, cancelAtPeriodEnd: false, autoRenew: true, version: 0 });

      const result = await service.subscribe(user, { planId: 'plan-monthly', provider: 'mock' });
      expect(result.payment).not.toBeNull();
      expect(mockPaymentService.createPayment).toHaveBeenCalled();
    });

    it('blocks subscribing when already subscribed', async () => {
      mockPlanService.getRawById.mockResolvedValue(monthlyPlan);
      mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'existing', status: SubscriptionStatus.active });
      await expect(service.subscribe(user, { planId: 'plan-monthly' })).rejects.toThrow();
    });

    it('rejects an inactive plan', async () => {
      mockPlanService.getRawById.mockResolvedValue({ ...monthlyPlan, isActive: false });
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      await expect(service.subscribe(user, { planId: 'plan-monthly' })).rejects.toThrow();
    });
  });

  describe('changePlan()', () => {
    it('upgrade charges immediately and stashes pending plan', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', status: SubscriptionStatus.active, currentPeriodStart: new Date(), currentPeriodEnd: new Date(), trialEndsAt: null, cancelAtPeriodEnd: false, autoRenew: true, version: 0 });
      mockPlanService.getRawById.mockImplementation((id: string) => Promise.resolve(id === 'plan-annual' ? annualPlan : monthlyPlan));
      mockPrisma.subscription.update.mockResolvedValue({});

      const result = await service.changePlan(user, { planId: 'plan-annual' });
      expect(result.payment).not.toBeNull();
      expect(mockPaymentService.createPayment).toHaveBeenCalled();
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ providerRef: 'pending_upgrade:plan-annual' }) }));
    });

    it('downgrade switches at period end with no charge', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-annual', status: SubscriptionStatus.active, currentPeriodStart: new Date(), currentPeriodEnd: new Date(), trialEndsAt: null, cancelAtPeriodEnd: false, autoRenew: true, version: 0 });
      mockPlanService.getRawById.mockImplementation((id: string) => Promise.resolve(id === 'plan-annual' ? annualPlan : monthlyPlan));
      mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', status: SubscriptionStatus.active, currentPeriodStart: new Date(), currentPeriodEnd: new Date(), trialEndsAt: null, cancelAtPeriodEnd: false, autoRenew: true, version: 1 });

      const result = await service.changePlan(user, { planId: 'plan-monthly' });
      expect(result.payment).toBeNull();
      expect(mockPaymentService.createPayment).not.toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith('subscription.changed', expect.objectContaining({ direction: 'downgrade' }));
    });

    it('rejects changing to the same plan', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', status: SubscriptionStatus.active });
      await expect(service.changePlan(user, { planId: 'plan-monthly' })).rejects.toThrow();
    });

    it('rejects when there is no active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      await expect(service.changePlan(user, { planId: 'plan-annual' })).rejects.toThrow();
    });
  });

  describe('cancel()', () => {
    it('cancels at period end by default', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', status: SubscriptionStatus.active });
      mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', status: SubscriptionStatus.active, cancelAtPeriodEnd: true, autoRenew: false, currentPeriodStart: new Date(), currentPeriodEnd: new Date(), trialEndsAt: null, version: 1 });

      const result = await service.cancel(user, { atPeriodEnd: true });
      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockEvents.emit).toHaveBeenCalledWith('subscription.canceled', expect.anything());
    });

    it('cancels immediately when atPeriodEnd is false', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', status: SubscriptionStatus.active });
      mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', status: SubscriptionStatus.canceled, cancelAtPeriodEnd: false, autoRenew: false, currentPeriodStart: new Date(), currentPeriodEnd: new Date(), trialEndsAt: null, version: 1 });

      const result = await service.cancel(user, { atPeriodEnd: false });
      expect(result.status).toBe('canceled');
    });
  });

  describe('renew()', () => {
    it('extends the period and emits renewed', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', currentPeriodEnd: new Date(Date.now() - 1000) });
      mockPlanService.getRawById.mockResolvedValue(monthlyPlan);
      mockPrisma.subscription.update.mockResolvedValue({});

      const result = await service.renew('sub-1');
      expect(result.planName).toBe('Pro Monthly');
      expect(mockEvents.emit).toHaveBeenCalledWith('subscription.renewed', expect.anything());
    });
  });

  describe('expireDue()', () => {
    it('moves auto-renew subs past period end to past_due with grace', async () => {
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([])                                   // direct-expire (autoRenew false)
        .mockResolvedValueOnce([{ id: 'sub-1', userId: 'user-1' }])  // to past_due
        .mockResolvedValueOnce([]);                                  // grace-elapsed
      mockPrisma.subscription.update.mockResolvedValue({});

      const result = await service.expireDue(new Date());
      expect(result.pastDue).toBe(1);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: SubscriptionStatus.past_due }) }));
    });

    it('expires grace-elapsed subscriptions and emits expired', async () => {
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'sub-2', userId: 'user-2' }]);
      mockPrisma.subscription.update.mockResolvedValue({});

      const result = await service.expireDue(new Date());
      expect(result.expired).toBe(1);
      expect(mockEvents.emit).toHaveBeenCalledWith('subscription.expired', expect.anything());
    });
  });

  describe('activateAfterPayment()', () => {
    it('activates and computes the period', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', providerRef: null });
      mockPlanService.getRawById.mockResolvedValue(monthlyPlan);
      mockPrisma.subscription.update.mockResolvedValue({});

      const result = await service.activateAfterPayment('sub-1');
      expect(result.planName).toBe('Pro Monthly');
      expect(result.periodEnd).toBeInstanceOf(Date);
      expect(mockEvents.emit).toHaveBeenCalledWith('subscription.activated', expect.anything());
    });

    it('applies a pending upgrade encoded in providerRef', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', providerRef: 'pending_upgrade:plan-annual' });
      mockPlanService.getRawById.mockResolvedValue(annualPlan);
      mockPrisma.subscription.update.mockResolvedValue({});

      await service.activateAfterPayment('sub-1');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ planId: 'plan-annual' }) }));
    });
  });
});
