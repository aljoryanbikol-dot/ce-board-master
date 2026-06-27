/**
 * @file index.ts
 * @module Payments
 * Barrel export for the Payments module (Sprint 2.5).
 */
export { PaymentModule } from './payments.module';
export { PaymentService } from './services/payment.service';
export { PaymentProviderFactory } from './services/payment-provider.factory';
export { MockPaymentProvider } from './providers/mock-payment.provider';
export { PayMongoProvider } from './providers/paymongo.provider';
export { XenditProvider } from './providers/xendit.provider';
export {
  PAYMENT_PROVIDERS,
  type PaymentProvider,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type NormalizedWebhookEvent,
  type VerifyPaymentResult,
} from './types/payment-provider.interface';
export { PAYMENT_ERROR_CODES, type PaymentErrorCode } from './payments.constants';
export { PaymentErrors } from './payments.errors';
export { ListPaymentsQuerySchema, type ListPaymentsQueryDto, PaymentDto } from './dto/payment.dto';
