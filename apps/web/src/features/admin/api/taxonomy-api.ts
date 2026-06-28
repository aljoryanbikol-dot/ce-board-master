/**
 * @file taxonomy-api.ts — admin CRUD wrappers for the taxonomy entities.
 * Backed by the TaxonomyModule (/admin/subjects, /admin/topics, /admin/subtopics).
 */
import { api } from '@/lib/api/client';

export interface ListResult<T> { items: T[]; total: number; page: number; limit: number; }
export type ListParams = Record<string, string | number | boolean | undefined>;

/** Generic CRUD client for an admin resource base path. */
export function crudClient<T>(base: string) {
  return {
    list: (params?: ListParams) => api.data<ListResult<T>>(api.get(base, { query: params })),
    get: (id: string) => api.data<T>(api.get(`${base}/${id}`)),
    create: (body: Record<string, unknown>) => api.data<T>(api.post(base, body)),
    update: (id: string, body: Record<string, unknown>) => api.data<T>(api.patch(`${base}/${id}`, body)),
    remove: (id: string) => api.data(api.delete(`${base}/${id}`)),
    bulkRemove: (ids: string[]) => api.data(api.post(`${base}/bulk-delete`, { ids })),
  };
}

export interface Subject {
  id: string; name: string; code: string; examDay: number;
  prcWeightPercent?: number | null; description?: string | null;
  colorHex?: string | null; iconName?: string | null; sortOrder: number; isActive: boolean;
  _count?: { topics: number; questions: number };
}
export interface Topic {
  id: string; subjectId: string; name: string; code: string;
  prcWeightPercent?: number | null; prcLearningOutcome?: string | null;
  description?: string | null; sortOrder: number; isActive: boolean;
  subject?: { id: string; name: string; code: string };
  _count?: { subtopics: number; questions: number };
}
export interface Subtopic {
  id: string; topicId: string; name: string; code: string;
  keywords: string[]; description?: string | null; sortOrder: number; isActive: boolean;
  topic?: { id: string; name: string; code: string; subject?: { id: string; name: string } };
  _count?: { questions: number };
}

export interface DifficultyLevel {
  id: string; name: string; code: number; description?: string | null;
  passingThreshold?: number | string | null; colorHex?: string | null;
  sortOrder: number; isActive: boolean; _count?: { questions: number };
}
export interface Tag {
  id: string; name: string; slug: string; category: string;
  description?: string | null; colorHex?: string | null; usageCount?: number;
  isActive: boolean; _count?: { questionTags: number };
}
export interface ReferenceBook {
  id: string; title: string; edition?: string | null; publisher?: string | null;
  publicationYear?: number | null; isbn13?: string | null; isbn10?: string | null;
  subjectArea?: string | null; coverImageUrl?: string | null; description?: string | null;
  isActive: boolean; _count?: { questionReferences: number };
}

export const subjectsApi = crudClient<Subject>('/admin/subjects');
export const topicsApi = crudClient<Topic>('/admin/topics');
export const subtopicsApi = crudClient<Subtopic>('/admin/subtopics');
export const difficultyLevelsApi = crudClient<DifficultyLevel>('/admin/difficulty-levels');
export const tagsApi = crudClient<Tag>('/admin/tags');
export const referenceBooksApi = crudClient<ReferenceBook>('/admin/reference-books');
