/**
 * @file profiles.constants.ts
 * @module Profiles
 *
 * Constants for the Profiles module.
 */

/** Cache key prefix for a user's own profile */
export const PROFILE_CACHE_PREFIX = 'profiles:detail:' as const;

/** TTL for profile cache (seconds) */
export const PROFILE_CACHE_TTL = 300 as const; // 5 minutes

export const PROFILE_ERROR_CODES = {
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  VERSION_CONFLICT:  'VERSION_CONFLICT',
  INVALID_AVATAR_URL: 'INVALID_AVATAR_URL',
} as const;

export type ProfileErrorCode = (typeof PROFILE_ERROR_CODES)[keyof typeof PROFILE_ERROR_CODES];

/** Allowed theme values. */
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/** Supported UI languages (ISO 639-1). Extend as the app localises. */
export const SUPPORTED_LANGUAGES = ['en', 'fil'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
