/**
 * @file subscription.service.ts
 * @module Subscriptions/Services
 *
 * SubscriptionService — the subscription lifecycle domain.
 *
 * Lifecycle operations:
 *  - subscribe       : create a subscription + initiate payment (or free/trial)
 *  - changePlan      : upgrade/downgrade an active subscription
 *  - renew           : extend the current period (manual/auto trigger)
 *  - cancel          : cancel now or at period end
 *  - expire          : transition past-due → grace → expired (scheduler-driven)
 *  - activateAfterPayment : called by PaymentService when a payment succeeds
 *
 * State machine:
 *   trialing → active → past_due → grace → expired
 *                   ↘ canceled (any time)
 *
 * Free/lifetime plans skip payment. Paid plans create a Payment via
 * PaymentService and only activate once the webhook confirms success.
 *
 * Money is in minor units. Periods are computed from plan.durationDays.
 */
import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SubscriptionStatus,
  PlanInterval,
  PaymentProviderType,
  PaymentMethodType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { EVENTS } from '../../common/constants';
import { ROLE_SLUGS, PERM } from '../../rbac/rbac.constants';
import { UserRoleService } from '../../rbac/services/user-role.service';
import { PlanService } from './plan.service';
import { PaymentService } from '../../payments/services/payment.service';
import { SubscriptionErrors } from '../subscriptions.errors';
import { ACTIVE_SUB_CACHE_PREFIX, ACTIVE_SUB_CACHE_TTL } from '../subscriptions.constants';
import type { SubscribeDto, ChangePlanDto, CancelSubscriptionDto } from '../dto/subscription.dto';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { AppEnvironment } from '../../config/configuration';

interface ActivationResult {
  planName:    string;
  periodStart: Date | null;
  periodEnd:   Date | null;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly planService: PlanService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly userRoleService: UserRoleService,
    private readonly config: ConfigService<AppEnvironment>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Subscribe ────────────────────────────────────────────────────────────────

  async subscribe(user: AuthenticatedUser, dto: SubscribeDto) {
    const plan = await this.planService.getRawById(dto.planId);
    if (!plan.isActive) throw SubscriptionErrors.planInactive();

    // Block if user already has a live subscription
    const active = await this.findLiveSubscription(user.id);
    if (active) throw SubscriptionErrors.alreadySubscribed();

    const now = new Date();
    const isFree = plan.interval === PlanInterval.free || plan.priceMinor === 0;
    const trialEnds = plan.trialDays > 0 ? this.addDays(now, plan.trialDays) : null;

    // Create the subscription row (trialing if trial, else pending activation)
    const subscription = await this.prisma.subscription.create({
      data: {
        userId:           user.id,
        planId:           plan.id,
        status:           trialEnds ? SubscriptionStatus.trialing
                          : isFree   ? SubscriptionStatus.active
                          : SubscriptionStatus.trialing,
        trialEndsAt:      trialEnds,
        currentPeriodStart: isFree || trialEnds ? now : null,
        currentPeriodEnd:   isFree ? this.computePeriodEnd(now, plan.interval, plan.durationDays, plan.fixedExpiryDate)
                            : trialEnds ?? null,
        autoRenew:        !isFree,
        providerType:     isFree ? null : (dto.provider as PaymentProviderType) ?? null,
      },
    });

    await this.invalidateActiveCache(user.id);

    // Free or trial-with-no-charge: activate immediately, no payment
    if (isFree) {
      this.logger.log({ message: 'Free subscription activated', userId: user.id, planId: plan.id });
      this.eventEmitter.emit(EVENTS.SUBSCRIPTION_ACTIVATED, {
        subscriptionId: subscription.id, userId: user.id, planId: plan.id, free: true,
        timestamp: now.toISOString(),
      });
      return { subscription: this.toDto(subscription), payment: null };
    }

    // Paid: create a payment + checkout
    const provider = (dto.provider as PaymentProviderType) ?? this.defaultProvider();
    const payment = await this.paymentService.createPayment({
      userId:         user.id,
      subscriptionId: subscription.id,
      amountMinor:    plan.priceMinor,
      currency:       plan.currency,
      provider,
      method:         dto.method as PaymentMethodType | undefined,
      description:    `${plan.name} subscription`,
      customerEmail:  user.email,
      successUrl:     `${this.frontendUrl()}/billing/success?sub=${subscription.id}`,
      cancelUrl:      `${this.frontendUrl()}/billing/cancel?sub=${subscription.id}`,
      idempotencyKey: dto.idempotencyKey,
    });

    return { subscription: this.toDto(subscription), payment };
  }

