/**
 * @file kb-sync-question-figures.ts — import per-question figures from The Ultimate.
 *
 * Root cause of the "ugly/missing figures" report: question figures live INSIDE
 * questions.json (`record.figure.svg_markup`) — a separate pool from the topic
 * diagrams in diagrams.json — and kb-migrate.ts never imported them. Production
 * therefore served stale July-1 placeholders for STR/SOM-era questions and no
 * figures at all for the other 11 subjects.
 *
 * The renderer resolves a question's figure by convention
 * (QuestionDiagramLookupService): publicId = 'FIG.' + questionCode with '-'→'.'.
 * We therefore upsert each figure under that DERIVED id — this also covers the
 * 37 collision-recoded question codes, whose export figure_id would otherwise
 * never match the lookup.
 *
 * Run: npx ts-node -r tsconfig-paths/register --transpile-only scripts/kb-sync-question-figures.ts
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { ContentSyncService } from '../src/content-sync/content-sync.service';
import { SYNC_CONFIGS } from '../src/content-sync/content-sync.registry';
import { CacheService } from '../src/cache/cache.service';

const EXPORT_ROOT = 'C:\\Users\\Gavino Family\\Claude\\Projects\\CE Board Master\\_Exports\\The Ultimate';
const ADMIN_USER_ID = '490885ef-97a3-45bc-afea-f8cbd3412360';
const PACKAGES = ['STR', 'SOM', 'EM', 'CEM', 'GEO', 'HYD', 'WRE', 'MATH', 'SUR', 'TRA', 'ECO', 'ENV', 'LAW'];

function toCode(id: string, maxLen: number): string {
  return id.replace(/\./g, '-').toUpperCase().slice(0, maxLen);
}
function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const sync = app.get(ContentSyncService);

  const cacheSvc = app.get(CacheService);
  cacheSvc.get = async () => null;
  cacheSvc.set = async () => undefined;
  cacheSvc.del = async () => undefined;
  cacheSvc.invalidatePattern = async () => undefined;
  cacheSvc.remember = (async (_k: string, _t: number, f: () => Promise<unknown>) => f()) as never;

  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
  let totalOk = 0, totalErr = 0, totalSkipped = 0;

  for (const code of PACKAGES) {
    const questionsRaw = JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, code, 'questions.json'), 'utf-8')).records as any[];

    // Same collision-aware code scheme as kb-migrate.ts, so the derived
    // figure id always matches the questionCode actually stored in the DB.
    const truncCounts = new Map<string, number>();
    for (const r of questionsRaw) {
      const t = toCode(r.question_id, 30);
      truncCounts.set(t, (truncCounts.get(t) ?? 0) + 1);
    }
    const questionCodeOf = (id: string): string => {
      const t = toCode(id, 30);
      if ((truncCounts.get(t) ?? 0) <= 1) return t;
      const tail = id.match(/(\d+)$/)?.[1] ?? '0';
      return `${toCode(id, 30 - tail.length - 1)}-${tail}`;
    };

    const items = questionsRaw
      .filter((r) => r.figure && typeof r.figure === 'object' && typeof r.figure.svg_markup === 'string' && r.figure.svg_markup.length > 0)
      .map((r) => ({
        publicId: `FIG.${questionCodeOf(r.question_id).replace(/-/g, '.')}`,
        subjectCode: code,
        title: (r.figure.title || `Figure for ${r.question_id}`).slice(0, 300),
        description: r.figure.description || null,
        imageUrl: svgToDataUri(r.figure.svg_markup),
        altText: (r.figure.title || r.figure.description || `Figure for ${r.question_id}`).slice(0, 500),
        diagramType: 'question-figure',
      }));
    const skipped = questionsRaw.length - items.length;
    totalSkipped += skipped;

    if (!items.length) { log(`${code}: 0 question figures with svg_markup (${skipped} without)`); continue; }
    const rpt = await sync.sync(SYNC_CONFIGS['diagrams'], items, { atomic: false, actorId: ADMIN_USER_ID });
    totalOk += rpt.created + rpt.updated; totalErr += rpt.errors.length;
    log(`${code}: figures ${rpt.created} created + ${rpt.updated} updated, ${rpt.errors.length} errors (${skipped} figure-less questions)`);
    if (rpt.errors.length) log('errors sample:', JSON.stringify(rpt.errors.slice(0, 3)));
  }

  log(`DONE — ${totalOk} question figures synced, ${totalErr} errors, ${totalSkipped} questions legitimately figure-less`);
  await app.close();
  process.exit(totalErr ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
