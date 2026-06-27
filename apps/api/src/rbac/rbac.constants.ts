/**
 * @file rbac.constants.ts
 * @module Rbac
 *
 * Constants for the RBAC module.
 *
 * Centralises every magic string so guards, services, and decorators
 * share a single source of truth.
 */

// ── Metadata keys ─────────────────────────────────────────────────────────────

/** Reflection metadata key set by @Permissions() decorator */
export const PERMISSIONS_KEY = 'permissions' as const;

/** Reflection metadata key set by @ResourceOwner() decorator */
export const RESOURCE_OWNER_KEY = 'resourceOwner' as const;

// ── Role slugs ────────────────────────────────────────────────────────────────

export const ROLE_SLUGS = {
  SUPER_ADMIN:    'super_admin',
  ADMIN:          'admin',
  CONTENT_ADMIN:  'content_admin',
  CONTENT_AUTHOR: 'content_author',
  REVIEWER:       'reviewer',
  SUBSCRIBER:     'subscriber',
  FREE_USER:      'free_user',
} as const;

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];

// ── Permission slugs (complete manifest) ─────────────────────────────────────

export const PERM = {
  // users
  USERS_READ:             'users.read',
  USERS_WRITE:            'users.write',
  USERS_DELETE:           'users.delete',
  USERS_MANAGE:           'users.manage',
  // roles
  ROLES_MANAGE:           'roles.manage',
  // permissions
  PERMISSIONS_MANAGE:     'permissions.manage',
  // questions
  QUESTIONS_READ:         'questions.read',
  QUESTIONS_CREATE:       'questions.create',
  QUESTIONS_UPDATE:       'questions.update',
  QUESTIONS_DELETE:       'questions.delete',
  QUESTIONS_PUBLISH:      'questions.publish',
  QUESTIONS_REVIEW:       'questions.review',
  QUESTIONS_MANAGE:       'questions.manage',
  // cms
  CMS_ACCESS:             'cms.access',
  // blueprints
  BLUEPRINTS_MANAGE:      'blueprints.manage',
  // formulas
  FORMULAS_MANAGE:        'formulas.manage',
  // knowledge
  KNOWLEDGE_READ:         'knowledge.read',
  KNOWLEDGE_MANAGE:       'knowledge.manage',
  KNOWLEDGE_INGEST:       'knowledge.ingest',
  KNOWLEDGE_PUBLISH:      'knowledge.publish',
  // analytics
  ANALYTICS_VIEW:         'analytics.view',
  ANALYTICS_MANAGE:       'analytics.manage',
  // subscriptions
  SUBSCRIPTIONS_READ:     'subscriptions.read',
  SUBSCRIPTIONS_MANAGE:   'subscriptions.manage',
  // ai
  STUDENT_LEARN:          'student.learn',
  STUDENT_PRACTICE:       'student.practice',
  STUDENT_PROGRESS:       'student.progress',
  EXAM_TAKE:              'exam.take',
  EXAM_REVIEW:            'exam.review',
  EXAM_RESULTS:           'exam.results',
  EXAM_MANAGE:            'exam.manage',
  TUTOR_USE:              'tutor.use',
  TUTOR_HISTORY:          'tutor.history',
  TUTOR_COACHING:         'tutor.coaching',
  AI_USE:                 'ai.use',
  AI_GENERATE:            'ai.generate',
  AI_REVIEW:              'ai.review',
  AI_MANAGE:              'ai.manage',
  // system
  SYSTEM_MANAGE:          'system.manage',
  // audit
  AUDIT_READ:             'audit.read',
} as const;

export type PermissionSlug = (typeof PERM)[keyof typeof PERM];

// ── Cache ─────────────────────────────────────────────────────────────────────

/** Cache key prefix for per-user effective permission sets */
export const USER_PERM_CACHE_PREFIX  = 'rbac:perms:user:' as const;

/** Cache key for all-permissions list (admin UI) */
export const ALL_PERMS_CACHE_KEY     = 'permissions:all' as const;

/** Cache key prefix for single role with permissions */
export const ROLE_CACHE_PREFIX       = 'roles:slug:' as const;

/** Cache key for all-roles list (admin UI) */
export const ALL_ROLES_CACHE_KEY     = 'roles:all' as const;

/** TTL for user effective permission cache (seconds) */
export const USER_PERM_CACHE_TTL     = 300   as const; // 5 minutes

/** TTL for all-permissions / all-roles list cache (seconds) */
export const ADMIN_LIST_CACHE_TTL    = 3_600 as const; // 1 hour

// ── Error codes ───────────────────────────────────────────────────────────────

export const RBAC_ERROR_CODES = {
  FORBIDDEN_PERMISSION:  'FORBIDDEN_PERMISSION',
  FORBIDDEN_RESOURCE:    'FORBIDDEN_RESOURCE',
  ROLE_NOT_FOUND:        'ROLE_NOT_FOUND',
  PERMISSION_NOT_FOUND:  'PERMISSION_NOT_FOUND',
  ROLE_IS_SYSTEM:        'ROLE_IS_SYSTEM',
  DUPLICATE_ASSIGNMENT:  'DUPLICATE_ASSIGNMENT',
  SELF_DEMOTION:         'SELF_DEMOTION',
} as const;
