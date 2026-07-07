/**
 * @file kb-sync-collided-questions.ts — recover questions lost to questionCode
 * truncation collisions.
 *
 * questionCode caps at 30 chars; several long dotted IDs truncate to the SAME
 * code (7 groups across SOM/EM/WRE/ECO/LAW), so successive imports collapsed
 * 37 distinct questions into 7 rows (30 lost). This script re-imports every
 * member of a collision group under a collision-aware code that preserves the
 * ID's numeric tail (same scheme now used by kb-migrate.ts), then soft-deletes
 * the 7 ambiguous truncated-code rows.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/kb-sync-collided-questions.ts
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { QuestionSyncService } from '../src/content-sync/question-sync.service';
import { CacheService } from '../src/cache/cache.service';

const EXPORT_ROOT = 'C:\\Users\\Gavino Family\\Claude\\Projects\\CE Board Master\\_Exports\\The Ultimate';
const ADMIN_USER_ID = '490885ef-97a3-45bc-afea-f8cbd3412360';
const PACKAGES = ['SOM', 'EM', 'WRE', 'ECO', 'LAW'];

function toCode(id: string, maxLen: number): string {
  return id.replace(/\./g, '-').toUpperCase().slice(0, maxLen);
}
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}
function readJson(dir: string, file: string): any {
  return JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, dir, file), 'utf-8'));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const qSync = app.get(QuestionSyncService);

  const cacheSvc = app.get(CacheService);
  cacheSvc.get = async () => null;
  cacheSvc.set = async () => undefined;
  cacheSvc.del = async () => undefined;
  cacheSvc.invalidatePattern = async () => undefined;
  cacheSvc.remember = (async (_k: string, _t: number, f: () => Promise<unknown>) => f()) as never;

  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
  const difficultyMap: Record<string, string> = { foundational: 'foundational', intermediate: 'intermediate', advanced: 'advanced' };

  for (const code of PACKAGES) {
    const topicsRaw = readJson(code, 'topics.json').records as any[];
    const topicCodeByOrig = new Map<string, string>();
    topicsRaw.forEach((t, i) => topicCodeByOrig.set(t.id, `${code}-${String(i + 1).padStart(3, '0')}`));

    const formulasRaw = readJson(code, 'formulas.json').records as any[];
    const formulaSlugByOrigId = new Map<string, string>();
    for (const f of formulasRaw) formulaSlugByOrigId.set(f.formula_id, slugify(`${code}: ${f.name}`.slice(0, 200)));

    const questionsRaw = readJson(code, 'questions.json').records as any[];
    const truncCounts = new Map<string, number>();
    for (const r of questionsRaw) {
      const t = toCode(r.question_id, 30);
      truncCounts.set(t, (truncCounts.get(t) ?? 0) + 1);
    }
    const collided = questionsRaw.filter((r) => (truncCounts.get(toCode(r.question_id, 30)) ?? 0) > 1);
    if (!collided.length) { log(`${code}: no collisions`); continue; }

    const items = collided.map((r) => {
      const tail = r.question_id.match(/(\d+)$/)?.[1] ?? '0';
      const topicCode = topicCodeByOrig.get(r.topic_id) ?? `${code}-001`;
      const intelligenceNotes = [r.engineering_notes, r.ai_tutor_explanation].filter(Boolean).join('\n\nAI Tutor: ');
      return {
        questionCode: `${toCode(r.question_id, 30 - tail.length - 1)}-${tail}`,
        subjectCode: code, topicCode, subtopicCode: `${topicCode}-G`,
        difficultyCode: difficultyMap[r.difficulty] ?? 'foundational',
        stemText: r.question,
        choices: Object.entries(r.choices ?? {}).map(([letter, text]) => ({ letter, text: String(text) })),
        correctChoice: r.correct_answer,
        explanationText: r.detailed_explanation || (Array.isArray(r.solution_steps) ? r.solution_steps.join(' ') : 'See solution steps.'),
        estSolvingTimeSec: Math.round((r.estimated_solving_time_min ?? 2) * 60),
        formulaSlugs: Array.isArray(r.formula_used) ? r.formula_used.map((fid: string) => formulaSlugByOrigId.get(fid)).filter(Boolean) : [],
        intelligence: intelligenceNotes ? { engineeringNotes: intelligenceNotes.slice(0, 8000), commonMistakes: Array.isArray(r.common_mistakes) ? r.common_mistakes.slice(0, 20) : undefined } : undefined,
      };
    });
    const rpt = await qSync.sync(items as never, { atomic: false, user: { id: ADMIN_USER_ID } as never });
    log(`${code}: collided ${items.length} -> ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
    if (rpt.errors.length) log('errors:', JSON.stringify(rpt.errors.slice(0, 5)));

    // Retire the ambiguous truncated rows (their content is a nondeterministic
    // survivor of the collision; each member now exists under a unique code).
    const ambiguous = [...truncCounts.entries()].filter(([, n]) => n > 1).map(([t]) => t);
    const del = await prisma.question.updateMany({ where: { questionCode: { in: ambiguous }, deletedAt: null }, data: { deletedAt: new Date() } });
    log(`${code}: soft-deleted ${del.count} ambiguous truncated rows (${ambiguous.join(', ')})`);
  }

  const total = await prisma.question.count({ where: { deletedAt: null, subject: { isActive: true } } });
  log(`DONE — active-subject questions now: ${total} (expect 1202)`);
  await app.close();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
