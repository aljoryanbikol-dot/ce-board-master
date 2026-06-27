/**
 * @file keys.ts — centralized TanStack Query key factory.
 * One place for cache keys keeps invalidation correct and collision-free.
 */
export const queryKeys = {
  auth: { me: ['auth', 'me'] as const },
  student: {
    dashboard: ['student', 'dashboard'] as const,
    progress: ['student', 'progress'] as const,
    weakTopics: ['student', 'weak-topics'] as const,
    achievements: ['student', 'achievements'] as const,
    planner: ['student', 'planner'] as const,
    bookmarks: ['student', 'bookmarks'] as const,
    history: ['student', 'history'] as const,
  },
  practice: {
    recommendations: (subjectId?: string) => ['practice', 'recommendations', subjectId ?? 'all'] as const,
    session: (id: string) => ['practice', 'session', id] as const,
  },
  exams: {
    templates: ['exams', 'templates'] as const,
    history: ['exams', 'history'] as const,
    exam: (id: string) => ['exams', 'exam', id] as const,
    result: (id: string) => ['exams', 'result', id] as const,
    leaderboard: (templateId?: string) => ['exams', 'leaderboard', templateId ?? 'all'] as const,
  },
  tutor: {
    conversations: ['tutor', 'conversations'] as const,
    conversation: (id: string) => ['tutor', 'conversation', id] as const,
    coaching: ['tutor', 'coaching'] as const,
    recommendations: ['tutor', 'recommendations'] as const,
  },
  admin: {
    dashboard: ['admin', 'dashboard'] as const,
    questions: (q?: string) => ['admin', 'questions', q ?? ''] as const,
    knowledge: ['admin', 'knowledge'] as const,
    formulas: ['admin', 'formulas'] as const,
    learningObjectives: ['admin', 'learning-objectives'] as const,
    blueprints: ['admin', 'blueprints'] as const,
    editorial: ['admin', 'editorial'] as const,
    aiGenerations: ['admin', 'ai-generations'] as const,
    users: (q?: string) => ['admin', 'users', q ?? ''] as const,
    roles: ['admin', 'roles'] as const,
    permissions: ['admin', 'permissions'] as const,
    auditLogs: ['admin', 'audit-logs'] as const,
    analytics: ['admin', 'analytics'] as const,
    settings: ['admin', 'settings'] as const,
  },
  billing: { subscription: ['billing', 'subscription'] as const, invoices: ['billing', 'invoices'] as const },
} as const;
