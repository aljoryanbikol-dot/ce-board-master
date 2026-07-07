/**
 * @file kb-sync-library.ts — import ONLY the curriculum-wide Mock Examination
 * Library (The Ultimate/MOCK-EXAM-LIBRARY.json, 113 PRC-aligned templates)
 * without rescanning the 13 subject packages. Same env requirements and cache
 * stub as kb-migrate.ts; idempotent (upserts by template code).
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/kb-sync-library.ts
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ContentSyncService } from '../src/content-sync/content-sync.service';
import { SYNC_CONFIGS } from '../src/content-sync/content-sync.registry';
import { CacheService } from '../src/cache/cache.service';

const EXPORT_ROOT = 'C:\\Users\\Gavino Family\\Claude\\Projects\\CE Board Master\\_Exports\\The Ultimate';
const ADMIN_USER_ID = '490885ef-97a3-45bc-afea-f8cbd3412360';

function toCode(id: string, maxLen: number): string {
  return id.replace(/\./g, '-').toUpperCase().slice(0, maxLen);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const sync = app.get(ContentSyncService);

  // No local Redis in this environment — same no-op stub as kb-migrate.ts.
  const cacheSvc = app.get(CacheService);
  cacheSvc.get = async () => null;
  cacheSvc.set = async () => undefined;
  cacheSvc.del = async () => undefined;
  cacheSvc.invalidatePattern = async () => undefined;
  cacheSvc.remember = (async (_k: string, _t: number, f: () => Promise<unknown>) => f()) as never;

  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

  const subjects = await prisma.subject.findMany({ where: { isActive: true }, select: { id: true, code: true } });
  const subjectIdByCode = new Map(subjects.map((s) => [s.code, s.id]));
  log(`resolved ${subjectIdByCode.size} active subjects`);

  const lib = JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, 'MOCK-EXAM-LIBRARY.json'), 'utf-8'));
  const kindByScope: Record<string, string> = {
    'full-board': 'full_board',
    'board-paper': 'full_board',
    'mixed-subject': 'custom',
    'single-subject': 'subject',
    'topic-focused': 'subject',
  };
  const templates = (lib.records as any[]).map((r) => ({
    code: toCode(r.exam_code ?? r.template_id, 50),
    name: String(r.title).slice(0, 160),
    description: r.description ?? null,
    kind: kindByScope[r.scope] ?? 'custom',
    durationMinutes: Math.min(600, Math.max(15, Math.round(r.time_limit_min ?? r.estimated_duration_min ?? (r.total_items ?? 20) * 4.7))),
    passingScore: Math.round(r.passing_score_pct ?? 70),
    randomizeQuestions: true,
    randomizeChoices: true,
    composition: (Array.isArray(r.subject_coverage) && r.subject_coverage.length
      ? r.subject_coverage.map((sc: any) => ({ subjectId: subjectIdByCode.get(sc.subject_code)!, count: sc.item_count }))
      : [{ subjectId: subjectIdByCode.get(r.subject_code)!, count: r.total_items ?? 20 }]
    ).filter((c: any) => c.subjectId && c.count > 0),
  })).filter((t) => t.composition.length > 0);

  log(`importing ${templates.length}/${(lib.records as any[]).length} library templates`);
  const rpt = await sync.sync(SYNC_CONFIGS['mock-exam-templates'], templates, { atomic: false, actorId: ADMIN_USER_ID });
  log(`mock-exam-library: ${rpt.created} created + ${rpt.updated} updated, ${rpt.errors.length} errors`);
  if (rpt.errors.length) log('errors:', JSON.stringify(rpt.errors.slice(0, 10), null, 1));

  const counts = await prisma.examTemplate.groupBy({ by: ['kind'], where: { isActive: true }, _count: true });
  log('active templates by kind:', JSON.stringify(counts));

  await app.close();
  process.exit(rpt.errors.length ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
