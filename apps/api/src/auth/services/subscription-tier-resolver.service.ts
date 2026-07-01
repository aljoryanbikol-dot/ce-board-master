/**
 * @file subscription-tier-resolver.service.ts
 * @module Auth/Services
 *
 * SubscriptionTierResolverService — resolves the tier that belongs in a
 * user's JWT/AuthenticatedUser claims from their live Subscription + Plan.
 *
 * Every JWT-issuing path (register, login, refresh, OAuth) previously
 * hardcoded `subscriptionTier: 'free'` with a "Sprint 2.5: resolve from
 * subscriptions table" TODO comment, and TokenService.resolveSubscriptionTier
 * was itself a stub that always returned 'free' regardless of the user. That
 * meant a Premium purchase would never actually change what a user's own
 * token said until some unrelated future change wired this up — Sprint 3.3
 * is that wiring. Kept inside the auth module (not importing SubscriptionModule)
 * to preserve the existing dependency direction — Subscriptions/Payments
 * depend on Auth, not the other way around.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { SubscriptionTier } from '../../common/types';

/** Statuses that count as "currently entitled" — mirrors
 * SubscriptionService.findLiveSubscription's own status filter. */
const LIVE_STATUSES = ['trialing', 'active', 'past_due', 'grace'] as const;

@Injectable()
export class SubscriptionTierResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<SubscriptionTier> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [...LIVE_STATUSES] as never } },
      orderBy: { createdAt: 'desc' },
      select: { plan: { select: { tier: true } } },
    });
    return (sub?.plan.tier as SubscriptionTier | undefined) ?? 'free';
  }
}
