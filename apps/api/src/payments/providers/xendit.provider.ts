/**
 * @file xendit.provider.ts
 * @module Payments/Providers
 *
 * XenditProvider — integrates Xendit (SEA processor) via Invoices API,
 * supporting GCash, Maya (PayMaya), QR Ph, cards, and online banking.
 *
 * Webhook verification: Xendit sends a static callback verification token in
 * the `x-callback-token` header which we compare in constant time against the
 * configured XENDIT_WEBHOOK_TOKEN.
 *
 * Outbound HTTP only; never touches the database.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
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

const XENDIT_API = 'https://api.xendit.co';

const METHOD_MAP: Partial<Record<PaymentMethodType, string>> = {
  [PaymentMethodType.gcash]:          'GCASH',
  [PaymentMethodType.maya]:           'PAYMAYA',
  [PaymentMethodType.qrph]:           'QRPH',
  [PaymentMethodType.credit_card]:    'CREDIT_CARD',
  [PaymentMethodType.debit_card]:     'CREDIT_CARD',
  [PaymentMethodType.online_banking]: 'DIRECT_DEBIT',
};

@Injectable()
export class XenditProvider implements PaymentProvider {
  readonly type = PaymentProviderType.xendit;
  private readonly logger = new Logger(XenditProvider.name);

  constructor(private readonly config: ConfigService<AppEnvironment>) {}

  private get secretKey(): string {
    return this.config.get('XENDIT_SECRET_KEY', { infer: true }) ?? '';
  }

  private get webhookToken(): string {
    return this.config.get('XENDIT_WEBHOOK_TOKEN', { infer: true }) ?? '';
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Xendit Invoice amount is in major units for PHP (whole pesos).
    const amountMajor = Math.round(input.amountMinor / 100);

    const body = {
      external_id:       input.paymentId,
      amount:            amountMajor,
      currency:          input.currency,
      description:       input.description,
      payer_email:       input.customerEmail,
      success_redirect_url: input.successUrl,
      failure_redirect_url: input.cancelUrl,
      payment_methods:   input.method && METHOD_MAP[input.method] ? [METHOD_MAP[input.method]] : undefined,
      metadata:          { paymentId: input.paymentId, ...input.metadata },
    };

    let response: Response;
    try {
      response = await fetch(`${XENDIT_API}/v2/invoices`, {
        method: 'POST',
        headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error({ message: 'Xendit network error', err: String(err) });
      throw PaymentErrors.providerError('network failure contacting Xendit');
    }

    const json = (await response.json()) as {
      id?: string; invoice_url?: string; status?: string; message?: string;
    };

    if (!response.ok || !json.id) {
      const detail = json.message ?? `HTTP ${response.status}`;
      this.logger.error({ message: 'Xendit create failed', detail });
      throw PaymentErrors.providerError(detail);
    }

    return {
      providerRef: json.id,
      checkoutUrl: json.invoice_url ?? null,
      status: 'pending',
      raw: json,
    };
  }

  verifyWebhook(rawBody: string, signature: string | undefined): NormalizedWebhookEvent {
    if (!signature) throw PaymentErrors.invalidSignature();

    const expected = this.webhookToken;
    const ok =
      expected.length === signature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) throw PaymentErrors.invalidSignature();

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const statusRaw = String(payload.status ?? '').toUpperCase();
    const metadata = (payload.metadata ?? {}) as Record<string, unknown>;

    const outcome: NormalizedWebhookEvent['outcome'] =
      statusRaw === 'PAID' || statusRaw === 'SETTLED' ? 'succeeded'
      : statusRaw === 'EXPIRED' || statusRaw === 'FAILED' ? 'failed'
      : statusRaw === 'REFUNDED' ? 'refunded'
      : 'pending';

    return {
      eventId:     String(payload.id ?? `xnd_evt_${Date.now()}`),
      eventType:   `invoice.${statusRaw.toLowerCase()}`,
      paymentId:   (metadata.paymentId as string) ?? (payload.external_id as string) ?? null,
      providerRef: (payload.id as string) ?? null,
      outcome,
      method:      null,
      payload,
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    let response: Response;
    try {
      response = await fetch(`${XENDIT_API}/v2/invoices/${providerRef}`, {
        headers: { Authorization: this.authHeader() },
      });
    } catch (err) {
      throw PaymentErrors.providerError(`verify failed: ${String(err)}`);
    }

    const json = (await response.json()) as { status?: string; amount?: number };
    const statusRaw = String(json.status ?? '').toUpperCase();

    const status: VerifyPaymentResult['status'] =
      statusRaw === 'PAID' || statusRaw === 'SETTLED' ? 'succeeded'
      : statusRaw === 'EXPIRED' || statusRaw === 'FAILED' ? 'failed'
      : 'pending';

    return {
      providerRef,
      status,
      amountMinor: json.amount != null ? json.amount * 100 : null,
      raw: json,
    };
  }
}
