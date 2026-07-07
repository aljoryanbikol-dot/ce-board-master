/**
 * @file kb-repair-question-taxonomy.ts — re-point questions to the new 13-subject taxonomy.
 *
 * The question importer's upsert treats subject/topic as stable identifiers and
 * never changes them on update. Questions whose codes collided with rows from
 * the pre-migration STRUC-era import therefore kept their LEGACY subjectId /
 * topicId, leaving e.g. STR with zero active-subject questions (which breaks
 * exam composition). This one-off repair recomputes each exported question's
 * intended subject/topic/subtopic (same mapping rules as kb-migrate.ts) and
 * updates only rows that point at the wrong subject or topic.
 *
 * Run: npx ts-node scripts/kb-repair-question-taxonomy.ts  (DATABASE_URL only)
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const EXPORT_ROOT = 'C:\\Users\\Gavino Family\\Claude\\Projects\\CE Board Master\\_Exports\\The Ultimate';
const PACKAGES = ['STR', 'SOM', 'EM', 'CEM', 'GEO', 'HYD', 'WRE', 'MATH', 'SUR', 'TRA', 'ECO', 'ENV', 'LAW'];

function toCode(id: string, maxLen: number): string {
  return id.replace(/\./g, '-').toUpperCase().slice(0, maxLen);
}

async function main() {
  const prisma = new PrismaClient();
  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
  let repaired = 0, ok = 0, missing = 0;

  for (const code of PACKAGES) {
    const subject = await prisma.subject.findUnique({ where: { code }, select: { id: true } });
    if (!subject) { log(`${code}: subject missing, skipped`); continue; }

    const topicsRaw = JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, code, 'topics.json'), 'utf-8')).records as any[];
    const topicCodeByOrig = new Map<string, string>();
    topicsRaw.forEach((t, i) => topicCodeByOrig.set(t.id, `${code}-${String(i + 1).padStart(3, '0')}`));

    const topics = await prisma.topic.findMany({ where: { subjectId: subject.id }, select: { id: true, code: true } });
    const topicIdByCode = new Map(topics.map((t) => [t.code, t.id]));
    const subtopics = await prisma.subtopic.findMany({ where: { topicId: { in: topics.map((t) => t.id) } }, select: { id: true, code: true } });
    const subtopicIdByCode = new Map(subtopics.map((s) => [s.code, s.id]));

    const questionsRaw = JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, code, 'questions.json'), 'utf-8')).records as any[];
    let subjRepaired = 0;
    for (const q of questionsRaw) {
      const qCode = toCode(q.question_id, 30);
      const topicCode = topicCodeByOrig.get(q.topic_id) ?? `${code}-001`;
      const topicId = topicIdByCode.get(topicCode);
      const subtopicId = subtopicIdByCode.get(`${topicCode}-G`);
      if (!topicId || !subtopicId) { log(`${code}: no topic/subtopic for ${topicCode}`); missing++; continue; }

      const row = await prisma.question.findFirst({ where: { questionCode: qCode, deletedAt: null }, select: { id: true, subjectId: true, topicId: true } });
      if (!row) { missing++; continue; }
      if (row.subjectId === subject.id && row.topicId === topicId) { ok++; continue; }
      await prisma.question.update({ where: { id: row.id }, data: { subjectId: subject.id, topicId, subtopicId } });
      repaired++; subjRepaired++;
    }
    log(`${code}: repaired ${subjRepaired}/${questionsRaw.length}`);
  }

  log(`DONE — repaired: ${repaired}, already-correct: ${ok}, missing: ${missing}`);
  const rows = await prisma.question.groupBy({ by: ['subjectId'], where: { deletedAt: null }, _count: true });
  const subs = await prisma.subject.findMany({ select: { id: true, code: true, isActive: true } });
  const byId = new Map(subs.map((s) => [s.id, s]));
  rows.forEach((r) => { const s = byId.get(r.subjectId); console.log(s?.code, s?.isActive ? 'ACTIVE' : 'legacy', r._count); });
  await prisma.$disconnect();
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
