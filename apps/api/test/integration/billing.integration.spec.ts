/**
 * @file billing.integration.spec.ts
 * @module Billing/Tests/Integration
 *
 * Cross-service integration: the full webhook → activate → invoice pipeline,
 * wired through the Nest DI container with mocked Prisma/Cache/Events but REAL
 * PaymentService + SubscriptionService + BillingService + PlanService +
 * PaymentProviderFactory + MockPaymentProvider.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentProviderType, PaymentStatus, SubscriptionStatus, PlanInterval } from '@prisma/client';
import { PaymentService } from '../../src/payments/services/payment.service';
import { PaymentProviderFactory } from '../../src/payments/services/payment-provider.factory';
import { MockPaymentProvider } from '../../src/payments/providers/mock-payment.provider';
import { SubscriptionService } from '../../src/subscriptions/services/subscription.service';
import { PlanService } from '../../src/subscriptions/services/plan.service';
import { BillingService } from '../../src/billing/services/billing.service';
import { PrismaService } from '../../src/database/prisma.service';
import { CacheService } from '../../src/cache/cache.service';
import { UserRoleService } from '../../src/rbac/services/user-role.service';
import { PAYMENT_PROVIDERS } from '../../src/payments/types/payment-provider.interface';

const monthlyPlan = { id: 'plan-monthly', name: 'Pro Monthly', interval: PlanInterval.monthly, priceMinor: 49900, currency: 'PHP', durationDays: 30, trialDays: 0, isActive: true };

const db = {
  payment: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  paymentWebhook: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  paymentLog: { create: vi.fn().mockResolvedValue({}) },
  subscription: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  subscriptionPlan: { findFirst: vi.fn() },
  invoice: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
};
const cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), remember: vi.fn() };
const userRole = { hasPermission: vi.fn().mockResolvedValue(true) };
const config = { get: vi.fn((k: string) => (k === 'PAYMENT_DEFAULT_PROVIDER' ? 'mock' : k === 'PAYMENT_GRACE_PERIOD_DAYS' ? 3 : 'https://app')) };
const emitted: string[] = [];

describe('Billing webhook pipeline integration', () => {
  let payments: PaymentService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService, SubscriptionService, PlanService, BillingService, PaymentProviderFactory,
        MockPaymentProvider,
        { provide: PAYMENT_PROVIDERS, useFactory: (m: MockPaymentProvider) => [m], inject: [MockPaymentProvider] },
        { provide: PrismaService, useValue: db },
        { provide: CacheService, useValue: cache },
        { provide: UserRoleService, useValue: userRole },
        { provide: ConfigService, useValue: config },
        { provide: EventEmitter2, useValue: { emit: (e: string) => { emitted.push(e); return true; } } },
      ],
    }).compile();

    payments = moduleRef.get(PaymentService);
  });

  beforeEach(() => { vi.clearAllMocks(); emitted.length = 0; cache.get.mockResolvedValue(null); });

  it('a valid succeeded webhook activates the subscription and generates an invoice', async () => {
    // Arrange: a processing payment linked to a trialing subscription
    db.paymentWebhook.findUnique.mockResolvedValue(null);
    db.paymentWebhook.create.mockResolvedValue({ id: 'wh-1' });
    db.paymentWebhook.update.mockResolvedValue({});
    db.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'user-1', subscriptionId: 'sub-1', status: PaymentStatus.processing, amountMinor: 49900, currency: 'PHP' });
    db.payment.update.mockResolvedValue({});
    db.subscription.findUnique.mockResolvedValue({ id: 'sub-1', userId: 'user-1', planId: 'plan-monthly', providerRef: null });
    db.subscriptionPlan.findFirst.mockResolvedValue(monthlyPlan);
    db.subscription.update.mockResolvedValue({});
    db.invoice.findUnique.mockResolvedValue(null);
    db.invoice.count.mockResolvedValue(0);
    db.invoice.create.mockResolvedValue({ id: 'inv-1', number: 'INV-2026-000001' });

    // Build a correctly-signed mock webhook
    const body = JSON.stringify({ id: 'evt-1', type: 'payment.paid', data: { paymentId: 'pay-1', providerRef: 'mock_pay-1' } });
    const signature = MockPaymentProvider.sign(body);

    // Act
    const result = await payments.handleWebhook(PaymentProviderType.mock, body, signature);

    // Assert
    expect(result.status).toBe('processed');
    expect(db.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: SubscriptionStatus.active }) }));
    expect(db.invoice.create).toHaveBeenCalled();
    expect(emitted).toContain('subscription.activated');
    expect(emitted).toContain('payment.completed');
    expect(emitted).toContain('invoice.generated');
  });

  it('a duplicate webhook short-circuits without re-activating', async () => {
    db.paymentWebhook.findUnique.mockResolvedValue({ id: 'wh-existing' });
    db.paymentWebhook.create.mockResolvedValue({ id: 'wh-dup' });

    const body = JSON.stringify({ id: 'evt-1', type: 'payment.paid', data: { paymentId: 'pay-1' } });
    const signature = MockPaymentProvider.sign(body);

    const result = await payments.handleWebhook(PaymentProviderType.mock, body, signature);
    expect(result.status).toBe('duplicate');
    expect(db.subscription.update).not.toHaveBeenCalled();
  });

  it('an invalid signature is rejected and recorded', async () => {
    db.paymentWebhook.create.mockResolvedValue({ id: 'wh-invalid' });
    const body = JSON.stringify({ id: 'evt-2', type: 'payment.paid' });
    await expect(payments.handleWebhook(PaymentProviderType.mock, body, 'wrong-signature')).rejects.toThrow();
    expect(db.paymentWebhook.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ signatureValid: false }) }));
  });
});
