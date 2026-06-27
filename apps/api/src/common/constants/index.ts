/**
 * Application-wide constants for CE Board Master API.
 *
 * These constants are referenced across multiple modules.
 * Using constants (vs magic strings) prevents typos and enables
 * IDE navigation to all usages.
 *
 * Organized by domain:
 * - AUTH: Authentication and token constants
 * - CACHE: Cache key prefixes and TTLs (detailed TTLs in cache.service.ts)
 * - RATE_LIMIT: Rate limiting context identifiers
 * - QUEUE: Queue job names (detailed queue names in queue.module.ts)
 * - SUBSCRIPTION: Subscription tier identifiers
 * - PAGINATION: Default pagination values
 */

// ── Authentication ─────────────────────────────────────────────────────────────
export const AUTH = {
  /** Default access token expiry in seconds (15 minutes) */
  ACCESS_TOKEN_TTL: 900,
  /** Default refresh token expiry in seconds (30 days) */
  REFRESH_TOKEN_TTL: 2_592_000,
  /** Email verification token expiry (24 hours) */
  EMAIL_VERIFY_TTL: 86_400,
  /** Password reset token expiry (1 hour) */
  PASSWORD_RESET_TTL: 3_600,
  /** Account lockout duration in seconds (15 minutes) */
  LOCKOUT_DURATION: 900,
  /** Failed attempts before lockout */
  MAX_FAILED_ATTEMPTS: 5,
  /** Failed attempts window in seconds (15 minutes) */
  FAILED_ATTEMPTS_WINDOW: 900,
  /** Argon2id memory cost (64MB) */
  ARGON2_MEMORY_COST: 65_536,
  /** Argon2id time cost */
  ARGON2_TIME_COST: 3,
  /** Argon2id parallelism */
  ARGON2_PARALLELISM: 4,
} as const;

// ── Subscription ──────────────────────────────────────────────────────────────
export const SUBSCRIPTION = {
  TIERS: {
    FREE: 'free',
    BASIC: 'basic',
    PRO: 'pro',
  },
  /** Free tier question limit */
  FREE_QUESTION_LIMIT: 50,
  /** AI Tutor daily query limit for Pro subscribers */
  AI_DAILY_LIMIT: 50,
  /** Streak freeze count per week */
  STREAK_FREEZE_BASIC: 1,
  STREAK_FREEZE_PRO: 3,
} as const;

// ── Pagination ────────────────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MAX_LIMIT_ADMIN: 200,
} as const;

// ── Questions ─────────────────────────────────────────────────────────────────
export const QUESTIONS = {
  /** Default estimated solving time in seconds */
  DEFAULT_SOLVE_TIME: 90,
  /** Max questions per study session */
  MAX_SESSION_QUESTIONS: 100,
  /** Free user max questions per session */
  FREE_MAX_SESSION: 10,
  /** Mock exam question count per day */
  MOCK_EXAM_QUESTIONS: 120,
  /** Mock exam duration per day in seconds (5 hours) */
  MOCK_EXAM_DURATION: 18_000,
  /** Minimum accuracy % before difficulty progression */
  ACCURACY_FOR_PROGRESSION: 0.75,
  /** Minimum answers before subtopic included in analytics */
  MIN_ANSWERS_FOR_ANALYTICS: 20,
} as const;

