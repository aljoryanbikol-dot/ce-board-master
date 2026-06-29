/**
 * @file exam-templates-api.ts — admin client for Mock Exam Templates.
 * Backed by /exams/templates (create/list/get/update/delete).
 */
import { api } from '@/lib/api/client';

export interface CompositionEntry {
  subjectId: string;
  count: number;
  difficultyLevelId?: string;
  weightPercent?: number;
}

export interface ExamTemplate {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  kind: string;
  totalQuestions: number;
  durationMinutes: number;
  passingScore: number;
  randomizeQuestions: boolean;
  randomizeChoices: boolean;
  composition: CompositionEntry[];
  isActive: boolean;
  createdAt: string;
}

export const examTemplatesApi = {
  list: () => api.data<ExamTemplate[]>(api.get('/exams/templates')),
  get: (id: string) => api.data<ExamTemplate>(api.get(`/exams/templates/${id}`)),
  create: (body: Record<string, unknown>) => api.data<ExamTemplate>(api.post('/exams/templates', body)),
  update: (id: string, body: Record<string, unknown>) => api.data<ExamTemplate>(api.patch(`/exams/templates/${id}`, body)),
  remove: (id: string) => api.data(api.delete(`/exams/templates/${id}`)),
};
