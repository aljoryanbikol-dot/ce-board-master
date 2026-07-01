'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { adminApi } from '../api/admin-api';

export const useAdminQuestions = (q?: string) => useQuery({ queryKey: queryKeys.admin.questions(q), queryFn: () => adminApi.questions({ q }) });
export const useAdminUsers = (q?: string) => useQuery({ queryKey: queryKeys.admin.users(q), queryFn: () => adminApi.users({ q }) });
export const useAdminRoles = () => useQuery({ queryKey: queryKeys.admin.roles, queryFn: adminApi.roles });
export const useAdminPermissions = () => useQuery({ queryKey: queryKeys.admin.permissions, queryFn: adminApi.permissions });
export const useAdminFormulas = () => useQuery({ queryKey: queryKeys.admin.formulas, queryFn: () => adminApi.formulas() });
export const useAdminLearningObjectives = () => useQuery({ queryKey: queryKeys.admin.learningObjectives, queryFn: adminApi.learningObjectives });
export const useAdminBlueprints = () => useQuery({ queryKey: queryKeys.admin.blueprints, queryFn: adminApi.blueprints });
export const useAdminEditorial = () => useQuery({ queryKey: queryKeys.admin.editorial, queryFn: adminApi.editorialQueue });
export const useAdminAiGenerations = () => useQuery({ queryKey: queryKeys.admin.aiGenerations, queryFn: adminApi.aiGenerations });
export const useAdminKnowledge = () => useQuery({ queryKey: queryKeys.admin.knowledge, queryFn: adminApi.knowledgeDocuments });
export const useAdminAuditLogs = () => useQuery({ queryKey: queryKeys.admin.auditLogs, queryFn: () => adminApi.auditLogs() });
export const useAdminAnalytics = () => useQuery({ queryKey: queryKeys.admin.analytics, queryFn: adminApi.analytics });
export const useAdminSettings = () => useQuery({ queryKey: queryKeys.admin.settings, queryFn: adminApi.settings });

// Platform analytics (Sprint 3.5)
export const usePlatformOverview = () => useQuery({ queryKey: [...queryKeys.admin.analytics, 'platform-overview'], queryFn: adminApi.platformOverview });
export const useUserGrowth = (period: 'daily' | 'weekly' | 'monthly' = 'daily', days = 30) =>
  useQuery({ queryKey: [...queryKeys.admin.analytics, 'user-growth', period, days], queryFn: () => adminApi.userGrowth(period, days) });
export const useActiveUsers = (period: 'daily' | 'weekly' | 'monthly' = 'daily', days = 30) =>
  useQuery({ queryKey: [...queryKeys.admin.analytics, 'active-users', period, days], queryFn: () => adminApi.activeUsers(period, days) });
export const useTierSplit = () => useQuery({ queryKey: [...queryKeys.admin.analytics, 'tier-split'], queryFn: adminApi.tierSplit });
export const usePlatformRevenue = (days = 30) => useQuery({ queryKey: [...queryKeys.admin.analytics, 'revenue', days], queryFn: () => adminApi.revenue(days) });
export const useQuestionUsage = (period: 'daily' | 'weekly' | 'monthly' = 'daily', days = 30) =>
  useQuery({ queryKey: [...queryKeys.admin.analytics, 'question-usage', period, days], queryFn: () => adminApi.questionUsage(period, days) });
export const useExamUsage = (period: 'daily' | 'weekly' | 'monthly' = 'daily', days = 30) =>
  useQuery({ queryKey: [...queryKeys.admin.analytics, 'exam-usage', period, days], queryFn: () => adminApi.examUsage(period, days) });
export const useAiTutorUsage = (period: 'daily' | 'weekly' | 'monthly' = 'daily', days = 30) =>
  useQuery({ queryKey: [...queryKeys.admin.analytics, 'ai-tutor-usage', period, days], queryFn: () => adminApi.aiTutorUsage(period, days) });
export const useSubjectPerformance = () => useQuery({ queryKey: [...queryKeys.admin.analytics, 'subject-performance'], queryFn: adminApi.subjectPerformance });
export const useHardestQuestions = (limit = 10) => useQuery({ queryKey: [...queryKeys.admin.analytics, 'hardest-questions', limit], queryFn: () => adminApi.hardestQuestions(limit) });
export const useHardestTopics = (limit = 10) => useQuery({ queryKey: [...queryKeys.admin.analytics, 'hardest-topics', limit], queryFn: () => adminApi.hardestTopics(limit) });
export const useRetention = () => useQuery({ queryKey: [...queryKeys.admin.analytics, 'retention'], queryFn: adminApi.retention });