  // ── Change plan (upgrade / downgrade) ───────────────────────────────────────

  async changePlan(user: AuthenticatedUser, dto: ChangePlanDto) {
    const current = await this.findLiveSubscription(user.id);
    if (!current) throw SubscriptionErrors.noActiveSubscription();
    if (current.planId === dto.planId) throw SubscriptionErrors.samePlan();

    const newPlan = await this.planService.getRawById(dto.planId);
    if (!newPlan.isActive) throw SubscriptionErrors.planInactive();

    const currentPlan = await this.planService.getRawById(current.planId);
    const isUpgrade = newPlan.priceMinor > currentPlan.priceMinor;

    // Downgrade or same-price: switch at period end (no immediate charge)
    if (!isUpgrade) {
      const updated = await this.prisma.subscription.update({
        where: { id: current.id },
        data:  { planId: newPlan.id, version: { increment: 1 } },
      });
      await this.invalidateActiveCache(user.id);
      this.eventEmitter.emit(EVENTS.SUBSCRIPTION_CHANGED, {
        subscriptionId: current.id, userId: user.id, fromPlan: current.planId, toPlan: newPlan.id,
        direction: 'downgrade', timestamp: new Date().toISOString(),
      });
      return { subscription: this.toDto(updated), payment: null };
    }

    // Upgrade: charge the new plan, switch on payment success
    const provider = (dto.provider as PaymentProviderType) ?? this.defaultProvider();
    const payment = await this.paymentService.createPayment({
      userId:         user.id,
      subscriptionId: current.id,
      amountMinor:    newPlan.priceMinor,
      currency:       newPlan.currency,
      provider,
      method:         dto.method as PaymentMethodType | undefined,
      description:    `Upgrade to ${newPlan.name}`,
      customerEmail:  user.email,
      successUrl:     `${this.frontendUrl()}/billing/success?sub=${current.id}`,
      cancelUrl:      `${this.frontendUrl()}/billing/cancel?sub=${current.id}`,
      idempotencyKey: dto.idempotencyKey,
    });

    // Stash the target plan so activateAfterPayment switches it
    await this.prisma.subscription.update({
      where: { id: current.id },
      data:  { providerRef: `pending_upgrade:${newPlan.id}` },
    });

    return { subscription: this.toDto(current), payment };
  }

  // ── Renew ────────────────────────────────────────────────────────────────────

