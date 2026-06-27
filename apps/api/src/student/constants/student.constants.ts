/**
 * @file student.constants.ts
 * @module Student/Constants
 */

export const STUDENT_ERROR_CODES = {
  SESSION_NOT_FOUND:      'SESSION_NOT_FOUND',
  SESSION_NOT_ACTIVE:     'SESSION_NOT_ACTIVE',
  SESSION_FORBIDDEN:      'SESSION_FORBIDDEN',
  QUESTION_NOT_FOUND:     'QUESTION_NOT_FOUND',
  QUESTION_NOT_AVAILABLE: 'QUESTION_NOT_AVAILABLE',
  ALREADY_BOOKMARKED:     'ALREADY_BOOKMARKED',
  BOOKMARK_NOT_FOUND:     'BOOKMARK_NOT_FOUND',
  ALREADY_FAVORITED:      'ALREADY_FAVORITED',
  FAVORITE_NOT_FOUND:     'FAVORITE_NOT_FOUND',
  GOAL_NOT_FOUND:         'GOAL_NOT_FOUND',
  PLAN_NOT_FOUND:         'PLAN_NOT_FOUND',
  PLAN_FORBIDDEN:         'PLAN_FORBIDDEN',
  TASK_NOT_FOUND:         'TASK_NOT_FOUND',
  NO_RECOMMENDATIONS:     'NO_RECOMMENDATIONS',
  OWNERSHIP_VIOLATION:    'OWNERSHIP_VIOLATION',
  INVALID_PRACTICE_TARGET:'INVALID_PRACTICE_TARGET',
} as const;

export type StudentErrorCode = (typeof STUDENT_ERROR_CODES)[keyof typeof STUDENT_ERROR_CODES];

/** XP awarded for various actions. */
export const XP_RULES = {
  CORRECT_ANSWER: 10,
  INCORRECT_ANSWER: 2,      // participation
  SESSION_COMPLETED: 25,
  DAILY_GOAL_MET: 50,
  STREAK_BONUS_PER_DAY: 5,  // multiplied by current streak (capped)
  STREAK_BONUS_CAP: 100,
  FIRST_ATTEMPT_BONUS: 5,
} as const;

/**
 * Level curve: XP required to *reach* level N is QUADRATIC.
 * level = floor( sqrt(totalXp / LEVEL_FACTOR) ) + 1
 */
export const LEVEL_FACTOR = 100;

/** Mastery tier thresholds on the 0–100 mastery score. */
export const MASTERY_THRESHOLDS = {
  novice: 0,
  developing: 40,
  proficient: 60,
  advanced: 80,
  mastered: 92,
} as const;

/** Mastery score weighting: accuracy is primary, volume gives confidence. */
export const MASTERY_WEIGHTS = {
  ACCURACY: 0.8,
  VOLUME_CONFIDENCE: 0.2,
  VOLUME_SATURATION: 20, // attempts at which volume confidence maxes out
} as const;

/** Knowledge-gap detection. */
export const GAP_RULES = {
  MIN_ATTEMPTS: 5,            // need enough data to call it a gap
  CRITICAL_ACCURACY: 0.4,
  MODERATE_ACCURACY: 0.6,
  MINOR_ACCURACY: 0.75,      // below this (but >= moderate) = minor
  WEAK_TOPIC_ACCURACY: 0.7,
  STRONG_TOPIC_ACCURACY: 0.85,
} as const;

export const PRACTICE_LIMITS = {
  MIN_QUESTIONS: 1,
  MAX_QUESTIONS: 50,
  DEFAULT_QUESTIONS: 10,
  RECENTLY_VIEWED_CAP: 50,
} as const;

export const RECOMMENDATION_LIMITS = {
  DEFAULT: 10,
  MAX: 30,
} as const;
