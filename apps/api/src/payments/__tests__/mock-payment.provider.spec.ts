/**
 * @file mock-payment.provider.spec.ts
 * @module Payments/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { MockPaymentProvider } from '../providers/mock-payment.provider';

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => { provider = new MockPaymentProvider(); });

  it('createPayment returns a deterministic provider ref + checkout URL', async () => {
    const result = await provider.createPayment({
      paymentId: 'pay-1', amountMinor: 49900, currency: 'PHP',
      description: 'Pro', successUrl: 'https://s', cancelUrl: 'https://c',
      customerEmail: 'u@test.com',
    });
    expect(result.providerRef).toBe('mock_pay-1');
    expect(result.checkoutUrl).toContain('mock_pay-1');
    expect(result.status).toBe('pending');
  });

  it('verifyWebhook accepts a correctly-signed body', () => {
    const body = JSON.stringify({ id: 'evt-1', type: 'payment.paid', data: { paymentId: 'pay-1', providerRef: 'mock_pay-1' } });
    const sig = MockPaymentProvider.sign(body);
    const event = provider.verifyWebhook(body, sig);
    expect(event.outcome).toBe('succeeded');
    expect(event.paymentId).toBe('pay-1');
    expect(event.eventId).toBe('evt-1');
  });

  it('verifyWebhook rejects a tampered body', () => {
    const body = JSON.stringify({ id: 'evt-1', type: 'payment.paid' });
    const sig = MockPaymentProvider.sign(body);
    const tampered = body.replace('paid', 'failed');
    expect(() => provider.verifyWebhook(tampered, sig)).toThrow(UnauthorizedException);
  });

  it('verifyWebhook rejects a missing signature', () => {
    expect(() => provider.verifyWebhook('{}', undefined)).toThrow(UnauthorizedException);
  });

  it('maps failed event type to failed outcome', () => {
    const body = JSON.stringify({ id: 'evt-2', type: 'payment.failed', data: {} });
    const sig = MockPaymentProvider.sign(body);
    expect(provider.verifyWebhook(body, sig).outcome).toBe('failed');
  });
});
