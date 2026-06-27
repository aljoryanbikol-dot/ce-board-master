/**
 * @file cms.constants.ts
 * @module Cms
 *
 * Constants for the Admin CMS: error codes, lock TTLs, cache keys, and queue
 * definitions. The CMS sits on top of the Question Bank (Sprint 2.6) and adds
 * the human-coordination layer: locking, assignment, comments, editorial notes.
 */

export const CMS_ERROR_CODES = {
  QUESTION_LOCKED:        'QUESTION_LOCKED',
  LOCK_NOT_HELD:          'LOCK_NOT_HELD',
  LOCK_NOT_FOUND:         'LOCK_NOT_FOUND',
  ASSIGNMENT_EXISTS:      'ASSIGNMENT_EXISTS',
  ASSIGNMENT_NOT_FOUND:   'ASSIGNMENT_NOT_FOUND',
  COMMENT_NOT_FOUND:      'COMMENT_NOT_FOUND',
  NOTE_NOT_FOUND:         'NOTE_NOT_FOUND',
  FORBIDDEN_CMS:          'FORBIDDEN_CMS',
  INVALID_STAGE:          'INVALID_STAGE',
  BULK_OPERATION_INVALID: 'BULK_OPERATION_INVALID',
  BULK_PARTIAL_FAILURE:   'BULK_PARTIAL_FAILURE',
} as const;

export type CmsErrorCode = (typeof CMS_ERROR_CODES)[keyof typeof CMS_ERROR_CODES];

/** Default lock duration: 15 minutes. Auto-expires so abandoned edits release. */
export const LOCK_TTL_SECONDS = 15 * 60;
/** Maximum lock duration a caller may request. */
export const LOCK_MAX_TTL_SECONDS = 60 * 60;

/** CMS dashboard cache key fragments. */
export const DASHBOARD_CACHE_KEY = 'dashboard:overview' as const;
export const DASHBOARD_RECENT_LIMIT = 20 as const;
export const REVIEW_QUEUE_LIMIT = 50 as const;

/** Bulk operations limit. */
export const CMS_BULK_MAX = 200 as const;

/** The CMS queues correspond to question statuses (and review stages). */
export const CMS_QUEUES = {
  DRAFT:     'draft',
  REVIEW:    'review',
  PUBLISH:   'publish',
  ARCHIVE:   'archive',
} as const;

export type CmsQueue = (typeof CMS_QUEUES)[keyof typeof CMS_QUEUES];

/** Bulk operation kinds the CMS supports (delegated to the workflow service). */
export const BULK_OPERATIONS = {
  SUBMIT:   'submit',
  APPROVE:  'approve',
  REJECT:   'reject',
  PUBLISH:  'publish',
  ARCHIVE:  'archive',
  ASSIGN:   'assign',
} as const;

export type BulkOperation = (typeof BULK_OPERATIONS)[keyof typeof BULK_OPERATIONS];
