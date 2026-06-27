/**
 * @file exams-api.ts — wrappers over /exams/* (Sprint 3.2).
 */
import { api } from '@/lib/api/client';

export interface ExamTemplate { id: string; code: string; name: string; kind: string; totalQuestions: number; durationMinutes: number; passingScore: number; }
export interface ExamSummary { examId: string; status: string; totalQuestions: number; durationMinutes: number; }

export const examsApi = {
  templates: () => api.data<ExamTemplate[]>(api.get('/exams/templates')),
  create: (body: { kind: string; templateId?: string; subjectId?: string; totalQuestions?: number; durationMinutes?: number }) =>
    api.data<ExamSummary>(api.post('/exams', body)),
  get: (id: string) => api.data(api.get(`/exams/${id}`)),
  questions: (id: string) => api.data(api.get(`/exams/${id}/questions`)),
  begin: (id: string) => api.data(api.post(`/exams/${id}/begin`)),
  answer: (id: string, body: { examQuestionId: string; selectedChoice?: string | null; timeSpentSec?: number; flagged?: boolean }) =>
    api.data(api.post(`/exams/${id}/answers`, body)),
  bookmark: (id: string, body: { examQuestionId: string; bookmarked: boolean }) => api.data(api.post(`/exams/${id}/bookmark`, body)),
  pause: (id: string) => api.data(api.post(`/exams/${id}/pause`)),
  resume: (id: string) => api.data(api.post(`/exams/${id}/resume`)),
  resumeInterrupted: () => api.data(api.get('/exams/resume')),
  submit: (id: string) => api.data(api.post(`/exams/${id}/submit`)),
  result: (id: string) => api.data(api.get(`/exams/${id}/result`)),
  review: (id: string, filter: 'all' | 'incorrect' | 'bookmarked' | 'skipped' = 'all') => api.data(api.get(`/exams/${id}/review`, { query: { filter } })),
  performance: (id: string) => api.data(api.get(`/exams/${id}/performance`)),
  analysis: (id: string) => api.data(api.get(`/exams/${id}/analysis`)),
  recommendations: (id: string) => api.data(api.get(`/exams/${id}/recommendations`)),
  history: () => api.data(api.get('/exams/history')),
  leaderboard: (templateId?: string) => api.data(api.get('/exams/leaderboard', { query: { templateId } })),
};
