/**
 * @file subscriptions.constants.ts
 * @module Subscriptions
 */
export const SUBSCRIPTION_ERROR_CODES = {
  PLAN_NOT_FOUND:           'PLAN_NOT_FOUND',
  PLAN_INACTIVE:            'PLAN_INACTIVE',
  SUBSCRIPTION_NOT_FOUND:   'SUBSCRIPTION_NOT_FOUND',
  ALREADY_SUBSCRIBED:       'ALREADY_SUBSCRIBED',
  NO_ACTIVE_SUBSCRIPTION:   'NO_ACTIVE_SUBSCRIPTION',
  SAME_PLAN:                'SAME_PLAN',
  FORBIDDEN_OWNERSHIP:      'FORBIDDEN_OWNERSHIP',
  VERSION_CONFLICT:         'VERSION_CONFLICT',
  DUPLICATE_PLAN_SLUG:      'DUPLICATE_PLAN_SLUG',
} as const;

export type SubscriptionErrorCode =
  (typeof SUBSCRIPTION_ERROR_CODES)[keyof typeof SUBSCRIPTION_ERROR_CODES];

export const PLAN_CACHE_KEY = 'plans:all' as const;
export const PLAN_CACHE_TTL = 3_600 as const;       // 1 hour
export const ACTIVE_SUB_CACHE_PREFIX = 'subscriptions:active:' as const;
export const ACTIVE_SUB_CACHE_TTL = 300 as const;   // 5 minutes
