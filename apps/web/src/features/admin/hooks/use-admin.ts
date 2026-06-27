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
