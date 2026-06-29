/**
 * @file questions-api.ts — admin Question Bank client.
 * Reuses the existing /questions API (CRUD/search) + /questions/:id/set-status
 * (admin direct publish/archive) and /admin/difficulty-levels (read).
 */
import { api } from '@/lib/api/client';

export interface QuestionSummary {
  id: string;
  questionCode: string;
  subjectId: string;
  topicId: string;
  subtopicId: string;
  difficultyLevelId: string;
  stemText: string;
  status: string;
  bloomLevel: string;
  questionType: string;
  currentVersion: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChoiceView { letter: string; text: string; isCorrect: boolean; }

export interface QuestionDetail extends QuestionSummary {
  correctChoice: string;
  explanationText: string;
  learningObjective: string | null;
  prcSyllabusRef: string | null;
  prcYearAppeared: number[];
  engineeringNotes: string | null;
  commonMistakes: string[];
  estSolvingTimeSec: number;
  language: string;
  keywords?: string[];
  choices: ChoiceView[];
}

export interface QuestionListResult {
  data: QuestionSummary[];
  pagination: { cursor: string | null; hasMore: boolean; total: number };
}

export type QuestionListParams = Record<string, string | number | boolean | undefined>;
export type QuestionStatus = 'draft' | 'published' | 'archived';

export const questionsApi = {
  list: async (params?: QuestionListParams): Promise<QuestionListResult> => {
    // The search endpoint returns the array under `data` and cursor pagination
    // under `meta.pagination` — so read meta directly (api.data() drops meta).
    const res = await api.get<QuestionSummary[]>('/questions', { query: params });
    const p = res.meta?.pagination;
    return {
      data: res.data ?? [],
      pagination: { cursor: p?.cursor ?? null, hasMore: p?.hasMore ?? false, total: p?.total ?? (res.data?.length ?? 0) },
    };
  },
  get: (id: string) => api.data<QuestionDetail>(api.get(`/questions/${id}`)),
  create: (body: Record<string, unknown>) => api.data<QuestionDetail>(api.post('/questions', body)),
  update: (id: string, body: Record<string, unknown>) => api.data<QuestionDetail>(api.patch(`/questions/${id}`, body)),
  remove: (id: string) => api.data(api.delete(`/questions/${id}`)),
  setStatus: (id: string, status: QuestionStatus) => api.data(api.post(`/questions/${id}/set-status`, { status })),
};

export interface DifficultyLevel { id: string; name: string; code: number; colorHex?: string | null; }
export const difficultyApi = {
  list: () => api.data<{ items: DifficultyLevel[] }>(api.get('/admin/difficulty-levels')),
};

export interface BulkExportResult { exportedAt: string; count: number; questions: QuestionDetail[]; }
export interface BulkImportResult {
  imported: number; failed: number;
  errors: { index: number; code: string; message: string }[];
  createdIds: string[];
}
export const questionBulkApi = {
  export: (params?: { status?: string; subjectId?: string; limit?: number }) =>
    api.data<BulkExportResult>(api.get('/questions/bulk/export', { query: params })),
  import: (questions: unknown[], atomic: boolean) =>
    api.data<BulkImportResult>(api.post('/questions/bulk/import', { questions, atomic })),
};
