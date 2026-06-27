/**
 * @file payment.controller.spec.ts
 * @module Payments/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProviderType } from '@prisma/client';
import { PaymentController } from '../controllers/payment.controller';
import { PaymentService } from '../services/payment.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const mockPaymentService = { listForUser: vi.fn(), getById: vi.fn(), verifyPayment: vi.fn(), handleWebhook: vi.fn() };
const user = { id: 'user-1', email: 'u@test.com', role: 'subscriber', subscriptionTier: 'free' };
const allow = { canActivate: () => true };

async function build() {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [PaymentController],
    providers: [{ provide: PaymentService, useValue: mockPaymentService }],
  })
    .overrideGuard(JwtAuthGuard).useValue(allow)
    .overrideGuard(RolesGuard).useValue(allow)
    .overrideGuard(PermissionGuard).useValue(allow)
    .compile();
  return moduleRef.get(PaymentController);
}

describe('PaymentController', () => {
  let ctrl: PaymentController;
  beforeEach(async () => { vi.clearAllMocks(); ctrl = await build(); });

  it('listMine delegates to service with own id', async () => {
    mockPaymentService.listForUser.mockResolvedValue({ data: [], pagination: {} });
    await ctrl.listMine(user as never, { limit: 20 } as never);
    expect(mockPaymentService.listForUser).toHaveBeenCalledWith(user, 'user-1', { limit: 20 });
  });

  it('getById delegates', async () => {
    mockPaymentService.getById.mockResolvedValue({ id: 'pay-1' });
    await ctrl.getById('pay-1', user as never);
    expect(mockPaymentService.getById).toHaveBeenCalledWith(user, 'pay-1');
  });

  it('verify delegates', async () => {
    mockPaymentService.verifyPayment.mockResolvedValue({ id: 'pay-1' });
    await ctrl.verify('pay-1', user as never);
    expect(mockPaymentService.verifyPayment).toHaveBeenCalledWith('pay-1', user);
  });

  it('paymongo webhook passes raw body + signature to service', async () => {
    mockPaymentService.handleWebhook.mockResolvedValue({ status: 'processed' });
    const req = { rawBody: '{"a":1}', body: { a: 1 } } as never;
    await ctrl.paymongoWebhook(req, 'sig-header');
    expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(PaymentProviderType.paymongo, '{"a":1}', 'sig-header');
  });

  it('mock webhook passes the captured raw body verbatim to the service', async () => {
    mockPaymentService.handleWebhook.mockResolvedValue({ status: 'processed' });
    const req = { rawBody: '{"x":2}', body: { x: 2 } } as never;
    await ctrl.mockWebhook(req, 'sig');
    expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(PaymentProviderType.mock, '{"x":2}', 'sig');
  });

  it('throws 503 (no silent fallback) when the raw body was not captured', async () => {
    // A missing rawBody means the bootstrap parser was not registered for this
    // route. We must fail loudly rather than HMAC over re-serialized JSON.
    const req = { body: { x: 2 } } as never;
    await expect(ctrl.mockWebhook(req, 'sig')).rejects.toMatchObject({
      response: { code: 'WEBHOOK_RAW_BODY_UNAVAILABLE' },
    });
    expect(mockPaymentService.handleWebhook).not.toHaveBeenCalled();
  });
});
