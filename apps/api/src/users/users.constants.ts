/**
 * @file users.constants.ts
 * @module Users
 *
 * Constants for the Users module — cache keys, TTLs, error codes, and
 * the event payload contract.
 */

// ── Cache keys ────────────────────────────────────────────────────────────────

/** Cache key prefix for a single user detail by id */
export const USER_CACHE_PREFIX = 'users:detail:' as const;

/** Cache key prefix for a user list page (admin) */
export const USER_LIST_CACHE_PREFIX = 'users:list:' as const;

/** TTL for single-user cache (seconds) */
export const USER_CACHE_TTL = 300 as const; // 5 minutes

/** TTL for user-list cache (seconds) */
export const USER_LIST_CACHE_TTL = 60 as const; // 1 minute

// ── Error codes ───────────────────────────────────────────────────────────────

export const USER_ERROR_CODES = {
  USER_NOT_FOUND:        'USER_NOT_FOUND',
  USERNAME_TAKEN:        'USERNAME_TAKEN',
  EMAIL_TAKEN:           'EMAIL_TAKEN',
  FORBIDDEN_OWNERSHIP:   'FORBIDDEN_OWNERSHIP',
  VERSION_CONFLICT:      'VERSION_CONFLICT',
  CANNOT_DELETE_SELF:    'CANNOT_DELETE_SELF',
  CANNOT_MODIFY_SUPERADMIN: 'CANNOT_MODIFY_SUPERADMIN',
} as const;

export type UserErrorCode = (typeof USER_ERROR_CODES)[keyof typeof USER_ERROR_CODES];
