/**
 * @file admin-api.ts — wrappers over the admin endpoints (Sprints 2.x).
 * Read-leaning here; mutations are wired per-screen where needed.
 */
import { api } from '@/lib/api/client';

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
  // Billing
  billingOverview: () => api.data(api.get('/admin/billing/overview')),
  // Analytics
  analytics: () => api.data(api.get('/admin/analytics')),
  // Audit logs
  auditLogs: (query?: { cursor?: string }) => api.data(api.get('/admin/audit-logs', { query })),
  // System settings
  settings: () => api.data(api.get('/admin/settings')),
};
