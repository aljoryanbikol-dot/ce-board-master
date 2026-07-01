/**
 * @file subscription.guard.ts
 * @module Auth/Guards
 *
 * SubscriptionGuard — enforces the minimum subscription tier set by
 * @RequiresTier() on a route. This is the guard that decorator's own doc
 * comment has referenced since it was added ("SubscriptionGuard (Sprint 2.4)
 * reads this metadata") — it did not exist until now.
 *
 * Execution order: JwtAuthGuard → RolesGuard → PermissionGuard → SubscriptionGuard
 * (tier is a separate axis from role/permission — a subscriber and a
 * free_user can hold the same role but different tiers).
 *
 * Tier hierarchy: free < basic < pro. @RequiresTier('basic') admits both
 * 'basic' and 'pro' users. @RequiresTier('pro') admits only 'pro'.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, SubscriptionGuard)
 * @RequiresTier('pro')
 * @Post('/ai-tutor/conversations')
 * startConversation() { ... }
 *
 * @see @RequiresTier() decorator — auth/decorators/requires-tier.decorator.ts
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_TIER_KEY, AUTH_ERROR_CODES } from '../auth.constants';
import { ROLE_SLUGS } from '../../rbac/rbac.constants';
import type { AuthenticatedUser } from '../auth.types';
import type { TierRequirement } from '../auth.types';

/** Ordinal rank for tier comparison — higher rank satisfies a lower requirement. */
const TIER_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2 };

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TierRequirement>(REQUIRES_TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequiresTier() (or explicitly 'none') — no tier restriction beyond authentication.
    if (!required || required === 'none') {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser; url: string }>();
    const user = request.user;

    if (!user) {
      this.logger.error('SubscriptionGuard reached without req.user — JwtAuthGuard should have rejected first');
      throw new ForbiddenException({ code: AUTH_ERROR_CODES.UNAUTHORIZED, message: 'Authentication required.' });
    }

    // Super admins bypass tier restrictions, same as RolesGuard/PermissionGuard.
    if (user.role === ROLE_SLUGS.SUPER_ADMIN) {
      return true;
    }

    const userRank = TIER_RANK[user.subscriptionTier] ?? 0;
    const requiredRank = TIER_RANK[required] ?? 0;

    if (userRank < requiredRank) {
      this.logger.warn({
        message: 'Access denied — insufficient subscription tier',
        userId: user.id, userTier: user.subscriptionTier, requiredTier: required,
        path: request.url,
      });
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.SUBSCRIPTION_REQUIRED,
        message: `This feature requires the '${required}' plan or higher.`,
      });
    }

    return true;
  }
}
