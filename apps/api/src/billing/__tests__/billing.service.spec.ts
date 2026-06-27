/**
 * @file billing.service.spec.ts
 * @module Billing/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from '../services/billing.service';

const mockPrisma = {
  invoice: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
};
const mockUserRole = { hasPermission: vi.fn().mockResolvedValue(true) };
const mockEvents = { emit: vi.fn() };

const build = () => new BillingService(mockPrisma as never, mockUserRole as never, mockEvents as never);

const requester = { id: 'user-1', email: 'u@test.com', role: 'subscriber', subscriptionTier: 'free' as const };

const genInput = {
  userId: 'user-1', subscriptionId: 'sub-1', paymentId: 'pay-1', planName: 'Pro Monthly',
  amountMinor: 49900, currency: 'PHP', periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
};

describe('BillingService', () => {
  let service: BillingService;
  beforeEach(() => { vi.clearAllMocks(); service = build(); });

  describe('generateInvoiceForPayment()', () => {
    it('creates a sequential paid invoice and emits invoice.generated', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1', number: 'INV-2026-000001' });

      const result = await service.generateInvoiceForPayment(genInput);
      expect(result.number).toBe('INV-2026-000001');
      expect(mockEvents.emit).toHaveBeenCalledWith('invoice.generated', expect.anything());
    });

    it('is idempotent — returns existing invoice for the payment', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: 'inv-existing', number: 'INV-2026-000009' });
      const result = await service.generateInvoiceForPayment(genInput);
      expect(result.number).toBe('INV-2026-000009');
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('pads the sequence number correctly', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      mockPrisma.invoice.count.mockResolvedValue(41);
      mockPrisma.invoice.create.mockImplementation(({ data }: { data: { number: string } }) => Promise.resolve({ id: 'inv-x', number: data.number }));
      const result = await service.generateInvoiceForPayment(genInput);
      expect(result.number).toMatch(/INV-\d{4}-000042/);
    });
  });

  describe('getById()', () => {
    it('enforces ownership', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', userId: 'other' });
      mockUserRole.hasPermission.mockResolvedValue(false);
      await expect(service.getById(requester, 'inv-1')).rejects.toThrow();
    });

    it('returns the invoice for the owner', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', userId: 'user-1', number: 'INV-2026-000001', subscriptionId: 'sub-1', status: 'paid', subtotalMinor: 49900, taxMinor: 0, totalMinor: 49900, currency: 'PHP', lineItems: [], receiptUrl: 'https://r', issuedAt: new Date(), paidAt: new Date(), createdAt: new Date() });
      const result = await service.getById(requester, 'inv-1');
      expect(result.number).toBe('INV-2026-000001');
    });
  });

  describe('listForUser()', () => {
    it('returns a paginated list for the owner', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-1', userId: 'user-1', number: 'INV-2026-000001', subscriptionId: null, status: 'paid', subtotalMinor: 49900, taxMinor: 0, totalMinor: 49900, currency: 'PHP', lineItems: [], receiptUrl: null, issuedAt: new Date(), paidAt: new Date(), createdAt: new Date() },
      ]);
      const result = await service.listForUser(requester, 'user-1', { limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
    });
  });
});
