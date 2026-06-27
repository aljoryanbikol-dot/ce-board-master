/**
 * @file mock-payment.provider.ts
 * @module Payments/Providers
 *
 * MockPaymentProvider — deterministic, network-free provider for local
 * development, automated tests, and CI. It mints predictable provider refs and
 * a fake checkout URL, and verifies webhooks using a simple HMAC over a shared
 * secret so the full webhook pipeline can be exercised end-to-end without a
 * real processor.
 *
 * Selected when PAYMENT_DEFAULT_PROVIDER=mock (the default in non-prod).
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentProviderType, PaymentMethodType } from '@prisma/client';
import { PaymentErrors } from '../payments.errors';
import type {
  PaymentProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedWebhookEvent,
  VerifyPaymentResult,
} from '../types/payment-provider.interface';

const MOCK_SECRET = 'mock_webhook_secret_ce_board_master';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly type = PaymentProviderType.mock;
  private readonly logger = new Logger(MockPaymentProvider.name);

  // In-memory ledger so verifyPayment can echo back created intents.
  private readonly ledger = new Map<string, { amountMinor: number; status: string }>();

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerRef = `mock_${input.paymentId}`;
    this.ledger.set(providerRef, { amountMinor: input.amountMinor, status: 'pending' });

    this.logger.debug({ message: 'Mock payment created', providerRef, amountMinor: input.amountMinor });

    return {
      providerRef,
      checkoutUrl: `https://mock-pay.local/checkout/${providerRef}`,
      status: 'pending',
      raw: { provider: 'mock', providerRef, ...input.metadata },
    };
  }

  verifyWebhook(rawBody: string, signature: string | undefined): NormalizedWebhookEvent {
    if (!signature) throw PaymentErrors.invalidSignature();

    const expected = createHmac('sha256', MOCK_SECRET).update(rawBody).digest('hex');
    const provided = signature;

    const ok =
      expected.length === provided.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    if (!ok) throw PaymentErrors.invalidSignature();

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const outcomeRaw = String(payload.type ?? 'unknown');

    const outcome: NormalizedWebhookEvent['outcome'] =
      outcomeRaw.includes('paid') || outcomeRaw.includes('succeeded') ? 'succeeded'
      : outcomeRaw.includes('failed') ? 'failed'
      : outcomeRaw.includes('refund') ? 'refunded'
      : 'pending';

    return {
      eventId:     String(payload.id ?? `mock_evt_${Date.now()}`),
      eventType:   outcomeRaw,
      paymentId:   (data.paymentId as string) ?? null,
      providerRef: (data.providerRef as string) ?? null,
      outcome,
      method:      (data.method as PaymentMethodType) ?? null,
      payload,
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    const entry = this.ledger.get(providerRef);
    return {
      providerRef,
      status: (entry?.status as VerifyPaymentResult['status']) ?? 'pending',
      amountMinor: entry?.amountMinor ?? null,
      raw: { provider: 'mock', providerRef, found: Boolean(entry) },
    };
  }

  /** Test helper: deterministically sign a webhook body with the mock secret. */
  static sign(rawBody: string): string {
    return createHmac('sha256', MOCK_SECRET).update(rawBody).digest('hex');
  }
}
