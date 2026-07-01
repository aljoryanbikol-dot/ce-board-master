/**
 * @file subscriptions.errors.ts
 * @module Subscriptions
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SUBSCRIPTION_ERROR_CODES as E } from './subscriptions.constants';

export const SubscriptionErrors = {
  planNotFound: (id: string) =>
    new NotFoundException({ code: E.PLAN_NOT_FOUND, message: `Plan not found: ${id}` }),
  planInactive: () =>
    new BadRequestException({ code: E.PLAN_INACTIVE, message: 'This plan is not currently available.' }),
  subscriptionNotFound: () =>
    new NotFoundException({ code: E.SUBSCRIPTION_NOT_FOUND, message: 'No subscription found.' }),
  alreadySubscribed: () =>
    new ConflictException({ code: E.ALREADY_SUBSCRIBED, message: 'You already have an active subscription. Use change-plan to upgrade or downgrade.' }),
  noActiveSubscription: () =>
    new BadRequestException({ code: E.NO_ACTIVE_SUBSCRIPTION, message: 'You do not have an active subscription.' }),
  samePlan: () =>
    new BadRequestException({ code: E.SAME_PLAN, message: 'You are already on this plan.' }),
  forbiddenOwnership: () =>
    new ForbiddenException({ code: E.FORBIDDEN_OWNERSHIP, message: 'You do not have access to this subscription.' }),
  versionConflict: () =>
    new ConflictException({ code: E.VERSION_CONFLICT, message: 'This subscription was modified concurrently. Reload and retry.' }),
  duplicatePlanSlug: (slug: string) =>
    new ConflictException({ code: E.DUPLICATE_PLAN_SLUG, message: `A plan with slug '${slug}' already exists.` }),
  freeTierLimitReached: (feature: string, limit: number) =>
    new ForbiddenException({
      code: E.FREE_TIER_LIMIT_REACHED,
      message: `You've reached the Free plan limit for ${feature} (${limit}). Upgrade to Premium for unlimited access.`,
      feature, limit, upgradeRequired: true,
    }),
} as const;
