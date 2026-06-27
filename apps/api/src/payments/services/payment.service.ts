/**
 * @file payment.service.ts
 * @module Payments/Services
 *
 * PaymentService — orchestrates payment creation, the webhook pipeline, and
 * payment verification. This is the single owner of Payment + PaymentWebhook +
 * PaymentLog persistence. Providers do the HTTP; this service does the DB and
 * the side-effects (activate subscription, generate invoice, emit events).
 *
 * Idempotency & replay protection:
 * - createPayment honours a client idempotencyKey (unique column + Redis guard).
 * - handleWebhook deduplicates on (providerType, eventId) unique constraint and
 *   records every inbound event for audit, including invalid-signature attempts.
 *
 * The webhook pipeline (handleWebhook) performs, atomically where it matters:
 *   verify signature → dedupe → mark payment succeeded → activate subscription
 *   → generate invoice + receipt → record audit log → publish payment.completed
 */
import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PaymentStatus,
  PaymentProviderType,
  PaymentMethodType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { EVENTS } from '../../common/constants';
import { ROLE_SLUGS, PERM } from '../../rbac/rbac.constants';
import { UserRoleService } from '../../rbac/services/user-role.service';
import { BillingService } from '../../billing/services/billing.service';
import { SubscriptionService } from '../../subscriptions/services/subscription.service';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentErrors } from '../payments.errors';
import {
  IDEMPOTENCY_CACHE_PREFIX,
  IDEMPOTENCY_TTL,
} from '../payments.constants';
import type { ListPaymentsQueryDto } from '../dto/payment.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { NormalizedWebhookEvent } from '../types/payment-provider.interface';

interface CreatePaymentParams {
  userId:         string;
  subscriptionId: string | null;
  amountMinor:    number;
  currency:       string;
  provider:       PaymentProviderType;
  method?:        PaymentMethodType;
  description:    string;
  customerEmail:  string;
  customerName?:  string;
  successUrl:     string;
  cancelUrl:      string;
  idempotencyKey?: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly factory: PaymentProviderFactory,
    private readonly billingService: BillingService,
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
    private readonly userRoleService: UserRoleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Create payment ──────────────────────────────────────────────────────────

  /**
   * Create a payment + provider checkout. Honours idempotency key.
   * Returns the Payment row (with checkoutUrl) for the caller to redirect.
   */
  async createPayment(params: CreatePaymentParams) {
    // Idempotency: if a key is supplied and already used, return existing payment
    if (params.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        this.logger.log({ message: 'Idempotent payment replay — returning existing', key: params.idempotencyKey });
        return this.toDto(existing);
      }

      // Redis guard against concurrent in-flight duplicates
      const guardKey = `${IDEMPOTENCY_CACHE_PREFIX}${params.idempotencyKey}`;
      const reserved = await this.cache.get<string>(guardKey);
      if (reserved) throw PaymentErrors.idempotencyConflict();
      await this.cache.set(guardKey, '1', IDEMPOTENCY_TTL);
    }

    const provider = this.factory.get(params.provider);

    // Create the payment row first (pending) so we have an id to hand the provider
    const payment = await this.prisma.payment.create({
      data: {
        userId:         params.userId,
        subscriptionId: params.subscriptionId,
        amountMinor:    params.amountMinor,
        currency:       params.currency,
        status:         PaymentStatus.pending,
        providerType:   params.provider,
        methodType:     params.method ?? null,
        idempotencyKey: params.idempotencyKey ?? null,
        metadata:       {},
      },
    });

    await this.log(payment.id, 'created', null, PaymentStatus.pending, params.userId);

