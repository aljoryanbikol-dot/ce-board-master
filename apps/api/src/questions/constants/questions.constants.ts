/**
 * @file questions.constants.ts
 * @module Questions
 *
 * Constants for the Question Bank module: error codes, cache keys/TTLs, and
 * the review-stage machine that layers the brief's 6-stage editorial pipeline
 * on top of the frozen QuestionStatus enum.
 *
 * DESIGN — review stages without schema change:
 * The frozen QuestionStatus enum is { draft, in_review, approved, published,
 * archived, flagged }. The brief requires a finer pipeline:
 *   Draft → Technical → Educational → Editorial → QA → Published → Archived.
 * We model Technical/Educational/Editorial/QA as REVIEW STAGES that all live
 * under the single `in_review` status. The active stage is tracked in the
 * QuestionReviewWorkflow log (notes) and the version content snapshot, never
 * by adding enum values. This keeps the Sprint 3A DB contract frozen.
 */

// ── Error codes ───────────────────────────────────────────────────────────────

export const QUESTION_ERROR_CODES = {
  QUESTION_NOT_FOUND:       'QUESTION_NOT_FOUND',
  QUESTION_CODE_TAKEN:      'QUESTION_CODE_TAKEN',
  INVALID_TRANSITION:      'INVALID_TRANSITION',
  INVALID_REVIEW_STAGE:    'INVALID_REVIEW_STAGE',
  FORBIDDEN_OWNERSHIP:     'FORBIDDEN_OWNERSHIP',
  VERSION_CONFLICT:        'VERSION_CONFLICT',
  VERSION_NOT_FOUND:       'VERSION_NOT_FOUND',
  CHOICES_INVALID:         'CHOICES_INVALID',
  CORRECT_CHOICE_INVALID:  'CORRECT_CHOICE_INVALID',
  ALREADY_PUBLISHED:       'ALREADY_PUBLISHED',
  NOT_PUBLISHABLE:         'NOT_PUBLISHABLE',
  CANNOT_DELETE_PUBLISHED: 'CANNOT_DELETE_PUBLISHED',
  BULK_IMPORT_INVALID:     'BULK_IMPORT_INVALID',
  TAXONOMY_NOT_FOUND:      'TAXONOMY_NOT_FOUND',
} as const;

export type QuestionErrorCode =
  (typeof QUESTION_ERROR_CODES)[keyof typeof QUESTION_ERROR_CODES];

// ── Review stages (application-level, under `in_review`) ───────────────────────

export const REVIEW_STAGES = {
  TECHNICAL:   'technical',
  EDUCATIONAL: 'educational',
  EDITORIAL:   'editorial',
  QA:          'qa',
} as const;

export type ReviewStage = (typeof REVIEW_STAGES)[keyof typeof REVIEW_STAGES];

/** Ordered pipeline of review stages. Approval advances to the next; the final
 *  stage's approval moves the question to `approved` status (publish-ready). */
export const REVIEW_STAGE_ORDER: ReviewStage[] = [
  REVIEW_STAGES.TECHNICAL,
  REVIEW_STAGES.EDUCATIONAL,
  REVIEW_STAGES.EDITORIAL,
  REVIEW_STAGES.QA,
];

// ── Cache ─────────────────────────────────────────────────────────────────────

export const QUESTION_CACHE_PREFIX = 'questions:detail:' as const;
export const QUESTION_LIST_CACHE_PREFIX = 'questions:list:' as const;
export const QUESTION_CACHE_TTL = 300 as const;      // 5 minutes
export const QUESTION_LIST_CACHE_TTL = 60 as const;  // 1 minute

// ── Limits ────────────────────────────────────────────────────────────────────

/** Number of answer choices required for a multiple-choice question. */
export const MCQ_CHOICE_COUNT = 4 as const;
/** Valid choice letters. */
export const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;
/** Max questions accepted in a single bulk import request. */
export const BULK_IMPORT_MAX = 500 as const;
/** Max questions returned by a single bulk export request. */
export const BULK_EXPORT_MAX = 5_000 as const;
