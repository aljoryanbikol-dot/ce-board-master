/**
 * @file kb-sync-board-forms.ts — import the Content SDK's 1,000 PRC board
 * simulation forms (BOARD-SIMULATIONS.json) as ExamTemplate rows.
 *
 * Each form carries an explicit ORDERED all_question_ids list (references,
 * not copies). We store the list as formQuestionCodes (converted with the
 * same collision-aware questionCode scheme the question importer uses) plus
 * the PRC day/session structure for display. The exam builder plays these
 * forms verbatim — fixed order, no shuffling.
 *
 * Prerequisite: the subject question sync must have imported all 1,974
 * questions first (forms reference the full bank).
 *
 * Run: npx ts-node --transpile-only scripts/kb-sync-board-forms.ts  (DATABASE_URL only)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const EXPORT_ROOT = 'C:\\Users\\Gavino Family\\Claude\\Projects\\CE Board Master\\_Exports\\The Ultimate';
const PACKAGES = ['STR', 'SOM', 'EM', 'CEM', 'GEO', 'HYD', 'WRE', 'MATH', 'SUR', 'TRA', 'ECO', 'ENV', 'LAW'];
const ADMIN_USER_ID = '490885ef-97a3-45bc-afea-f8cbd3412360';

function toCode(id: string, maxLen: number): string {
  return id.replace(/\./g, '-').toUpperCase().slice(0, maxLen);
}

/** question_id -> questionCode across all subjects (collision-aware, mirrors kb-migrate.ts). */
function buildCodeMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const subj of PACKAGES) {
    const recs = JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, subj, 'questions.json'), 'utf-8')).records as Array<{ question_id: string }>;
    const trunc = new Map<string, number>();
    for (const r of recs) {
      const t = toCode(r.question_id, 30);
      trunc.set(t, (trunc.get(t) ?? 0) + 1);
    }
    for (const r of recs) {
      const t = toCode(r.question_id, 30);
      if ((trunc.get(t) ?? 0) <= 1) map.set(r.question_id, t);
      else {
        const tail = r.question_id.match(/(\d+)$/)?.[1] ?? '0';
        map.set(r.question_id, `${toCode(r.question_id, 30 - tail.length - 1)}-${tail}`);
      }
    }
  }
  return map;
}

async function main() {
  const prisma = new PrismaClient();
  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

  const codeByQuestionId = buildCodeMap();
  log(`code map: ${codeByQuestionId.size} question ids`);

  const subjects = await prisma.subject.findMany({ where: { isActive: true }, select: { id: true, code: true } });
  const subjectIdByCode = new Map(subjects.map((s) => [s.code, s.id]));

  const lib = JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, 'BOARD-SIMULATIONS.json'), 'utf-8'));
  const records = lib.records as any[];
  log(`board forms in SDK: ${records.length}`);

  let ok = 0, failed = 0, unresolved = 0;
  for (const r of records) {
    const codes: string[] = [];
    let miss = 0;
    for (const qid of r.all_question_ids as string[]) {
      const c = codeByQuestionId.get(qid);
      if (c) codes.push(c); else miss++;
    }
    if (miss > 0) { unresolved++; log(`SKIP ${r.exam_code}: ${miss} unresolved question ids`); continue; }

    const composition = (r.subject_coverage as Array<{ subject_code: string; items: number }> | undefined ?? [])
      .map((sc) => ({ subjectId: subjectIdByCode.get(sc.subject_code), count: (sc as any).items ?? (sc as any).item_count }))
      .filter((c) => c.subjectId && c.count > 0);

    try {
      await prisma.examTemplate.upsert({
        where: { code: r.exam_code },
        update: {
          name: String(r.title).slice(0, 160),
          description: r.description ?? null,
          totalQuestions: r.total_items,
          durationMinutes: Math.min(600, Math.max(15, Math.round(r.time_limit_min ?? r.total_time_min ?? 540))),
          passingScore: Math.round(r.passing_score_pct ?? 70),
          formQuestionCodes: codes as unknown as Prisma.InputJsonValue,
          formStructure: (r.prc_structure ?? null) as Prisma.InputJsonValue,
          composition: composition as unknown as Prisma.InputJsonValue,
          isActive: true,
        },
        create: {
          code: r.exam_code,
          name: String(r.title).slice(0, 160),
          description: r.description ?? null,
          kind: 'full_board',
          totalQuestions: r.total_items,
          durationMinutes: Math.min(600, Math.max(15, Math.round(r.time_limit_min ?? r.total_time_min ?? 540))),
          passingScore: Math.round(r.passing_score_pct ?? 70),
          randomizeQuestions: false,
          randomizeChoices: false,
          composition: composition as unknown as Prisma.InputJsonValue,
          formQuestionCodes: codes as unknown as Prisma.InputJsonValue,
          formStructure: (r.prc_structure ?? null) as Prisma.InputJsonValue,
          createdBy: ADMIN_USER_ID,
          sourceProject: 'content-sdk-v1',
        },
      });
      ok++;
      if (ok % 100 === 0) log(`upserted ${ok}/${records.length}`);
    } catch (e) {
      failed++;
      if (failed <= 3) log(`FAIL ${r.exam_code}:`, (e as Error).message.slice(0, 200));
    }
  }

  log(`DONE — ok: ${ok}, failed: ${failed}, skipped-unresolved: ${unresolved}`);
  const count = await prisma.examTemplate.count({ where: { isActive: true, code: { startsWith: 'CE-PRCFORM-' } } });
  log(`active PRC forms in DB: ${count}`);
  await prisma.$disconnect();
  process.exit(failed || unresolved ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