  async renew(subscriptionId: string): Promise<ActivationResult> {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw SubscriptionErrors.subscriptionNotFound();
    const plan = await this.planService.getRawById(sub.planId);

    const start = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    const end = this.computePeriodEnd(start, plan.interval, plan.durationDays, plan.fixedExpiryDate);

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.active,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        graceEndsAt: null,
        version: { increment: 1 },
      },
    });
    await this.invalidateActiveCache(sub.userId);

    this.eventEmitter.emit(EVENTS.SUBSCRIPTION_RENEWED, {
      subscriptionId, userId: sub.userId, periodEnd: end?.toISOString() ?? null, timestamp: new Date().toISOString(),
    });

    return { planName: plan.name, periodStart: start, periodEnd: end };
  }

  // ── Cancel ────────────────────────────────────────────────────────────────────

  async cancel(user: AuthenticatedUser, dto: CancelSubscriptionDto) {
    const sub = await this.findLiveSubscription(user.id);
    if (!sub) throw SubscriptionErrors.noActiveSubscription();

    const now = new Date();
    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: dto.atPeriodEnd
        ? { cancelAtPeriodEnd: true, autoRenew: false, canceledAt: now, version: { increment: 1 } }
        : { status: SubscriptionStatus.canceled, autoRenew: false, canceledAt: now, currentPeriodEnd: now, version: { increment: 1 } },
    });
    await this.invalidateActiveCache(user.id);

    this.logger.log({ message: 'Subscription canceled', subscriptionId: sub.id, userId: user.id, atPeriodEnd: dto.atPeriodEnd });
    this.eventEmitter.emit(EVENTS.SUBSCRIPTION_CANCELED, {
      subscriptionId: sub.id, userId: user.id, atPeriodEnd: dto.atPeriodEnd, reason: dto.reason ?? null,
      timestamp: now.toISOString(),
    });

    return this.toDto(updated);
  }

  // ── Expire (scheduler-driven) ───────────────────────────────────────────────

  /**
   * Transition subscriptions whose period has ended.
   * active → past_due → (grace window) → expired.
   * Returns the count transitioned (for the scheduler/cron to log).
   */
  async expireDue(now = new Date()): Promise<{ pastDue: number; expired: number }> {
    const graceDays = this.config.get('PAYMENT_GRACE_PERIOD_DAYS', { infer: true }) ?? 3;

    // 1. active subscriptions past their period end with auto-renew off → expire directly
    const toExpireDirect = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.active, autoRenew: false, currentPeriodEnd: { lt: now } },
      select: { id: true, userId: true },
    });
    for (const s of toExpireDirect) {
      await this.prisma.subscription.update({ where: { id: s.id }, data: { status: SubscriptionStatus.expired } });
      await this.invalidateActiveCache(s.userId);
      this.eventEmitter.emit(EVENTS.SUBSCRIPTION_EXPIRED, { subscriptionId: s.id, userId: s.userId, timestamp: now.toISOString() });
    }

    // 2. active + auto-renew but period ended → past_due with grace window
    const toPastDue = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.active, autoRenew: true, currentPeriodEnd: { lt: now } },
      select: { id: true, userId: true },
    });
    for (const s of toPastDue) {
      await this.prisma.subscription.update({
        where: { id: s.id },
        data:  { status: SubscriptionStatus.past_due, graceEndsAt: this.addDays(now, graceDays) },
      });
      await this.invalidateActiveCache(s.userId);
    }

    // 3. past_due/grace whose grace window elapsed → expired
    const toExpireGrace = await this.prisma.subscription.findMany({
      where: { status: { in: [SubscriptionStatus.past_due, SubscriptionStatus.grace] }, graceEndsAt: { lt: now } },
      select: { id: true, userId: true },
    });
    for (const s of toExpireGrace) {
      await this.prisma.subscription.update({ where: { id: s.id }, data: { status: SubscriptionStatus.expired } });
      await this.invalidateActiveCache(s.userId);
      this.eventEmitter.emit(EVENTS.SUBSCRIPTION_EXPIRED, { subscriptionId: s.id, userId: s.userId, timestamp: now.toISOString() });
    }

    return { pastDue: toPastDue.length, expired: toExpireDirect.length + toExpireGrace.length };
  }

  // ── Activate after payment (called by PaymentService) ───────────────────────

  async activateAfterPayment(subscriptionId: string): Promise<ActivationResult> {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw SubscriptionErrors.subscriptionNotFound();

    // Handle a pending plan switch encoded during upgrade
    let planId = sub.planId;
    if (sub.providerRef?.startsWith('pending_upgrade:')) {
      planId = sub.providerRef.split(':')[1] ?? sub.planId;
    }

    const plan = await this.planService.getRawById(planId);
    const now = new Date();
    const start = now;
    const end = this.computePeriodEnd(start, plan.interval, plan.durationDays, plan.fixedExpiryDate);

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId,
        status: SubscriptionStatus.active,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        trialEndsAt: null,
        graceEndsAt: null,
        providerRef: null,
        version: { increment: 1 },
      },
    });
    await this.invalidateActiveCache(sub.userId);

    this.eventEmitter.emit(EVENTS.SUBSCRIPTION_ACTIVATED, {
      subscriptionId, userId: sub.userId, planId, free: false, timestamp: now.toISOString(),
    });

    return { planName: plan.name, periodStart: start, periodEnd: end };
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async getMySubscription(user: AuthenticatedUser) {
    const cacheKey = `${ACTIVE_SUB_CACHE_PREFIX}${user.id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const sub = await this.findLiveSubscription(user.id);
    const result = sub ? this.toDto(sub) : null;
    if (result) await this.cache.set(cacheKey, result, ACTIVE_SUB_CACHE_TTL);
    return result;
  }

  async getById(requester: AuthenticatedUser, id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id }, include: { plan: { select: { name: true, tier: true } } } });
    if (!sub) throw SubscriptionErrors.subscriptionNotFound();
    if (requester.id !== sub.userId && requester.role !== ROLE_SLUGS.SUPER_ADMIN) {
      const hasAdmin = await this.userRoleService.hasPermission(requester.id, PERM.SUBSCRIPTIONS_MANAGE);
      if (!hasAdmin) throw SubscriptionErrors.forbiddenOwnership();
    }
    return this.toDto(sub);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findLiveSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.trialing, SubscriptionStatus.active, SubscriptionStatus.past_due, SubscriptionStatus.grace] },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true, tier: true } } },
    });
  }

  /**
   * interval='custom' plans (e.g. Board Pass — "valid until the next
   * scheduled PRC CE board exam") ignore durationDays entirely: every
   * purchase expires on the same admin-set fixedExpiryDate, regardless of
   * purchase date. Update that date each exam cycle via PATCH /plans/:id —
   * no code change needed.
   */
  private computePeriodEnd(start: Date, interval: PlanInterval, durationDays: number | null, fixedExpiryDate?: Date | null): Date | null {
    if (interval === PlanInterval.custom) return fixedExpiryDate ?? null;
    if (interval === PlanInterval.lifetime || interval === PlanInterval.free) return null;
    if (durationDays) return this.addDays(start, durationDays);
    const map: Record<string, number> = { monthly: 30, quarterly: 90, annual: 365 };
    return this.addDays(start, map[interval] ?? 30);
  }

  private addDays(d: Date, days: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  }

  private defaultProvider(): PaymentProviderType {
    return (this.config.get('PAYMENT_DEFAULT_PROVIDER', { infer: true }) ?? 'mock') as PaymentProviderType;
  }

  private frontendUrl(): string {
    return this.config.get('FRONTEND_URL', { infer: true }) ?? 'https://app.ce-boardmaster.ph';
  }

  private async invalidateActiveCache(userId: string): Promise<void> {
    await this.cache.del(`${ACTIVE_SUB_CACHE_PREFIX}${userId}`);
  }

  private toDto(s: {
    id: string; userId: string; planId: string; status: string;
    currentPeriodStart: Date | null; currentPeriodEnd: Date | null; trialEndsAt: Date | null;
    cancelAtPeriodEnd: boolean; autoRenew: boolean; version: number;
    plan?: { name: string; tier: string } | null;
  }) {
    return {
      id: s.id, userId: s.userId, planId: s.planId, status: s.status,
      currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd, autoRenew: s.autoRenew, version: s.version,
      planName: s.plan?.name ?? null, tier: s.plan?.tier ?? null,
    };
  }
}
