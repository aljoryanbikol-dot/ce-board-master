/**
 * @file payments.constants.ts
 * @module Payments
 */

export const PAYMENT_ERROR_CODES = {
  PAYMENT_NOT_FOUND:       'PAYMENT_NOT_FOUND',
  PROVIDER_NOT_FOUND:      'PROVIDER_NOT_FOUND',
  PROVIDER_ERROR:          'PROVIDER_ERROR',
  INVALID_WEBHOOK_SIGNATURE: 'INVALID_WEBHOOK_SIGNATURE',
  DUPLICATE_WEBHOOK:       'DUPLICATE_WEBHOOK',
  IDEMPOTENCY_CONFLICT:    'IDEMPOTENCY_CONFLICT',
  FORBIDDEN_OWNERSHIP:     'FORBIDDEN_OWNERSHIP',
  AMOUNT_MISMATCH:         'AMOUNT_MISMATCH',
} as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[keyof typeof PAYMENT_ERROR_CODES];

/** Redis key prefix for idempotency-key reservation (replay protection). */
export const IDEMPOTENCY_CACHE_PREFIX = 'payments:idem:' as const;

/** TTL for idempotency reservations (seconds). 24h covers retry windows. */
export const IDEMPOTENCY_TTL = 86_400 as const;

/** Webhook header names per provider. */
export const WEBHOOK_SIGNATURE_HEADERS = {
  paymongo: 'paymongo-signature',
  xendit:   'x-callback-token',
  stripe:   'stripe-signature',
  mock:     'x-mock-signature',
} as const;
