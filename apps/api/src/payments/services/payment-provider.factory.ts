/**
 * @file payment-provider.factory.ts
 * @module Payments/Services
 *
 * PaymentProviderFactory — resolves a concrete PaymentProvider by type.
 *
 * This is the runtime half of the provider abstraction. Providers self-register
 * by being injected as an array (via the PAYMENT_PROVIDERS token); the factory
 * indexes them by their `type` discriminator. Adding Stripe later means writing
 * a StripeProvider and adding it to the module's provider array — business logic
 * (SubscriptionService, PaymentService, BillingService) never changes.
 *
 * Open/Closed Principle in action: open for extension (new providers), closed
 * for modification (callers untouched).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderType } from '@prisma/client';
import { PaymentErrors } from '../payments.errors';
import {
  PAYMENT_PROVIDERS,
  type PaymentProvider,
} from '../types/payment-provider.interface';
import type { AppEnvironment } from '../../config/configuration';

@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);
  private readonly registry = new Map<PaymentProviderType, PaymentProvider>();

  constructor(
    @Inject(PAYMENT_PROVIDERS) providers: PaymentProvider[],
    private readonly config: ConfigService<AppEnvironment>,
  ) {
    for (const provider of providers) {
      this.registry.set(provider.type, provider);
    }
    this.logger.log({
      message: 'Payment providers registered',
      providers: Array.from(this.registry.keys()),
    });
  }

  /** Resolve a provider by explicit type. Throws if not registered. */
  get(type: PaymentProviderType): PaymentProvider {
    const provider = this.registry.get(type);
    if (!provider) throw PaymentErrors.providerNotFound(type);
    return provider;
  }

  /** Resolve the configured default provider (PAYMENT_DEFAULT_PROVIDER). */
  getDefault(): PaymentProvider {
    const def = this.config.get('PAYMENT_DEFAULT_PROVIDER', { infer: true }) ?? 'mock';
    return this.get(def as PaymentProviderType);
  }

  /** List the registered provider types (for diagnostics/health). */
  available(): PaymentProviderType[] {
    return Array.from(this.registry.keys());
  }
}
