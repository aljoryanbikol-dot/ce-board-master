/**
 * @file exams-api.ts — wrappers over /exams/* (Sprint 3.2).
 */
import { api } from '@/lib/api/client';

export interface ExamTemplate {
  id: string; code: string; name: string; kind: string;
  totalQuestions: number; durationMinutes: number; passingScore: number;
  description?: string | null;
  /** Per-subject question counts (JSON column, returned as-is by /exams/templates). */
  composition?: Array<{ subjectId: string; count: number; weightPercent?: number | null }>;
}
export interface ExamSummary { examId: string; status: string; totalQuestions: number; durationMinutes: number; }

export interface BoardFormSession { day: string; session: string; session_name: string; session_items: number; session_time_min: number }
export interface BoardForm {
  id: string; code: string; name: string; totalQuestions: number; durationMinutes: number; passingScore: number;
  formStructure: BoardFormSession[] | null;
}

export const examsApi = {
  templates: () => api.data<ExamTemplate[]>(api.get('/exams/templates')),
  boardForms: (page = 1, limit = 12) => api.data<{ items: BoardForm[]; total: number; page: number; limit: number }>(api.get('/exams/board-forms', { query: { page, limit } })),
  randomBoardForm: () => api.data<{ id: string; code: string; name: string }>(api.get('/exams/board-forms/random')),
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
