/**
 * @file manual-payment.service.ts
 * @module Payments/Services
 *
 * ManualPaymentService — direct-GCash payments with admin approval.
 *
 * For operators without a registered business (no payment-gateway KYC yet):
 * the student sends the exact plan amount to the operator's personal GCash
 * number, submits the GCash reference number, and an admin approves the
 * payment after checking the transfer in their GCash app. Approval reuses
 * PaymentService.settleManualPayment, which runs the same activation +
 * invoice pipeline as gateway webhooks.
 *
 * The payee is displayed as the platform name + mobile number only — the
 * account holder's personal name is deliberately never exposed.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentMethodType, PaymentProviderType, PaymentStatus, SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaymentService } from './payment.service';
import { PaymentErrors } from '../payments.errors';
import { PlanService } from '../../subscriptions/services/plan.service';
import type { AuthenticatedUser } from '../../auth/auth.types';

/** Personal GCash payee — number only; the holder's name is never displayed. */
const GCASH_NUMBER = process.env.MANUAL_GCASH_NUMBER ?? '09564890446';
const GCASH_LABEL = 'CE Board Master';

@Injectable()
export class ManualPaymentService {
  private readonly logger = new Logger(ManualPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly planService: PlanService,
  ) {}

  /** Payment instructions shown on the checkout dialog. */
  getConfig() {
    return {
      method: 'gcash',
      accountLabel: GCASH_LABEL,
      accountNumber: GCASH_NUMBER,
      instructions: [
        `Open GCash and send the exact plan amount to ${GCASH_NUMBER} (${GCASH_LABEL}).`,
        'Copy the 13-digit Reference No. from your GCash receipt.',
        'Paste the reference number below and submit.',
        'Your Premium access is activated after a quick verification (usually within a few hours).',
      ],
    };
  }

  /** Student submits a GCash transfer for verification. */
  async submit(user: AuthenticatedUser, dto: { planId: string; referenceNo: string }) {
    const plan = await this.planService.getRawById(dto.planId);
    if (!plan.isActive || plan.priceMinor <= 0) throw PaymentErrors.notFound(dto.planId);

    const referenceNo = dto.referenceNo.replace(/\s+/g, '');
    const providerRef = `GCASH-${referenceNo}`;

    // A GCash reference number is unique per transfer — reject reuse.
    const dupe = await this.prisma.payment.findFirst({ where: { providerRef } });
    if (dupe) throw PaymentErrors.idempotencyConflict();

    // Reuse an existing not-yet-active subscription for this plan, else create.
    let subscription = await this.prisma.subscription.findFirst({
      where: { userId: user.id, planId: plan.id, status: SubscriptionStatus.trialing },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) {
      subscription = await this.prisma.subscription.create({
        data: {
          userId: user.id, planId: plan.id,
          status: SubscriptionStatus.trialing,
          autoRenew: false, // manual payments don't auto-renew
          providerType: PaymentProviderType.manual,
        },
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        amountMinor: plan.priceMinor,
        currency: plan.currency,
        status: PaymentStatus.processing,
        providerType: PaymentProviderType.manual,
        methodType: PaymentMethodType.gcash,
        providerRef,
        metadata: { referenceNo, planSlug: plan.slug, channel: 'manual_gcash' },
      },
    });

    this.logger.log({ message: 'Manual GCash payment submitted', paymentId: payment.id, userId: user.id, plan: plan.slug });
    return {
      paymentId: payment.id,
      status: payment.status,
      amountMinor: payment.amountMinor,
      referenceNo,
      message: 'Salamat! Ive-verify namin ang bayad mo at maa-activate ang Premium mo sa lalong madaling panahon.',
    };
  }

  /** My pending/settled manual submissions (student view). */
  async mine(userId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { userId, providerType: PaymentProviderType.manual },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, amountMinor: true, status: true, providerRef: true, createdAt: true, paidAt: true },
    });
    return rows.map((r) => ({ ...r, referenceNo: r.providerRef?.replace('GCASH-', '') ?? null }));
  }

  /** Admin: pending manual payments queue. */
  async listPending() {
    const rows = await this.prisma.payment.findMany({
      where: { providerType: PaymentProviderType.manual, status: PaymentStatus.processing },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { email: true } },
        subscription: { select: { plan: { select: { name: true, slug: true, priceMinor: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.user.email,
      plan: r.subscription?.plan?.name ?? '—',
      amountMinor: r.amountMinor,
      referenceNo: r.providerRef?.replace('GCASH-', '') ?? '—',
      submittedAt: r.createdAt,
    }));
  }

  async approve(paymentId: string, admin: AuthenticatedUser) {
    return this.paymentService.settleManualPayment(paymentId, admin.id, 'approve');
  }

  async reject(paymentId: string, admin: AuthenticatedUser, reason?: string) {
    return this.paymentService.settleManualPayment(paymentId, admin.id, 'reject', reason);
  }
}
