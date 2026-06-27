/**
 * @file tutor.constants.ts
 * @module AITutor/Constants
 */

export const TUTOR_ERROR_CODES = {
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  CONVERSATION_FORBIDDEN: 'CONVERSATION_FORBIDDEN',
  CONVERSATION_ARCHIVED:  'CONVERSATION_ARCHIVED',
  MESSAGE_NOT_FOUND:      'MESSAGE_NOT_FOUND',
  QUESTION_NOT_FOUND:     'QUESTION_NOT_FOUND',
  QUESTION_NOT_AVAILABLE: 'QUESTION_NOT_AVAILABLE',
  EMPTY_MESSAGE:          'EMPTY_MESSAGE',
  MESSAGE_TOO_LONG:       'MESSAGE_TOO_LONG',
  HINT_LIMIT_REACHED:     'HINT_LIMIT_REACHED',
  NO_COACHING_AVAILABLE:  'NO_COACHING_AVAILABLE',
  COACHING_NOT_FOUND:     'COACHING_NOT_FOUND',
  OWNERSHIP_VIOLATION:    'OWNERSHIP_VIOLATION',
} as const;

export type TutorErrorCode = (typeof TUTOR_ERROR_CODES)[keyof typeof TUTOR_ERROR_CODES];

export const TUTOR_LIMITS = {
  MAX_MESSAGE_CHARS: 4000,
  MAX_TITLE_CHARS: 200,
  MEMORY_WINDOW_MESSAGES: 10,   // how many recent turns to keep in the working context
  MEMORY_SUMMARY_TRIGGER: 12,   // summarize once a thread exceeds this many messages
  MAX_HINTS_PER_QUESTION: 3,    // progressive hints before the full solution
  MAX_CITATIONS_PER_MESSAGE: 8,
  HISTORY_PAGE_SIZE: 20,
} as const;

/** The three escalating hint levels. */
export const HINT_LEVELS = {
  NUDGE: 1,       // a gentle pointer (what to recall)
  DIRECTION: 2,   // the approach / which formula
  NEAR_ANSWER: 3, // almost the full method, stops short of the answer
} as const;

export const TUTOR_PERSONA = {
  name: 'CE Board Master Tutor',
  // The tutor must stay grounded; these guardrails are surfaced to the provider.
  groundingRules: [
    'Only assert facts supported by the Knowledge Base or the question itself.',
    'Cite learning objectives, formulas, and misconceptions when used.',
    'For hints, never reveal the final answer.',
    'Flag and correct misconceptions explicitly.',
  ],
} as const;

/** Coaching priority by trigger (higher = surfaced first). */
export const COACHING_PRIORITY = {
  exam_mistake: 80,
  knowledge_gap: 70,
  weak_topic: 60,
  misconception: 50,
  streak_risk: 30,
} as const;
