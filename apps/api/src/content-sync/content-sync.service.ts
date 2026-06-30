/**
 * @file content-sync.service.ts
 * @module ContentSync
 *
 * Generic synchronization engine for Knowledge Library content. One engine,
 * many type-aware models. Implements the full sync contract:
 *   • validation      — each row parsed by the type's Zod schema
 *   • content hash     — SHA-256 of the mapped content; unchanged rows skipped
 *   • upsert           — matched by publicId (the Library's stable natural key)
 *   • version history  — version bump + immutable snapshot in ContentSyncVersion
 *   • sync report      — created / updated / unchanged / failed (+ per-row errors)
 *   • rollback         — atomic mode runs the whole batch in one transaction
 *
 * The Cowork Knowledge Library is the source of truth; this only consumes.
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { SyncConfig, SyncReport } from './content-sync.types';

const SOURCE_PROJECT = 'CE Board Master Knowledge Library';

/** Minimal structural view of a Prisma model delegate the engine needs. */
interface SyncDelegate {
  findUnique(args: { where: { publicId: string }; select?: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  count(args: Record<string, unknown>): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  update(args: { where: { publicId: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
}

/** Stable stringify (sorted keys) so the hash is deterministic across runs. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function bumpPatch(semver: string | null | undefined): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(semver ?? '');
  if (!m) return '1.0.1';
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

@Injectable()
export class ContentSyncService {
  private readonly logger = new Logger(ContentSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sync(cfg: SyncConfig, rawItems: unknown[], opts: { atomic: boolean; actorId: string }): Promise<SyncReport> {
    const started = Date.now();
    const errors: SyncReport['errors'] = [];

    // 1. Validate + map + hash every row up front.
    const prepared: { index: number; publicId: string; hash: string; data: Record<string, unknown> }[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const parsed = cfg.schema.safeParse(rawItems[i]);
      if (!parsed.success) {
        const pid = (rawItems[i] as { publicId?: string })?.publicId ?? '';
        errors.push({ index: i, publicId: pid, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
        continue;
      }
      const data = cfg.toData(parsed.data);
      prepared.push({ index: i, publicId: cfg.naturalKey(parsed.data), hash: createHash('sha256').update(stableStringify(data)).digest('hex'), data });
    }

    // Atomic: a single invalid row rejects the whole batch (nothing written).
    if (opts.atomic && errors.length > 0) {
      return { kind: cfg.kind, total: rawItems.length, created: 0, updated: 0, unchanged: 0, failed: errors.length, errors, durationMs: Date.now() - started };
    }

    const keyField = cfg.keyField ?? 'publicId';
    const versionField = cfg.versionField ?? 'version';
    const semverField = cfg.semverField ?? 'semver';
    const select: Record<string, boolean> = { id: true, contentHash: true, [versionField]: true, [semverField]: true };
    if (cfg.softDeleteField) select[cfg.softDeleteField] = true;
    const syncCols = (version: number, semver: string): Record<string, unknown> => ({
      [versionField]: version, [semverField]: semver, syncedAt: new Date(), sourceProject: SOURCE_PROJECT,
      ...(cfg.activeField ? { [cfg.activeField]: true } : {}),
      ...(cfg.softDeleteField ? { [cfg.softDeleteField]: null } : {}),
    });

    const applyAll = async (client: PrismaService | Prisma.TransactionClient) => {
      const delegate = cfg.getDelegate(client) as unknown as SyncDelegate;
      const versionDelegate = (client as unknown as { contentSyncVersion: { create(a: { data: Record<string, unknown> }): Promise<unknown> } }).contentSyncVersion;
      let created = 0, updated = 0, unchanged = 0;
      for (const p of prepared) {
        try {
          const existing = await delegate.findUnique({ where: { [keyField]: p.publicId } as { publicId: string }, select });
          if (existing) {
            const isDeleted = cfg.softDeleteField ? !!existing[cfg.softDeleteField] : false;
            if (existing.contentHash === p.hash && !isDeleted) { unchanged++; continue; }
            const nextVersion = ((existing[versionField] as number) ?? 1) + 1;
            const semver = bumpPatch(existing[semverField] as string);
            const row = await delegate.update({
              where: { [keyField]: p.publicId } as { publicId: string },
              data: { ...p.data, ...syncCols(nextVersion, semver), contentHash: p.hash },
            });
            await versionDelegate.create({ data: { entityType: cfg.entityType, entityId: row.id, publicId: p.publicId, version: nextVersion, semver, contentHash: p.hash, snapshot: p.data as Prisma.InputJsonValue, changeSummary: 'Synced from Knowledge Library', syncedBy: opts.actorId } });
            updated++;
          } else {
            const row = await delegate.create({
              data: { ...p.data, [keyField]: p.publicId, ...syncCols(1, '1.0.0'), contentHash: p.hash },
            });
            await versionDelegate.create({ data: { entityType: cfg.entityType, entityId: row.id, publicId: p.publicId, version: 1, semver: '1.0.0', contentHash: p.hash, snapshot: p.data as Prisma.InputJsonValue, changeSummary: 'Initial sync from Knowledge Library', syncedBy: opts.actorId } });
            created++;
          }
        } catch (e) {
          if (opts.atomic) throw e; // abort the transaction → full rollback
          errors.push({ index: p.index, publicId: p.publicId, message: e instanceof Error ? e.message : 'write failed' });
        }
      }
      return { created, updated, unchanged };
    };

    const counts = opts.atomic
      ? await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => applyAll(tx))
      : await applyAll(this.prisma);

    const report: SyncReport = { kind: cfg.kind, total: rawItems.length, ...counts, failed: errors.length, errors, durationMs: Date.now() - started };
    this.logger.log({ message: 'Content sync complete', ...report, errors: errors.length });
    return report;
  }

  /** Offset-paginated list of synced items for a kind (admin management view). */
  async list(cfg: SyncConfig, params: { q?: string; status?: string; page?: number; limit?: number }) {
    const delegate = cfg.getDelegate(this.prisma) as unknown as SyncDelegate;
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const keyField = cfg.keyField ?? 'publicId';
    const where: Record<string, unknown> = {};
    if (cfg.softDeleteField) where[cfg.softDeleteField] = null;
    else if (cfg.activeField) where[cfg.activeField] = true;
    if (params.status) where.status = params.status;
    if (params.q) where.OR = cfg.searchFields.map((f) => ({ [f]: { contains: params.q, mode: 'insensitive' } }));
    const [items, total] = await Promise.all([
      delegate.findMany({ where, orderBy: { [keyField]: 'asc' }, skip: (page - 1) * limit, take: limit }),
      delegate.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
