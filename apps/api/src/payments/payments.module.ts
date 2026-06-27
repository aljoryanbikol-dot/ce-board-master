/**
 * @file payments.module.ts
 * @module Payments
 *
 * PaymentModule — payment orchestration + provider abstraction (Sprint 2.5).
 *
 * Wires the three concrete providers (Mock, PayMongo, Xendit) into an array
 * bound to the PAYMENT_PROVIDERS token; the PaymentProviderFactory indexes them
 * by type. Adding Stripe later = add StripeProvider to this array; no other
 * file changes (Open/Closed Principle).
 *
 * Circular dependency with SubscriptionModule (payment success activates a
 * subscription; subscribing creates a payment) is resolved with forwardRef on
 * both sides.
 */
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { BillingModule } from '../billing/billing.module';
import { SubscriptionModule } from '../subscriptions/subscriptions.module';
import { PaymentController } from './controllers/payment.controller';
import { PaymentService } from './services/payment.service';
import { PaymentProviderFactory } from './services/payment-provider.factory';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PayMongoProvider } from './providers/paymongo.provider';
import { XenditProvider } from './providers/xendit.provider';
import { PAYMENT_PROVIDERS } from './types/payment-provider.interface';

@Module({
  imports: [
    AuthModule,
    RbacModule,
    BillingModule,
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [PaymentController],
  providers: [
    MockPaymentProvider,
    PayMongoProvider,
    XenditProvider,
    {
      provide: PAYMENT_PROVIDERS,
      useFactory: (
        mock: MockPaymentProvider,
        paymongo: PayMongoProvider,
        xendit: XenditProvider,
      ) => [mock, paymongo, xendit],
      inject: [MockPaymentProvider, PayMongoProvider, XenditProvider],
    },
    PaymentProviderFactory,
    PaymentService,
  ],
  exports: [PaymentService, PaymentProviderFactory],
})
export class PaymentModule {}
