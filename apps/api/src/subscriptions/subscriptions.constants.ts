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
  /** Free-tier usage cap reached — distinct from SUBSCRIPTION_REQUIRED (which
   * gates a feature entirely): this feature IS reachable on Free, just capped
   * by a usage count. The frontend keys off this code to show the "upgrade to
   * Premium" page instead of a generic error toast. */
  FREE_TIER_LIMIT_REACHED:  'FREE_TIER_LIMIT_REACHED',
} as const;

export type SubscriptionErrorCode =
  (typeof SUBSCRIPTION_ERROR_CODES)[keyof typeof SUBSCRIPTION_ERROR_CODES];

export const PLAN_CACHE_KEY = 'plans:all' as const;
export const PLAN_CACHE_TTL = 3_600 as const;       // 1 hour
export const ACTIVE_SUB_CACHE_PREFIX = 'subscriptions:active:' as const;
export const ACTIVE_SUB_CACHE_TTL = 300 as const;   // 5 minutes

export const FREE_PLAN_LIMITS_CACHE_KEY = 'plans:free-limits' as const;
export const FREE_PLAN_LIMITS_CACHE_TTL = 3_600 as const; // 1 hour — mirrors PLAN_CACHE_TTL

/**
 * Free-tier usage caps read from the `free` SubscriptionPlan's `limits` JSONB
 * column (single configurable source of truth — see FeatureAccessService).
 * These are only the fallback used if that column is ever null, so the app
 * degrades safely rather than crashing; the real numbers live in the DB and
 * are edited via PATCH /plans/:id, not by redeploying code.
 */
export const FALLBACK_FREE_TIER_LIMITS = {
  maxQuestions: 100,
  maxMockExams: 1,
  contentPreviewItems: 10,
} as const;
