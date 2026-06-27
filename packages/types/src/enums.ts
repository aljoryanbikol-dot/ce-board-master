/**
 * Shared enums — mirror PostgreSQL enum types from database schema.
 * Must be kept in sync with prisma/schema.prisma.
 */

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}

export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
}

export enum QuestionStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  FLAGGED = 'flagged',
}

export enum BloomLevel {
  REMEMBER = 'remember',
  UNDERSTAND = 'understand',
  APPLY = 'apply',
  ANALYZE = 'analyze',
  EVALUATE = 'evaluate',
  CREATE = 'create',
}

export enum DifficultyCode {
  FOUNDATIONAL = 1,
  INTERMEDIATE = 2,
  ADVANCED = 3,
}

export enum ExamDay {
  DAY_ONE = 1,
  DAY_TWO = 2,
}
