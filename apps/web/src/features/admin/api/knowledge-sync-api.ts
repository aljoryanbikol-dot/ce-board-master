/**
 * @file knowledge-sync-api.ts — admin client for the generic Knowledge Library
 * sync engine. Backed by /admin/sync (kinds, per-kind sync + item list).
 */
import { api } from '@/lib/api/client';

export interface SyncKind { kind: string; label: string; entityType: string; }

export interface SyncReport {
  kind: string;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  errors: { index: number; publicId: string; message: string }[];
  durationMs: number;
}

export interface SyncedItem {
  id: string; publicId: string; status: string; version: number;
  syncedAt?: string | null; title?: string; name?: string; front?: string;
  [k: string]: unknown;
}

export const knowledgeSyncApi = {
  kinds: () => api.data<SyncKind[]>(api.get('/admin/sync/kinds')),
  sync: (kind: string, items: unknown[], atomic: boolean) =>
    api.data<SyncReport>(api.post(`/admin/sync/${kind}`, { items, atomic })),
  listItems: (kind: string, params?: Record<string, string | number | undefined>) =>
    api.data<{ items: SyncedItem[]; total: number; page: number; limit: number }>(api.get(`/admin/sync/${kind}/items`, { query: params })),
};
