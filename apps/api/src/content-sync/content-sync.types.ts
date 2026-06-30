/**
 * @file content-sync.types.ts — config + report contracts for the sync engine.
 */
import type { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';

export interface SyncConfig<T = unknown> {
  /** URL/key segment, e.g. 'concepts'. */
  kind: string;
  /** entityType recorded in ContentSyncVersion, e.g. 'concept'. */
  entityType: string;
  /** Human label for the admin UI. */
  label: string;
  /** Zod schema validating one Library export row (input is raw JSON → unknown). */
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Stable natural key (returns publicId). */
  naturalKey: (row: T) => string;
  /** Maps a validated row to the model's content columns (engine sets sync columns). */
  toData: (row: T) => Record<string, unknown>;
  /** Returns the Prisma delegate for this model, bound to the given client. */
  getDelegate: (client: PrismaService | Prisma.TransactionClient) => unknown;
  /** Columns searched by the list endpoint. */
  searchFields: string[];
}

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
