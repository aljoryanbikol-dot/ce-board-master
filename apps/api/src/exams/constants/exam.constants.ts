/**
 * @file exam.constants.ts
 * @module Exams/Constants
 */

export const EXAM_ERROR_CODES = {
  TEMPLATE_NOT_FOUND:      'TEMPLATE_NOT_FOUND',
  TEMPLATE_INACTIVE:       'TEMPLATE_INACTIVE',
  EXAM_NOT_FOUND:          'EXAM_NOT_FOUND',
  EXAM_FORBIDDEN:          'EXAM_FORBIDDEN',
  EXAM_NOT_IN_PROGRESS:    'EXAM_NOT_IN_PROGRESS',
  EXAM_ALREADY_STARTED:    'EXAM_ALREADY_STARTED',
  EXAM_ALREADY_SUBMITTED:  'EXAM_ALREADY_SUBMITTED',
  EXAM_EXPIRED:            'EXAM_EXPIRED',
  EXAM_NOT_PAUSED:         'EXAM_NOT_PAUSED',
  EXAM_QUESTION_NOT_FOUND: 'EXAM_QUESTION_NOT_FOUND',
  INVALID_CHOICE:          'INVALID_CHOICE',
  INSUFFICIENT_QUESTIONS:  'INSUFFICIENT_QUESTIONS',
  INVALID_COMPOSITION:     'INVALID_COMPOSITION',
  RESULT_NOT_FOUND:        'RESULT_NOT_FOUND',
  RESULT_NOT_READY:        'RESULT_NOT_READY',
  OWNERSHIP_VIOLATION:     'OWNERSHIP_VIOLATION',
} as const;

export type ExamErrorCode = (typeof EXAM_ERROR_CODES)[keyof typeof EXAM_ERROR_CODES];

export const EXAM_LIMITS = {
  MIN_QUESTIONS: 5,
  MAX_QUESTIONS: 500,
  MIN_DURATION_MIN: 5,
  MAX_DURATION_MIN: 600,
  DEFAULT_PASSING_SCORE: 70,
  MIN_PASSING_SCORE: 1,
  MAX_PASSING_SCORE: 100,
  AUTO_SUBMIT_GRACE_SEC: 5, // tolerance past expiry before auto-submit grading
} as const;

/** Adaptive difficulty: how performance shifts difficulty selection. */
export const ADAPTIVE_RULES = {
  WINDOW: 5,               // look at the last N answers
  PROMOTE_ACCURACY: 0.8,   // >= → harder questions
  DEMOTE_ACCURACY: 0.4,    // <= → easier questions
} as const;

/** Default choice letters in canonical order. */
export const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Weakness/strength thresholds on a subject/topic score percentage. */
export const ANALYSIS_RULES = {
  WEAK_BELOW: 60,
  STRONG_AT_OR_ABOVE: 80,
} as const;

export const RESULT_CODE_PREFIX = 'CEBM-EX';
