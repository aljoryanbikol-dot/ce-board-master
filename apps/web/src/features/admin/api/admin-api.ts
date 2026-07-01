/**
 * @file admin-api.ts — wrappers over the admin endpoints (Sprints 2.x).
 * Read-leaning here; mutations are wired per-screen where needed.
 */
import { api } from '@/lib/api/client';

export interface PlatformOverview {
  totalUsers: number; premiumUsers: number; freeUsers: number;
  totalQuestionsAnswered: number; mockExamsStarted: number; mockExamsCompleted: number;
  totalTutorConversations: number; mrrMinor: number; totalRevenueMinor30d: number;
}
export interface TimeBucket { date: string; count: number; }
export interface ActiveUsersBucket { date: string; activeUsers: number; }
export interface ExamUsageBucket { date: string; started: number; completed: number; }
export interface TutorUsageBucket { date: string; conversations: number; messages: number; }
export interface TierSplit { totalUsers: number; premiumUsers: number; freeUsers: number; }
export interface RevenueOverview {
  totalMinor: number; mrrMinor: number; activeSubscribers: number; churnRate: number;
  byPlan: Array<{ planId: string; name: string; tier: string; interval: string; subscriberCount: number; mrrMinor: number }>;
}
export interface SubjectPerformance { subjectId: string; attempts: number; accuracy: number; }
export interface HardestQuestion { questionId: string; attempts: number; accuracy: number; questionCode: string | null; stemText: string | null; subjectId: string | null; }
export interface HardestTopic { topicId: string; attempts: number; accuracy: number; }
export interface RetentionWindow { windowDays: number; cohortSize: number; returnedCount: number; returnRate: number; }

type Period = 'daily' | 'weekly' | 'monthly';

export const adminApi = {
  // CMS / Question Bank
  questions: (query?: { q?: string; status?: string; cursor?: string; limit?: number }) => api.data(api.get('/admin/questions', { query })),
  question: (id: string) => api.data(api.get(`/admin/questions/${id}`)),
  // Knowledge Base
  knowledgeDocuments: () => api.data(api.get('/admin/knowledge/documents')),
  // Formula Library
  formulas: (query?: { q?: string }) => api.data(api.get('/admin/formulas', { query })),
  // Learning Objectives
  learningObjectives: () => api.data(api.get('/admin/learning-objectives')),
  // Blueprints
  blueprints: () => api.data(api.get('/admin/blueprints')),
  // Editorial Review
  editorialQueue: () => api.data(api.get('/admin/editorial/queue')),
  // AI Generation
  aiGenerations: () => api.data(api.get('/admin/ai/generations')),
  // Users / Roles / Permissions
  users: (query?: { q?: string; cursor?: string }) => api.data(api.get('/admin/users', { query })),
  roles: () => api.data(api.get('/admin/roles')),
  permissions: () => api.data(api.get('/admin/permissions')),
  // Billing (platform revenue overview — backed by /admin/platform-analytics/revenue)
  billingOverview: () => api.data<RevenueOverview>(api.get('/admin/platform-analytics/revenue')),
  // Analytics
  analytics: () => api.data(api.get('/admin/analytics')),
  // Platform analytics (Sprint 3.5 — user growth, usage, revenue, retention)
  platformOverview: () => api.data<PlatformOverview>(api.get('/admin/platform-analytics/overview')),
  userGrowth: (period: Period = 'daily', days = 30) => api.data<TimeBucket[]>(api.get('/admin/platform-analytics/user-growth', { query: { period, days } })),
  activeUsers: (period: Period = 'daily', days = 30) => api.data<ActiveUsersBucket[]>(api.get('/admin/platform-analytics/active-users', { query: { period, days } })),
  tierSplit: () => api.data<TierSplit>(api.get('/admin/platform-analytics/tier-split')),
  revenue: (days = 30) => api.data<RevenueOverview>(api.get('/admin/platform-analytics/revenue', { query: { days } })),
  questionUsage: (period: Period = 'daily', days = 30) => api.data<TimeBucket[]>(api.get('/admin/platform-analytics/question-usage', { query: { period, days } })),
  examUsage: (period: Period = 'daily', days = 30) => api.data<ExamUsageBucket[]>(api.get('/admin/platform-analytics/exam-usage', { query: { period, days } })),
  aiTutorUsage: (period: Period = 'daily', days = 30) => api.data<TutorUsageBucket[]>(api.get('/admin/platform-analytics/ai-tutor-usage', { query: { period, days } })),
  subjectPerformance: () => api.data<SubjectPerformance[]>(api.get('/admin/platform-analytics/subject-performance')),
  hardestQuestions: (limit = 10) => api.data<HardestQuestion[]>(api.get('/admin/platform-analytics/hardest-questions', { query: { limit } })),
  hardestTopics: (limit = 10) => api.data<HardestTopic[]>(api.get('/admin/platform-analytics/hardest-topics', { query: { limit } })),
  retention: () => api.data<RetentionWindow[]>(api.get('/admin/platform-analytics/retention')),
  // Audit logs
  auditLogs: (query?: { cursor?: string }) => api.data(api.get('/admin/audit-logs', { query })),
  // System settings
  settings: () => api.data(api.get('/admin/settings')),
};
