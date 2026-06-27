/**
 * @file ai.constants.ts
 * @module AI/Constants
 *
 * Constants for the AI Content Generation Engine. Generation is grounded
 * exclusively in the Sprint 2.8 Knowledge Base; these constants govern the
 * engine's behavior (limits, difficulty bands, variant policy) and error codes.
 */

export const AI_ERROR_CODES = {
  GENERATION_NOT_FOUND:    'GENERATION_NOT_FOUND',
  LO_NOT_FOUND:            'LO_NOT_FOUND',
  LO_NOT_PUBLISHED:        'LO_NOT_PUBLISHED',
  BLUEPRINT_NOT_FOUND:     'BLUEPRINT_NOT_FOUND',
  BLUEPRINT_NOT_PUBLISHED: 'BLUEPRINT_NOT_PUBLISHED',
  KB_GROUNDING_REQUIRED:   'KB_GROUNDING_REQUIRED',
  GENERATION_FAILED:       'GENERATION_FAILED',
  VALIDATION_FAILED:       'VALIDATION_FAILED',
  NOT_VALIDATED:           'NOT_VALIDATED',
  ALREADY_PROMOTED:        'ALREADY_PROMOTED',
  DUPLICATE_CONTENT:       'DUPLICATE_CONTENT',
  QUOTA_EXCEEDED:          'QUOTA_EXCEEDED',
  SUBSCRIPTION_REQUIRED:   'SUBSCRIPTION_REQUIRED',
  INVALID_VARIANT_REQUEST: 'INVALID_VARIANT_REQUEST',
  PROVIDER_ERROR:          'PROVIDER_ERROR',
} as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

/** Difficulty bands the engine scales across (aligned with the blueprint spec). */
export const DIFFICULTY_BANDS = ['foundation', 'easy', 'moderate', 'difficult', 'board_level'] as const;
export type DifficultyBand = (typeof DIFFICULTY_BANDS)[number];

/** Ordered scale used by DifficultyScalingService. */
export const DIFFICULTY_SCALE: Record<DifficultyBand, number> = {
  foundation: 1, easy: 2, moderate: 3, difficult: 4, board_level: 5,
};

/** Generation limits (defensive caps; subscription quota is enforced separately). */
export const AI_LIMITS = {
  MAX_VARIANTS_PER_REQUEST: 10,
  MAX_DISTRACTORS: 5,
  MIN_DISTRACTORS: 3,
  MAX_SOLUTION_STEPS: 12,
  DEFAULT_VARIANT_COUNT: 3,
  DUPLICATE_SIMILARITY_THRESHOLD: 0.92, // cosine-ish token overlap on normalized stem
} as const;

/** Number of generations a subscription tier may run per day. */
export const AI_TIER_DAILY_QUOTA: Record<string, number> = {
  free: 5,
  basic: 25,
  pro: 100,
  premium: 250,
  enterprise: 1000,
};

/** Provider names. */
export const AI_PROVIDERS = {
  DETERMINISTIC: 'deterministic',
} as const;

export const AI_CACHE_PREFIX = 'ai_generation:' as const;

/** Choice letters used in generated multiple-choice questions. */
export const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
