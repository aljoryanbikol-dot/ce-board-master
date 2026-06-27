/**
 * @file payment-provider.factory.spec.ts
 * @module Payments/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentProviderType } from '@prisma/client';
import { PaymentProviderFactory } from '../services/payment-provider.factory';
import type { PaymentProvider } from '../types/payment-provider.interface';

function fakeProvider(type: PaymentProviderType): PaymentProvider {
  return {
    type,
    createPayment: vi.fn(),
    verifyWebhook: vi.fn(),
    verifyPayment: vi.fn(),
  } as unknown as PaymentProvider;
}

const mockConfig = { get: vi.fn() };

describe('PaymentProviderFactory', () => {
  let factory: PaymentProviderFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    const providers = [
      fakeProvider(PaymentProviderType.mock),
      fakeProvider(PaymentProviderType.paymongo),
      fakeProvider(PaymentProviderType.xendit),
    ];
    factory = new PaymentProviderFactory(providers, mockConfig as never);
  });

  it('resolves a provider by type', () => {
    expect(factory.get(PaymentProviderType.paymongo).type).toBe('paymongo');
    expect(factory.get(PaymentProviderType.xendit).type).toBe('xendit');
  });

  it('lists all available providers', () => {
    expect(factory.available()).toEqual(
      expect.arrayContaining(['mock', 'paymongo', 'xendit']),
    );
  });

  it('throws PROVIDER_NOT_FOUND for an unregistered provider', () => {
    expect(() => factory.get(PaymentProviderType.stripe)).toThrow();
  });

  it('getDefault resolves the configured provider', () => {
    mockConfig.get.mockReturnValue('paymongo');
    expect(factory.getDefault().type).toBe('paymongo');
  });

  it('getDefault falls back to mock when unset', () => {
    mockConfig.get.mockReturnValue(undefined);
    expect(factory.getDefault().type).toBe('mock');
  });
});