// ── Redis Cache Keys ──────────────────────────────────────────────────────────
/** Cache key builders — always use these functions, never raw strings */
export const CACHE_KEYS = {
  taxonomy: {
    allSubjects: () => 'taxonomy:subjects:all',
    subjectTree: () => 'taxonomy:tree:full',
    subjectTopics: (subjectId: string) => `taxonomy:topics:${subjectId}`,
    topicSubtopics: (topicId: string) => `taxonomy:subtopics:${topicId}`,
    difficultyLevels: () => 'taxonomy:difficulty_levels:all',
  },
  readiness: {
    score: (userId: string) => `readiness:score:${userId}`,
    subjectPerf: (userId: string) => `readiness:subject_perf:${userId}`,
  },
  roles: {
    permissions: (roleSlug: string) => `roles:permissions:${roleSlug}`,
  },
  ai: {
    dailyQuota: (userId: string) => `ai_quota:${userId}:${new Date().toISOString().slice(0, 10)}`,
    generation: (id: string) => `ai_generation:${id}`,
    context: (subjectCode: string, topicCode: string) => `ai_context:${subjectCode}:${topicCode}`,
  },
  student: {
    dashboard: (userId: string) => `student:dashboard:${userId}`,
    progress: (userId: string) => `student:progress:${userId}`,
    statistics: (userId: string) => `student:stats:${userId}`,
    mastery: (userId: string) => `student:mastery:${userId}`,
    streak: (userId: string) => `student:streak:${userId}`,
  },
  exam: {
    session: (examId: string) => `exam:session:${examId}`,
    state: (examId: string) => `exam:state:${examId}`,
    result: (examId: string) => `exam:result:${examId}`,
    history: (userId: string) => `exam:history:${userId}`,
    leaderboard: (templateId: string) => `exam:leaderboard:${templateId}`,
  },
  tutor: {
    conversation: (conversationId: string) => `tutor:conversation:${conversationId}`,
    memory: (conversationId: string) => `tutor:memory:${conversationId}`,
    coaching: (userId: string) => `tutor:coaching:${userId}`,
    context: (subjectId: string, topicId: string) => `tutor:context:${subjectId}:${topicId}`,
  },
  formulas: {
    all: () => 'formulas:all',
    bySubject: (subjectCode: string) => `formulas:subject:${subjectCode}`,
  },
  session: {
    token: (tokenHash: string) => `session:token:${tokenHash}`,
  },
  rateLimit: {
    user: (userId: string, endpoint: string) => `rate_limit:user:${userId}:${endpoint}`,
    ip: (ip: string, endpoint: string) => `rate_limit:ip:${ip}:${endpoint}`,
  },
} as const;

