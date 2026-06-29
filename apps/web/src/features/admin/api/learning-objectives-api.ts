/**
 * @file learning-objectives-api.ts — admin Learning Objectives client.
 * Read + idempotent sync from the Knowledge Library. Backed by
 * /admin/learning-objectives (search + bulk-import). Cursor pagination in meta.
 */
import { api } from '@/lib/api/client';

export interface LearningObjective {
  id: string;
  publicId: string;
  subjectCode: string;
  topicCode: string;
  subtopicCode: string;
  sequenceNumber: number;
  statement: string;
  bloomLevel: string;
  status: string;
  measurable?: boolean;
}

export interface LoListResult {
  data: LearningObjective[];
  pagination: { cursor: string | null; hasMore: boolean; total?: number };
}

export interface LoSyncResult {
  created: number;
  updated: number;
  failed: number;
  errors: { index: number; publicId: string; message: string }[];
}

export type LoListParams = Record<string, string | number | boolean | undefined>;

export const learningObjectivesApi = {
  list: async (params?: LoListParams): Promise<LoListResult> => {
    const res = await api.get<LearningObjective[]>('/admin/learning-objectives', { query: params });
    const p = res.meta?.pagination;
    return { data: res.data ?? [], pagination: { cursor: p?.cursor ?? null, hasMore: p?.hasMore ?? false, total: p?.total } };
  },
  bulkImport: (objectives: unknown[]) =>
    api.data<LoSyncResult>(api.post('/admin/learning-objectives/bulk-import', { objectives })),
};
