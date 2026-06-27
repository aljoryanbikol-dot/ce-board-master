/**
 * @file payment-provider.interface.ts
 * @module Payments/Types
 *
 * The PaymentProvider abstraction — the seam that lets CE Board Master swap or
 * add payment processors (PayMongo, Xendit, Stripe, Mock) WITHOUT touching any
 * business logic in SubscriptionService / BillingService / PaymentService.
 *
 * Design (Dependency Inversion Principle):
 * - High-level modules depend on this interface, never on a concrete SDK.
 * - Each provider implements this contract and self-declares its `type`.
 * - PaymentProviderFactory resolves the right implementation at runtime.
 *
 * Money is always represented in MINOR units (centavos for PHP) as integers to
 * avoid floating-point drift. Currency is an ISO-4217 code.
 */
import type { PaymentMethodType, PaymentProviderType } from '@prisma/client';

/** Input to create a checkout / payment intent with a provider. */
export interface CreatePaymentInput {
  /** Internal payment id (our Payment.id) — passed as provider metadata. */
  paymentId:      string;
  /** Amount in minor units (e.g. 49900 = ₱499.00). */
  amountMinor:    number;
  currency:       string;
  /** Chosen method; some providers infer from the checkout page. */
  method?:        PaymentMethodType;
  /** Human description shown on the provider checkout. */
  description:    string;
  /** Where the provider should redirect after success/failure. */
  successUrl:     string;
  cancelUrl:      string;
  /** Payer identity for receipts. */
  customerEmail:  string;
  customerName?:  string;
  /** Arbitrary metadata echoed back on webhooks. */
  metadata?:      Record<string, string>;
}

/** Result of creating a payment with a provider. */
export interface CreatePaymentResult {
  /** Provider-side identifier (intent/charge/invoice id). */
  providerRef:  string;
  /** URL to redirect the user to complete payment (if redirect-based). */
  checkoutUrl:  string | null;
  /** Provider's initial status, normalized. */
  status:       'pending' | 'processing' | 'succeeded' | 'failed';
  /** Raw provider response for logging. */
  raw:          unknown;
}

/** Normalized representation of a provider webhook event. */
export interface NormalizedWebhookEvent {
  /** Provider's globally-unique event id (for idempotency). */
  eventId:      string;
  /** Provider event type, e.g. 'payment.paid'. */
  eventType:    string;
  /** Our payment id, extracted from metadata if present. */
  paymentId:    string | null;
  /** Provider-side payment reference. */
  providerRef:  string | null;
  /** Normalized outcome the billing pipeline acts on. */
  outcome:      'succeeded' | 'failed' | 'refunded' | 'pending' | 'unknown';
  /** Method used, if the provider reports it. */
  method:       PaymentMethodType | null;
  /** The full decoded payload. */
  payload:      Record<string, unknown>;
}

/** Result of verifying a payment's current state directly with the provider. */
export interface VerifyPaymentResult {
  providerRef: string;
  status:      'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'canceled';
  amountMinor: number | null;
  raw:         unknown;
}

/**
 * The contract every payment provider must satisfy.
 *
 * Implementations are stateless and side-effect-free except for the outbound
 * HTTP call to the provider. They NEVER touch the database — persistence is the
 * caller's responsibility (Single Responsibility Principle).
 */
export interface PaymentProvider {
  /** Discriminator used by the factory to register/resolve this provider. */
  readonly type: PaymentProviderType;

  /** Create a checkout/intent. Returns provider ref + redirect URL. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /**
   * Verify and parse an inbound webhook.
   * MUST validate the signature/HMAC using the provider secret.
   * @param rawBody    - The raw request body bytes (signature is over these).
   * @param signature  - The provider signature header value.
   * @returns The normalized event if the signature is valid.
   * @throws if the signature is invalid (caller records invalid_signature).
   */
  verifyWebhook(rawBody: string, signature: string | undefined): NormalizedWebhookEvent;

  /** Query the provider for the authoritative status of a payment. */
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>;
}

/** DI token for the array of registered providers. */
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
