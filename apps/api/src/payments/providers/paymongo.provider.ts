/**
 * @file paymongo.provider.ts
 * @module Payments/Providers
 *
 * PayMongoProvider — integrates PayMongo (Philippine processor) supporting
 * GCash, Maya, QR Ph, card, and online banking via Checkout Sessions.
 *
 * Webhook verification: PayMongo signs the raw body with HMAC-SHA256 using the
 * webhook secret; the signature header carries a timestamp and signature pair.
 * We recompute and compare in constant time.
 *
 * This class performs outbound HTTP via fetch and NEVER touches the database.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentProviderType, PaymentMethodType } from '@prisma/client';
import { PaymentErrors } from '../payments.errors';
import type { AppEnvironment } from '../../config/configuration';
import type {
  PaymentProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedWebhookEvent,
  VerifyPaymentResult,
} from '../types/payment-provider.interface';

const PAYMONGO_API = 'https://api.paymongo.com/v1';

/** Map our method enum to PayMongo payment_method_types. */
const METHOD_MAP: Partial<Record<PaymentMethodType, string>> = {
  [PaymentMethodType.gcash]:          'gcash',
  [PaymentMethodType.maya]:           'paymaya',
  [PaymentMethodType.qrph]:           'qrph',
  [PaymentMethodType.credit_card]:    'card',
  [PaymentMethodType.debit_card]:     'card',
  [PaymentMethodType.online_banking]: 'dob',
};

@Injectable()
export class PayMongoProvider implements PaymentProvider {
  readonly type = PaymentProviderType.paymongo;
  private readonly logger = new Logger(PayMongoProvider.name);

  constructor(private readonly config: ConfigService<AppEnvironment>) {}

  private get secretKey(): string {
    return this.config.get('PAYMONGO_SECRET_KEY', { infer: true }) ?? '';
  }

  private get webhookSecret(): string {
    return this.config.get('PAYMONGO_WEBHOOK_SECRET', { infer: true }) ?? '';
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const body = {
      data: {
        attributes: {
          line_items: [{
            currency: input.currency,
            amount:   input.amountMinor,
            name:     input.description,
            quantity: 1,
          }],
          payment_method_types: input.method && METHOD_MAP[input.method]
            ? [METHOD_MAP[input.method]]
            : ['gcash', 'paymaya', 'card', 'qrph'],
          success_url: input.successUrl,
          cancel_url:  input.cancelUrl,
          description: input.description,
          metadata: {
            paymentId: input.paymentId,
            ...input.metadata,
          },
        },
      },
    };

    let response: Response;
    try {
      response = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
        method: 'POST',
        headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error({ message: 'PayMongo network error', err: String(err) });
      throw PaymentErrors.providerError('network failure contacting PayMongo');
    }

    const json = (await response.json()) as {
      data?: { id: string; attributes?: { checkout_url?: string } };
      errors?: { detail: string }[];
    };

    if (!response.ok || !json.data) {
      const detail = json.errors?.[0]?.detail ?? `HTTP ${response.status}`;
      this.logger.error({ message: 'PayMongo create failed', detail });
      throw PaymentErrors.providerError(detail);
    }

    return {
      providerRef: json.data.id,
      checkoutUrl: json.data.attributes?.checkout_url ?? null,
      status: 'pending',
      raw: json,
    };
  }

  verifyWebhook(rawBody: string, signature: string | undefined): NormalizedWebhookEvent {
    if (!signature) throw PaymentErrors.invalidSignature();

    // PayMongo signature header: "t=<ts>,te=<sig>" (test) or "li=<sig>" (live)
    const parts = Object.fromEntries(
      signature.split(',').map((kv) => kv.split('=') as [string, string]),
    );
    const timestamp = parts['t'];
    const providedSig = parts['te'] ?? parts['li'];
    if (!timestamp || !providedSig) throw PaymentErrors.invalidSignature();

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = createHmac('sha256', this.webhookSecret).update(signedPayload).digest('hex');

    const ok =
      expected.length === providedSig.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(providedSig));
    if (!ok) throw PaymentErrors.invalidSignature();

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const attributes = (data.attributes ?? {}) as Record<string, unknown>;
    const eventType = String(attributes.type ?? 'unknown');
    const innerData = (attributes.data ?? {}) as Record<string, unknown>;
    const innerAttrs = (innerData.attributes ?? {}) as Record<string, unknown>;
    const metadata = (innerAttrs.metadata ?? {}) as Record<string, unknown>;

    const outcome: NormalizedWebhookEvent['outcome'] =
      eventType.includes('paid') || eventType.includes('payment.paid') ? 'succeeded'
      : eventType.includes('failed') ? 'failed'
      : eventType.includes('refund') ? 'refunded'
      : 'pending';

    return {
      eventId:     String(data.id ?? `pm_evt_${Date.now()}`),
      eventType,
      paymentId:   (metadata.paymentId as string) ?? null,
      providerRef: (innerData.id as string) ?? null,
      outcome,
      method:      null,
      payload,
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    let response: Response;
    try {
      response = await fetch(`${PAYMONGO_API}/checkout_sessions/${providerRef}`, {
        headers: { Authorization: this.authHeader() },
      });
    } catch (err) {
      throw PaymentErrors.providerError(`verify failed: ${String(err)}`);
    }

    const json = (await response.json()) as {
      data?: { attributes?: { payments?: { attributes?: { status?: string; amount?: number } }[] } };
    };
    const payment = json.data?.attributes?.payments?.[0]?.attributes;
    const statusRaw = payment?.status ?? 'pending';

    const status: VerifyPaymentResult['status'] =
      statusRaw === 'paid' ? 'succeeded'
      : statusRaw === 'failed' ? 'failed'
      : 'pending';

    return { providerRef, status, amountMinor: payment?.amount ?? null, raw: json };
  }
}