    // Ask the provider to create a checkout
    let result;
    try {
      result = await provider.createPayment({
        paymentId:     payment.id,
        amountMinor:   params.amountMinor,
        currency:      params.currency,
        method:        params.method,
        description:   params.description,
        successUrl:    params.successUrl,
        cancelUrl:     params.cancelUrl,
        customerEmail: params.customerEmail,
        customerName:  params.customerName,
        metadata:      { paymentId: payment.id },
      });
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data:  { status: PaymentStatus.failed, failureReason: String(err) },
      });
      await this.log(payment.id, 'provider_create_failed', PaymentStatus.pending, PaymentStatus.failed, params.userId);
      throw err;
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: result.providerRef,
        checkoutUrl: result.checkoutUrl,
        status:      PaymentStatus.processing,
      },
    });

    await this.log(payment.id, 'checkout_created', PaymentStatus.pending, PaymentStatus.processing, params.userId);
    return this.toDto(updated);
  }

  // ── Webhook pipeline ────────────────────────────────────────────────────────

  /**
   * Process an inbound provider webhook end-to-end.
   *
   * Steps:
   *  1. Verify signature (provider) — invalid → record + 401
   *  2. Dedupe on (providerType, eventId) — duplicate → record + return
   *  3. Resolve the payment, mark succeeded/failed/refunded
   *  4. On success: activate subscription, generate invoice + receipt
   *  5. Record audit log, publish payment.completed / payment.failed
   */
  async handleWebhook(
    providerType: PaymentProviderType,
    rawBody: string,
    signature: string | undefined,
  ): Promise<{ status: string }> {
    const provider = this.factory.get(providerType);

    // 1. Verify signature
    let event: NormalizedWebhookEvent;
    try {
      event = provider.verifyWebhook(rawBody, signature);
    } catch (err) {
      await this.recordWebhook(providerType, null, 'invalid', false, { error: String(err) }, rawBody);
      throw PaymentErrors.invalidSignature();
    }

    // 2. Dedupe (idempotency on provider event id)
    const dup = await this.prisma.paymentWebhook.findUnique({
      where: { providerType_eventId: { providerType, eventId: event.eventId } },
    });
    if (dup) {
      this.logger.log({ message: 'Duplicate webhook ignored', providerType, eventId: event.eventId });
      await this.recordWebhook(providerType, event, 'duplicate', true, event.payload, rawBody);
      return { status: 'duplicate' };
    }

    // Persist the received event (idempotency anchor)
    const webhook = await this.recordWebhook(providerType, event, 'received', true, event.payload, rawBody);

    // 3. Resolve payment — by our paymentId metadata, else by providerRef
    const payment = await this.resolvePayment(event);
    if (!payment) {
      await this.prisma.paymentWebhook.update({
        where: { id: webhook.id },
        data:  { status: 'failed', error: 'payment_not_found', processedAt: new Date() },
      });
      this.logger.warn({ message: 'Webhook references unknown payment', eventId: event.eventId });
      return { status: 'payment_not_found' };
    }

    // 4. Act on outcome
    if (event.outcome === 'succeeded') {
      await this.markSucceeded(payment, event);
    } else if (event.outcome === 'failed') {
      await this.markFailed(payment, event);
    } else if (event.outcome === 'refunded') {
      await this.markRefunded(payment, event);
    }

    await this.prisma.paymentWebhook.update({
      where: { id: webhook.id },
      data:  { status: 'processed', paymentId: payment.id, processedAt: new Date() },
    });

    return { status: 'processed' };
  }

  // ── Verify payment (manual reconciliation) ──────────────────────────────────

  async verifyPayment(paymentId: string, requester: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw PaymentErrors.notFound(paymentId);
    await this.assertCanAccess(payment.userId, requester);

    if (!payment.providerRef) return this.toDto(payment);

    const provider = this.factory.get(payment.providerType);
    const result = await provider.verifyPayment(payment.providerRef);

    if (result.status === 'succeeded' && payment.status !== PaymentStatus.succeeded) {
      await this.markSucceeded(payment, {
        eventId: `verify_${payment.id}`, eventType: 'manual.verify', paymentId: payment.id,
        providerRef: payment.providerRef, outcome: 'succeeded', method: null, payload: {},
      });
    }

    const fresh = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    return this.toDto(fresh!);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async listForUser(requester: AuthenticatedUser, targetUserId: string, query: ListPaymentsQueryDto) {
    await this.assertCanAccess(targetUserId, requester);
    const where = {
      userId: targetUserId,
      ...(query.status && { status: query.status as PaymentStatus }),
      ...(query.cursor && { id: { gt: query.cursor } }),
    };
    const rows = await this.prisma.payment.findMany({ where, orderBy: { id: 'asc' }, take: query.limit + 1 });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const cursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;
    return { data: page.map((p: Parameters<typeof this.toDto>[0]) => this.toDto(p)), pagination: { cursor, hasMore, total: page.length } };
  }

  async getById(requester: AuthenticatedUser, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw PaymentErrors.notFound(paymentId);
    await this.assertCanAccess(payment.userId, requester);
    return this.toDto(payment);
  }

  // ── State transitions ────────────────────────────────────────────────────────

  private async markSucceeded(
    payment: { id: string; userId: string; subscriptionId: string | null; status: PaymentStatus; amountMinor: number; currency: string },
    event: NormalizedWebhookEvent,
  ): Promise<void> {
    if (payment.status === PaymentStatus.succeeded) return; // idempotent

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status:     PaymentStatus.succeeded,
        methodType: event.method ?? undefined,
        paidAt:     new Date(),
      },
    });
    await this.log(payment.id, 'succeeded', payment.status, PaymentStatus.succeeded, null);

    // Activate subscription (if linked)
    let planName = 'CE Board Master';
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    if (payment.subscriptionId) {
      const activated = await this.subscriptionService.activateAfterPayment(payment.subscriptionId);
      planName    = activated.planName;
      periodStart = activated.periodStart;
      periodEnd   = activated.periodEnd;
    }

    // Generate invoice + receipt
    await this.billingService.generateInvoiceForPayment({
      userId:         payment.userId,
      subscriptionId: payment.subscriptionId,
      paymentId:      payment.id,
      planName,
      amountMinor:    payment.amountMinor,
      currency:       payment.currency,
      periodStart,
      periodEnd,
    });

    // Publish event
    this.eventEmitter.emit(EVENTS.PAYMENT_COMPLETED, {
      paymentId: payment.id, userId: payment.userId, subscriptionId: payment.subscriptionId,
      amountMinor: payment.amountMinor, currency: payment.currency, timestamp: new Date().toISOString(),
    });

    this.logger.log({ message: 'Payment succeeded & processed', paymentId: payment.id });
  }

  private async markFailed(
    payment: { id: string; userId: string; status: PaymentStatus },
    event: NormalizedWebhookEvent,
  ): Promise<void> {
    if (payment.status === PaymentStatus.failed) return;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data:  { status: PaymentStatus.failed, failureReason: event.eventType },
    });
    await this.log(payment.id, 'failed', payment.status, PaymentStatus.failed, null);
    this.eventEmitter.emit(EVENTS.PAYMENT_FAILED, {
      paymentId: payment.id, userId: payment.userId, reason: event.eventType, timestamp: new Date().toISOString(),
    });
  }

  private async markRefunded(
    payment: { id: string; status: PaymentStatus },
    _event: NormalizedWebhookEvent,
  ): Promise<void> {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data:  { status: PaymentStatus.refunded, refundedAt: new Date() },
    });
    await this.log(payment.id, 'refunded', payment.status, PaymentStatus.refunded, null);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async resolvePayment(event: NormalizedWebhookEvent) {
    if (event.paymentId) {
      const byId = await this.prisma.payment.findUnique({ where: { id: event.paymentId } });
      if (byId) return byId;
    }
    if (event.providerRef) {
      return this.prisma.payment.findFirst({ where: { providerRef: event.providerRef } });
    }
    return null;
  }

  private async recordWebhook(
    providerType: PaymentProviderType,
    event: NormalizedWebhookEvent | null,
    status: 'received' | 'duplicate' | 'invalid' | 'failed' | 'processed',
    signatureValid: boolean,
    payload: Record<string, unknown>,
    rawBody: string,
  ) {
    const eventId = event?.eventId ?? `invalid_${Date.now()}`;
    const eventType = event?.eventType ?? 'unknown';
    const dbStatus =
      status === 'invalid' ? 'invalid_signature'
      : status === 'duplicate' ? 'duplicate'
      : status === 'failed' ? 'failed'
      : status === 'processed' ? 'processed'
      : 'received';

    try {
      return await this.prisma.paymentWebhook.create({
        data: {
          providerType, eventId, eventType,
          status: dbStatus as Prisma.PaymentWebhookCreateInput['status'],
          signatureValid,
          payload: (payload ?? { raw: rawBody.slice(0, 2000) }) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Unique violation on (providerType,eventId) means a concurrent insert won — treat as duplicate
      return this.prisma.paymentWebhook.findUniqueOrThrow({
        where: { providerType_eventId: { providerType, eventId } },
      });
    }
  }

  private async log(
    paymentId: string,
    action: string,
    fromStatus: PaymentStatus | null,
    toStatus: PaymentStatus | null,
    actorId: string | null,
  ): Promise<void> {
    await this.prisma.paymentLog.create({
      data: { paymentId, action, fromStatus: fromStatus ?? undefined, toStatus: toStatus ?? undefined, actorId: actorId ?? undefined },
    });
  }

  private async assertCanAccess(targetUserId: string, requester: AuthenticatedUser): Promise<void> {
    if (requester.id === targetUserId) return;
    if (requester.role === ROLE_SLUGS.SUPER_ADMIN) return;
    const hasAdmin = await this.userRoleService.hasPermission(requester.id, PERM.SUBSCRIPTIONS_MANAGE);
    if (!hasAdmin) throw PaymentErrors.forbiddenOwnership();
  }

  private toDto(p: {
    id: string; userId: string; subscriptionId: string | null; amountMinor: number;
    currency: string; status: string; providerType: string; methodType: string | null;
    checkoutUrl: string | null; paidAt: Date | null; createdAt: Date;
  }) {
    return {
      id: p.id, userId: p.userId, subscriptionId: p.subscriptionId, amountMinor: p.amountMinor,
      currency: p.currency, status: p.status, providerType: p.providerType, methodType: p.methodType,
      checkoutUrl: p.checkoutUrl, paidAt: p.paidAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString(),
    };
  }
}
