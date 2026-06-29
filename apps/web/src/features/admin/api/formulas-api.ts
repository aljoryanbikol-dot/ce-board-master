/**
 * @file formulas-api.ts — admin Formula Library client.
 * Backed by /admin/formulas (search/create/get/update/deactivate). The list is
 * cursor-paginated (pagination in meta).
 */
import { api } from '@/lib/api/client';

export interface FormulaVariable { symbol: string; name: string; unit?: string; description?: string; }

export interface Formula {
  id: string;
  name: string;
  slug: string;
  subjectId: string;
  topicId?: string | null;
  expressionText: string;
  expressionLatex: string;
  variables: FormulaVariable[];
  unitsSystem: string;
  imperialExpression?: string | null;
  derivation?: string | null;
  assumptions?: string[];
  limitations?: string | null;
  typicalApplications?: string[];
  exampleProblem?: string | null;
  isActive: boolean;
}

export interface FormulaListResult {
  data: Formula[];
  pagination: { cursor: string | null; hasMore: boolean; total?: number };
}

export type FormulaListParams = Record<string, string | number | boolean | undefined>;

export interface FormulaSyncResult {
  created: number;
  updated: number;
  failed: number;
  errors: { index: number; name: string; message: string }[];
}

export const formulasApi = {
  list: async (params?: FormulaListParams): Promise<FormulaListResult> => {
    const res = await api.get<Formula[]>('/admin/formulas', { query: params });
    const p = res.meta?.pagination;
    return { data: res.data ?? [], pagination: { cursor: p?.cursor ?? null, hasMore: p?.hasMore ?? false, total: p?.total } };
  },
  get: (id: string) => api.data<Formula>(api.get(`/admin/formulas/${id}`)),
  create: (body: Record<string, unknown>) => api.data<Formula>(api.post('/admin/formulas', body)),
  update: (id: string, body: Record<string, unknown>) => api.data<Formula>(api.patch(`/admin/formulas/${id}`, body)),
  remove: (id: string) => api.delete(`/admin/formulas/${id}`),
  /** Idempotent sync from the Knowledge Library (upsert by name/slug). */
  bulkImport: (formulas: unknown[]) => api.data<FormulaSyncResult>(api.post('/admin/formulas/bulk-import', { formulas })),
};
