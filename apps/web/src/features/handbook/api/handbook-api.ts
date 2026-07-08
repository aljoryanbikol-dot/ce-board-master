/**
 * @file handbook-api.ts — Fundamentals Handbook endpoints (/handbook/*).
 * Read-only projections of the Knowledge Library.
 */
import { api } from '@/lib/api/client';

export interface HandbookSubject { id: string; code: string; name: string; _count: { formulas: number } }
export interface FormulaListItem {
  slug: string; name: string; expressionLatex: string; expressionText: string; unitsSystem: string;
  subject: { code: string; name: string }; topic: { name: string } | null;
}
export interface FormulaVariable { symbol: string; name: string; unit?: string; description?: string }
export interface FormulaDetail {
  slug: string; name: string;
  subject: { code: string; name: string }; topic: { name: string } | null;
  expressionLatex: string; expressionText: string;
  variables: FormulaVariable[] | Record<string, unknown>;
  unitsSystem: string; imperialExpression: string | null;
  derivation: string | null; assumptions: string[]; limitations: string | null;
  typicalApplications: string[]; exampleProblem: string | null;
  relatedFormulas: Array<{ slug: string; name: string; expressionLatex: string }>;
  relatedQuestions: Array<{ questionCode: string; stem: string }>;
  relatedDiagrams: Array<{ publicId: string; title: string; imageUrl: string; altText: string }>;
  relatedConcepts: Array<{ publicId: string; title: string; summary: string }>;
}
export interface MustMemorizeGroup {
  subjectCode: string; subjectName: string;
  formulas: Array<{ slug: string; name: string; expressionLatex: string; expressionText: string; _count: { questionFormulas: number } }>;
}
export interface DailyPicks {
  formula: { slug: string; name: string; expressionLatex: string; expressionText: string; exampleProblem: string | null; typicalApplications: string[]; subject: { code: string; name: string } } | null;
  concept: { publicId: string; title: string; body: string; subjectCode: string | null } | null;
  tip: { publicId: string; title: string; tip: string; subjectCode: string | null } | null;
}

export interface SymbolEntry { symbol: string; meanings: string[]; units: string[]; formulas: Array<{ slug: string; name: string }> }
export interface GlossaryItem { publicId: string; title: string; body: string; subjectCode: string | null; topicCode: string | null; keywords: string[] }
export interface FoundationsGroup { subjectCode: string; subjectName: string; pages: Array<{ publicId: string; title: string; topicName: string | null; examWeight: number | null }> }
export interface FoundationPage {
  publicId: string; title: string; body: string; topicName: string | null;
  subject: { name: string; code: string } | null;
  formulas: Array<{ slug: string; name: string; expressionLatex: string }>;
  concepts: Array<{ publicId: string; title: string; summary: string }>;
}
export interface LastMinute {
  topFormulas: Array<{ slug: string; name: string; expressionLatex: string; expressionText: string; subject: { code: string }; _count: { questionFormulas: number } }>;
  commonMistakes: string[];
  boardTips: Array<{ title: string; tip: string; subjectCode: string | null }>;
}

export const handbookApi = {
  subjects: () => api.data<HandbookSubject[]>(api.get('/handbook/subjects')),
  formulas: (params: { subjectCode?: string; q?: string; page?: number; limit?: number }) =>
    api.data<{ items: FormulaListItem[]; total: number; page: number; limit: number }>(api.get('/handbook/formulas', { query: params })),
  mustMemorize: () => api.data<MustMemorizeGroup[]>(api.get('/handbook/formulas/must-memorize')),
  formula: (slug: string) => api.data<FormulaDetail>(api.get(`/handbook/formulas/${slug}`)),
  daily: () => api.data<DailyPicks & { definition?: DailyPicks['concept'] }>(api.get('/handbook/daily')),
  symbols: (q?: string) => api.data<SymbolEntry[]>(api.get('/handbook/symbols', { query: { q } })),
  glossary: (params: { q?: string; subjectCode?: string; page?: number; limit?: number }) =>
    api.data<{ items: GlossaryItem[]; total: number; page: number; limit: number }>(api.get('/handbook/glossary', { query: params })),
  foundations: () => api.data<FoundationsGroup[]>(api.get('/handbook/foundations')),
  foundationPage: (publicId: string) => api.data<FoundationPage>(api.get(`/handbook/foundations/${encodeURIComponent(publicId)}`)),
  lastMinute: () => api.data<LastMinute>(api.get('/handbook/last-minute')),
};
