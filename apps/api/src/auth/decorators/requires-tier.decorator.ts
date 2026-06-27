/**
 * @file requires-tier.decorator.ts
 * @module Auth/Decorators
 *
 * @RequiresTier() route decorator — specifies the minimum subscription tier
 * required to access an endpoint.
 *
 * How it works:
 * - Sets metadata key REQUIRES_TIER_KEY on the route handler
 * - SubscriptionGuard (Sprint 2.4) reads this metadata and checks req.user.subscriptionTier
 *
 * Tier hierarchy: free < basic < pro
 * If the endpoint requires 'basic', then both 'basic' and 'pro' users pass.
 * If the endpoint requires 'pro', only 'pro' users pass.
 *
 * Usage:
 * @RequiresTier('basic')       — Basic and Pro subscribers only
 * @RequiresTier('pro')         — Pro subscribers only
 *
 * Usage in controller:
 * @UseGuards(JwtAuthGuard, SubscriptionGuard)
 * @RequiresTier('pro')
 * @Post('/ai-tutor/conversations')
 * startConversation() { ... }
 */
import { SetMetadata } from '@nestjs/common';
import { REQUIRES_TIER_KEY } from '../auth.constants';

export type SubscriptionTierRequired = 'free' | 'basic' | 'pro';

/**
 * Specify the minimum subscription tier required for this endpoint.
 * @param tier - Minimum tier: 'free' | 'basic' | 'pro'
 */
export const RequiresTier = (tier: SubscriptionTierRequired): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRES_TIER_KEY, tier);
