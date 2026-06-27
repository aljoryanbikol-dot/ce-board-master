/**
 * @file payment.service.spec.ts
 * @module Payments/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentProviderType, PaymentStatus } from '@prisma/client';
import { PaymentService } from '../services/payment.service';

const mockPrisma = {
  payment: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  paymentWebhook: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  paymentLog: { create: vi.fn().mockResolvedValue({}) },
};
const mockCache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() };
const mockProvider = { type: 'mock', createPayment: vi.fn(), verifyWebhook: vi.fn(), verifyPayment: vi.fn() };
const mockFactory = { get: vi.fn().mockReturnValue(mockProvider), getDefault: vi.fn().mockReturnValue(mockProvider) };
const mockBilling = { generateInvoiceForPayment: vi.fn().mockResolvedValue({ id: 'inv-1', number: 'INV-2026-000001' }) };
const mockSubscription = { activateAfterPayment: vi.fn().mockResolvedValue({ planName: 'Pro', periodStart: new Date(), periodEnd: new Date() }) };
const mockUserRole = { hasPermission: vi.fn().mockResolvedValue(true) };
const mockEvents = { emit: vi.fn() };

const build = () => new PaymentService(
  mockPrisma as never, mockCache as never, mockFactory as never,
  mockBilling as never, mockSubscription as never, mockUserRole as never, mockEvents as never,
);

const requester = { id: 'user-1', email: 'u@test.com', role: 'subscriber', subscriptionTier: 'free' as const };

describe('PaymentService', () => {
  let service: PaymentService;
  beforeEach(() => { vi.clearAllMocks(); service = build(); mockCache.get.mockResolvedValue(null); });

  describe('createPayment()', () => {
    it('creates a pending payment then a provider checkout', async () => {
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1', userId: 'user-1', status: PaymentStatus.pending });
      mockProvider.createPayment.mockResolvedValue({ providerRef: 'mock_pay-1', checkoutUrl: 'https://co', status: 'pending', raw: {} });
      mockPrisma.payment.update.mockResolvedValue({ id: 'pay-1', userId: 'user-1', status: PaymentStatus.processing, checkoutUrl: 'https://co', providerType: 'mock', methodType: null, amountMinor: 49900, currency: 'PHP', subscriptionId: 'sub-1', paidAt: null, createdAt: new Date() });

      const result = await service.createPayment({
        userId: 'user-1', subscriptionId: 'sub-1', amountMinor: 49900, currency: 'PHP',
        provider: PaymentProviderType.mock, description: 'Pro', customerEmail: 'u@test.com',
        successUrl: 'https://s', cancelUrl: 'https://c',
      });
      expect(result.checkoutUrl).toBe('https://co');
      expect(mockProvider.createPayment).toHaveBeenCalled();
    });

    it('returns existing payment on idempotency-key replay', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-existing', userId: 'user-1', status: 'processing', amountMinor: 49900, currency: 'PHP', providerType: 'mock', methodType: null, checkoutUrl: 'https://co', paidAt: null, createdAt: new Date(), subscriptionId: null });
      const result = await service.createPayment({
        userId: 'user-1', subscriptionId: null, amountMinor: 49900, currency: 'PHP',
        provider: PaymentProviderType.mock, description: 'Pro', customerEmail: 'u@test.com',
        successUrl: 'https://s', cancelUrl: 'https://c', idempotencyKey: 'idem-123',
      });
      expect(result.id).toBe('pay-existing');
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('throws IDEMPOTENCY_CONFLICT when a concurrent reservation exists', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockCache.get.mockResolvedValue('1'); // reserved
      await expect(service.createPayment({
        userId: 'user-1', subscriptionId: null, amountMinor: 49900, currency: 'PHP',
        provider: PaymentProviderType.mock, description: 'Pro', customerEmail: 'u@test.com',
        successUrl: 'https://s', cancelUrl: 'https://c', idempotencyKey: 'idem-x',
      })).rejects.toThrow();
    });
  });

  describe('handleWebhook()', () => {
    const succeededEvent = {
      eventId: 'evt-1', eventType: 'payment.paid', paymentId: 'pay-1', providerRef: 'mock_pay-1',
      outcome: 'succeeded' as const, method: null, payload: {},
    };

    it('processes a successful payment: marks succeeded, activates, invoices, emits', async () => {
      mockProvider.verifyWebhook.mockReturnValue(succeededEvent);
      mockPrisma.paymentWebhook.findUnique.mockResolvedValue(null);
      mockPrisma.paymentWebhook.create.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'user-1', subscriptionId: 'sub-1', status: PaymentStatus.processing, amountMinor: 49900, currency: 'PHP' });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.paymentWebhook.update.mockResolvedValue({});

      const result = await service.handleWebhook(PaymentProviderType.mock, '{}', 'sig');
      expect(result.status).toBe('processed');
      expect(mockSubscription.activateAfterPayment).toHaveBeenCalledWith('sub-1');
      expect(mockBilling.generateInvoiceForPayment).toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith('payment.completed', expect.anything());
    });

    it('ignores a duplicate webhook (replay protection)', async () => {
      mockProvider.verifyWebhook.mockReturnValue(succeededEvent);
      mockPrisma.paymentWebhook.findUnique.mockResolvedValue({ id: 'wh-existing' });
      mockPrisma.paymentWebhook.create.mockResolvedValue({ id: 'wh-dup' });

      const result = await service.handleWebhook(PaymentProviderType.mock, '{}', 'sig');
      expect(result.status).toBe('duplicate');
      expect(mockSubscription.activateAfterPayment).not.toHaveBeenCalled();
    });

    it('records invalid_signature and throws on bad signature', async () => {
      mockProvider.verifyWebhook.mockImplementation(() => { throw new Error('bad sig'); });
      mockPrisma.paymentWebhook.create.mockResolvedValue({ id: 'wh-invalid' });
      await expect(service.handleWebhook(PaymentProviderType.mock, '{}', 'bad')).rejects.toThrow();
      expect(mockPrisma.paymentWebhook.create).toHaveBeenCalled();
    });

    it('handles a failed payment outcome', async () => {
      mockProvider.verifyWebhook.mockReturnValue({ ...succeededEvent, outcome: 'failed', eventType: 'payment.failed' });
      mockPrisma.paymentWebhook.findUnique.mockResolvedValue(null);
      mockPrisma.paymentWebhook.create.mockResolvedValue({ id: 'wh-2' });
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'user-1', subscriptionId: null, status: PaymentStatus.processing, amountMinor: 49900, currency: 'PHP' });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.paymentWebhook.update.mockResolvedValue({});

      const result = await service.handleWebhook(PaymentProviderType.mock, '{}', 'sig');
      expect(result.status).toBe('processed');
      expect(mockEvents.emit).toHaveBeenCalledWith('payment.failed', expect.anything());
    });

    it('returns payment_not_found when the event references an unknown payment', async () => {
      mockProvider.verifyWebhook.mockReturnValue({ ...succeededEvent, paymentId: null, providerRef: null });
      mockPrisma.paymentWebhook.findUnique.mockResolvedValue(null);
      mockPrisma.paymentWebhook.create.mockResolvedValue({ id: 'wh-3' });
      mockPrisma.paymentWebhook.update.mockResolvedValue({});

      const result = await service.handleWebhook(PaymentProviderType.mock, '{}', 'sig');
      expect(result.status).toBe('payment_not_found');
    });
  });

  describe('getById()', () => {
    it('enforces ownership', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'other-user' });
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.getById(requester, 'pay-1')).rejects.toThrow();
    });

    it('allows the owner', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'user-1', amountMinor: 49900, currency: 'PHP', status: 'succeeded', providerType: 'mock', methodType: 'gcash', checkoutUrl: null, paidAt: new Date(), createdAt: new Date(), subscriptionId: null });
      const result = await service.getById(requester, 'pay-1');
      expect(result.id).toBe('pay-1');
    });
  });
});