// ── Event Names (EventEmitter) ────────────────────────────────────────────────
export const EVENTS = {
  /** Fired after a user answer is submitted */
  ANSWER_SUBMITTED: 'answer.submitted',
  /** Fired when a study session completes */
  SESSION_COMPLETED: 'session.completed',
  /** Fired when a mock exam is submitted */
  EXAM_SUBMITTED: 'exam.submitted',
  /** Fired when a user subscription changes */
  SUBSCRIPTION_CHANGED: 'subscription.changed',
  /** Fired when a question is published */
  QUESTION_PUBLISHED: 'question.published',
  /** Sprint 2.6 — question lifecycle events */
  QUESTION_CREATED: 'question.created',
  QUESTION_UPDATED: 'question.updated',
  QUESTION_DELETED: 'question.deleted',
  QUESTION_SUBMITTED: 'question.submitted',
  QUESTION_APPROVED: 'question.approved',
  QUESTION_REJECTED: 'question.rejected',
  QUESTION_ARCHIVED: 'question.archived',
  QUESTION_CLONED: 'question.cloned',
  QUESTION_FLAGGED: 'question.flagged',
  /** Sprint 2.7 — Admin CMS events */
  QUESTION_LOCKED: 'cms.question.locked',
  QUESTION_UNLOCKED: 'cms.question.unlocked',
  REVIEW_ASSIGNED: 'cms.review.assigned',
  REVIEW_UNASSIGNED: 'cms.review.unassigned',
  REVIEW_COMMENT_ADDED: 'cms.review.comment_added',
  REVIEW_COMMENT_RESOLVED: 'cms.review.comment_resolved',
  EDITORIAL_NOTE_ADDED: 'cms.editorial.note_added',
  CMS_BULK_OPERATION: 'cms.bulk.operation',
  /** Sprint 2.8 — Knowledge Base events */
  KNOWLEDGE_DOC_INGESTED: 'knowledge.document.ingested',
  KNOWLEDGE_DOC_VERSIONED: 'knowledge.document.versioned',
  KNOWLEDGE_DOC_PUBLISHED: 'knowledge.document.published',
  KNOWLEDGE_LO_CREATED: 'knowledge.lo.created',
  KNOWLEDGE_LO_UPDATED: 'knowledge.lo.updated',
  KNOWLEDGE_LO_PUBLISHED: 'knowledge.lo.published',
  KNOWLEDGE_BLUEPRINT_CREATED: 'knowledge.blueprint.created',
  KNOWLEDGE_MISCONCEPTION_CREATED: 'knowledge.misconception.created',
  KNOWLEDGE_XREF_CREATED: 'knowledge.xref.created',
  KNOWLEDGE_VALIDATION_FAILED: 'knowledge.validation.failed',
  /** Fired when a user role is assigned or removed — Sprint 2.3 RBAC */
  ROLE_CHANGED: 'role.changed',
  /** Fired when AI content is approved */
  AI_CONTENT_APPROVED: 'ai_content.approved',
  /** Sprint 2.9 — AI Content Generation Engine events */
  AI_GENERATION_REQUESTED: 'ai.generation.requested',
  AI_GENERATION_COMPLETED: 'ai.generation.completed',
  AI_GENERATION_VALIDATED: 'ai.generation.validated',
  AI_GENERATION_REJECTED: 'ai.generation.rejected',
  AI_GENERATION_PROMOTED: 'ai.generation.promoted',
  AI_GENERATION_FAILED: 'ai.generation.failed',
  AI_VARIANT_GENERATED: 'ai.variant.generated',
  AI_DUPLICATE_DETECTED: 'ai.duplicate.detected',
  /** Sprint 3.1 — Student Learning Platform events */
  STUDENT_QUESTION_ANSWERED: 'student.question.answered',
  STUDENT_SESSION_STARTED: 'student.session.started',
  STUDENT_SESSION_COMPLETED: 'student.session.completed',
  STUDENT_GOAL_MET: 'student.goal.met',
  STUDENT_STREAK_EXTENDED: 'student.streak.extended',
  STUDENT_STREAK_BROKEN: 'student.streak.broken',
  STUDENT_MASTERY_CHANGED: 'student.mastery.changed',
  STUDENT_ACHIEVEMENT_EARNED: 'student.achievement.earned',
  STUDENT_LEVEL_UP: 'student.level.up',
  STUDENT_XP_AWARDED: 'student.xp.awarded',
  STUDENT_GAP_DETECTED: 'student.gap.detected',
  STUDENT_PATH_GENERATED: 'student.path.generated',
  /** Sprint 3.2 — Mock Examination Engine events */
  EXAM_CREATED: 'exam.created',
  EXAM_STARTED: 'exam.started',
  EXAM_PAUSED: 'exam.paused',
  EXAM_RESUMED: 'exam.resumed',
  EXAM_ANSWER_SAVED: 'exam.answer.saved',
  EXAM_EXPIRED: 'exam.expired',
  EXAM_AUTO_SUBMITTED: 'exam.auto_submitted',
  EXAM_SCORED: 'exam.scored',
  EXAM_PASSED: 'exam.passed',
  EXAM_FAILED: 'exam.failed',
  /** Sprint 3.3 — AI Tutor events */
  TUTOR_CONVERSATION_STARTED: 'tutor.conversation.started',
  TUTOR_MESSAGE_SENT: 'tutor.message.sent',
  TUTOR_RESPONSE_GENERATED: 'tutor.response.generated',
  TUTOR_RESPONSE_VALIDATED: 'tutor.response.validated',
  TUTOR_CITATION_ADDED: 'tutor.citation.added',
  TUTOR_HINT_GIVEN: 'tutor.hint.given',
  TUTOR_SOLUTION_GIVEN: 'tutor.solution.given',
  TUTOR_MISCONCEPTION_DETECTED: 'tutor.misconception.detected',
  TUTOR_COACHING_GENERATED: 'tutor.coaching.generated',
  TUTOR_CONVERSATION_ARCHIVED: 'tutor.conversation.archived',
  /** Fired when a user record is updated — Sprint 2.4 */
  USER_UPDATED: 'user.updated',
  /** Fired when a user is soft-deleted — Sprint 2.4 */
  USER_DELETED: 'user.deleted',
  /** Fired when a user profile is updated — Sprint 2.4 */
  PROFILE_UPDATED: 'profile.updated',
  /** Sprint 2.5 — billing lifecycle events */
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
  INVOICE_GENERATED: 'invoice.generated',
} as const;
