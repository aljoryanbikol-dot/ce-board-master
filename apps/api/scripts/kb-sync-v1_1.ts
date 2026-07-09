/**
 * @file kb-sync-v1_1.ts — Knowledge Library v1.1 incremental production sync.
 *
 * Import authority: Content SDK v1.1.0 `relationships/content-index.json`
 * (every record ID) + `CHANGESET-1.0.0-to-1.1.0.json` (modified_ids).
 * Semantics per the release notes:
 *   absent in DB  -> INSERT
 *   modified      -> UPDATE in place (changeset modified_ids)
 *   otherwise     -> SKIP
 * Never DELETE. Frozen libraries (board simulations, mock exam templates)
 * are not touched. Upserts go through the same Nest services as kb-migrate,
 * so a second run is a no-op.
 *
 * Run (from apps/api):
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/kb-sync-v1_1.ts
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ContentSyncService } from '../src/content-sync/content-sync.service';
import { QuestionSyncService } from '../src/content-sync/question-sync.service';
import { SYNC_CONFIGS } from '../src/content-sync/content-sync.registry';
import { FormulaService } from '../src/formulas/services/formula.service';
import { LearningObjectiveService } from '../src/learning-objectives/services/learning-objective.service';
import { CacheService } from '../src/cache/cache.service';

const EXPORT_ROOT = 'C:\\Users\\Gavino Family\\Claude\\Projects\\CE Board Master\\_Exports\\The Ultimate';
const SDK_ROOT = 'C:\\Users\\Gavino Family\\Claude\\Projects\\CE Board Master\\_Exports\\Content SDK';
const ADMIN_USER_ID = '490885ef-97a3-45bc-afea-f8cbd3412360';

const PACKAGES = [
  { dir: 'STR', code: 'STR' }, { dir: 'SOM', code: 'SOM' }, { dir: 'EM', code: 'EM' },
  { dir: 'CEM', code: 'CEM' }, { dir: 'GEO', code: 'GEO' }, { dir: 'HYD', code: 'HYD' },
  { dir: 'WRE', code: 'WRE' }, { dir: 'MATH', code: 'MATH' }, { dir: 'SUR', code: 'SUR' },
  { dir: 'TRA', code: 'TRA' }, { dir: 'ECO', code: 'ECO' }, { dir: 'ENV', code: 'ENV' },
  { dir: 'LAW', code: 'LAW' },
];

function readJson(dir: string, file: string): any {
  return JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, dir, file), 'utf-8'));
}
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}
function toCode(id: string, maxLen: number): string {
  return id.replace(/\./g, '-').toUpperCase().slice(0, maxLen);
}
function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

async function main() {
  const changeset = JSON.parse(fs.readFileSync(path.join(SDK_ROOT, 'CHANGESET-1.0.0-to-1.1.0.json'), 'utf-8'));
  const contentIndex = JSON.parse(fs.readFileSync(path.join(SDK_ROOT, 'relationships', 'content-index.json'), 'utf-8'));
  const modifiedQ = new Set<string>(changeset.questions.modified_ids ?? []);
  const modifiedFc = new Set<string>(changeset.flashcards.modified_ids ?? []);
  const modifiedF = new Set<string>(changeset.formulas.modified_ids ?? []);
  const modifiedLo = new Set<string>(changeset.learning_objectives.modified_ids ?? []);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const sync = app.get(ContentSyncService);
  const qSync = app.get(QuestionSyncService);
  const formulaSvc = app.get(FormulaService);
  const loSvc = app.get(LearningObjectiveService);

  // No reachable Redis in this environment — stub cache (see kb-migrate.ts).
  const cacheSvc = app.get(CacheService);
  cacheSvc.get = async () => null;
  cacheSvc.set = async () => undefined;
  cacheSvc.del = async () => undefined;
  cacheSvc.invalidatePattern = async () => undefined;
  cacheSvc.remember = (async (_k: string, _t: number, f: () => Promise<unknown>) => f()) as never;

  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
  const totals = { qInserted: 0, qUpdated: 0, qSkipped: 0, fcInserted: 0, fcUpdated: 0, fcSkipped: 0, figs: 0, formulas: 0, los: 0, errors: 0 };

  // Existing flashcard publicIds (5.7k) — one query, reused across subjects.
  const existingFc = new Set(
    (await prisma.flashcard.findMany({ select: { publicId: true } })).map((r) => r.publicId),
  );

  for (const pkg of PACKAGES) {
    const subject = await prisma.subject.findUnique({ where: { code: pkg.code } });
    if (!subject) { log(`!! subject ${pkg.code} missing — aborting`); process.exit(1); }

    // Topic code map (index-ordered, unchanged in v1.1 — topics added: 0).
    const topicsRaw = readJson(pkg.dir, 'topics.json').records as any[];
    const topicCodeByOrig = new Map<string, string>();
    const subtopicCodeByOrig = new Map<string, string>();
    topicsRaw.forEach((t, i) => {
      const code = `${pkg.code}-${String(i + 1).padStart(3, '0')}`;
      topicCodeByOrig.set(t.id, code);
      subtopicCodeByOrig.set(t.id, `${code}-G`);
    });

    // Formula slug map (no import here except modified subset below).
    const formulasRaw = readJson(pkg.dir, 'formulas.json').records as any[];
    const formulaSlugByOrigId = new Map<string, string>();
    for (const r of formulasRaw) formulaSlugByOrigId.set(r.formula_id, slugify(`${pkg.code}: ${r.name}`.slice(0, 200)));

    // ── Modified formulas (34, all TRA in this release) ──────────────────────
    const modFormulas = formulasRaw.filter((r) => modifiedF.has(r.formula_id));
    if (modFormulas.length) {
      const items = modFormulas.map((r) => {
        const name = `${pkg.code}: ${r.name}`.slice(0, 200);
        const variables = r.variables && typeof r.variables === 'object'
          ? Object.entries(r.variables).map(([symbol, desc]) => ({ symbol, name: String(desc).slice(0, 200) }))
          : [];
        return {
          subjectCode: pkg.code, name,
          expressionText: r.formula || name, expressionLatex: r.formula || name,
          variables, derivation: r.derivation || undefined,
          assumptions: Array.isArray(r.assumptions)
            ? r.assumptions.slice(0, 20).map((a: unknown) =>
                typeof a === 'string' ? a : Object.entries(a as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join('; '))
            : [],
          limitations: Array.isArray(r.limitations) ? r.limitations.join('; ').slice(0, 2000) : (r.limitations || undefined),
          exampleProblem: r.engineering_interpretation || undefined,
        };
      });
      const rpt = await formulaSvc.bulkSync(items as never);
      totals.formulas += rpt.created + rpt.updated; totals.errors += rpt.errors.length;
      log(`${pkg.code} formulas (modified): ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
    }

    // ── Questions: INSERT (absent) + UPDATE (modified) ───────────────────────
    const questionsRaw = readJson(pkg.dir, 'questions.json').records as any[];
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
    const existingQ = new Set(
      (await prisma.question.findMany({ where: { subjectId: subject.id }, select: { questionCode: true } })).map((r) => r.questionCode),
    );
    const targets = questionsRaw.filter((r) => !existingQ.has(questionCodeOf(r.question_id)) || modifiedQ.has(r.question_id));
    const inserted = targets.filter((r) => !existingQ.has(questionCodeOf(r.question_id))).length;
    totals.qSkipped += questionsRaw.length - targets.length;

    if (targets.length) {
      const difficultyMap: Record<string, string> = { foundational: 'foundational', intermediate: 'intermediate', advanced: 'advanced' };
      const questionItems = targets.map((r) => {
        const topicCode = topicCodeByOrig.get(r.topic_id) ?? `${pkg.code}-001`;
        const subtopicCode = subtopicCodeByOrig.get(r.topic_id) ?? `${topicCode}-G`;
        const choices = Object.entries(r.choices ?? {}).map(([letter, text]) => ({ letter, text: String(text) }));
        const formulaSlugs = Array.isArray(r.formula_used)
          ? r.formula_used.map((fid: string) => formulaSlugByOrigId.get(fid)).filter(Boolean)
          : [];
        const intelligenceNotes = [r.engineering_notes, r.ai_tutor_explanation].filter(Boolean).join('\n\nAI Tutor: ');
        return {
          questionCode: questionCodeOf(r.question_id),
          subjectCode: pkg.code, topicCode, subtopicCode,
          difficultyCode: difficultyMap[r.difficulty] ?? 'foundational',
          stemText: r.question, choices, correctChoice: r.correct_answer,
          explanationText: r.detailed_explanation || (Array.isArray(r.solution_steps) ? r.solution_steps.join(' ') : 'See solution steps.'),
          estSolvingTimeSec: Math.round((r.estimated_solving_time_min ?? 2) * 60),
          formulaSlugs,
          intelligence: intelligenceNotes ? { engineeringNotes: intelligenceNotes.slice(0, 8000), commonMistakes: Array.isArray(r.common_mistakes) ? r.common_mistakes.slice(0, 20) : undefined } : undefined,
        };
      });
      const rpt = await qSync.sync(questionItems, { atomic: false, user: { id: ADMIN_USER_ID } as never });
      totals.qInserted += inserted; totals.qUpdated += targets.length - inserted; totals.errors += rpt.errors.length;
      log(`${pkg.code} questions: ${targets.length} targeted (${inserted} new, ${targets.length - inserted} modified) -> ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
      if (rpt.errors.length) log('  sample:', rpt.errors.slice(0, 3));

      // Question figures for the targeted questions only.
      const figureItems = targets
        .filter((r) => r.figure && typeof r.figure === 'object' && typeof r.figure.svg_markup === 'string' && r.figure.svg_markup.length > 0)
        .map((r) => ({
          publicId: `FIG.${questionCodeOf(r.question_id).replace(/-/g, '.')}`,
          subjectCode: pkg.code,
          title: (r.figure.title || `Figure for ${r.question_id}`).slice(0, 300),
          description: r.figure.description || null,
          imageUrl: svgToDataUri(r.figure.svg_markup),
          altText: (r.figure.title || r.figure.description || `Figure for ${r.question_id}`).slice(0, 500),
          diagramType: 'question-figure',
        }));
      if (figureItems.length) {
        const rpt2 = await sync.sync(SYNC_CONFIGS['diagrams'], figureItems, { atomic: false, actorId: ADMIN_USER_ID });
        totals.figs += rpt2.created + rpt2.updated; totals.errors += rpt2.errors.length;
        log(`${pkg.code} question-figures: ${rpt2.created}+${rpt2.updated} ok, ${rpt2.errors.length} errors`);
      }
    }

    // ── Flashcards: INSERT (absent) + UPDATE (modified) ──────────────────────
    const flashcardsRaw = readJson(pkg.dir, 'flashcards.json').records as any[];
    const fcTargets = flashcardsRaw.filter((r) => !existingFc.has(r.flashcard_id) || modifiedFc.has(r.flashcard_id));
    const fcInserted = fcTargets.filter((r) => !existingFc.has(r.flashcard_id)).length;
    totals.fcSkipped += flashcardsRaw.length - fcTargets.length;
    if (fcTargets.length) {
      const items = fcTargets.map((r) => ({
        publicId: r.flashcard_id, subjectCode: pkg.code, topicCode: topicCodeByOrig.get(r.topic_id),
        front: r.front, back: r.back || 'See the Formula Library for the full expression.', tags: r.tags ?? [],
      }));
      const rpt = await sync.sync(SYNC_CONFIGS['flashcards'], items, { atomic: false, actorId: ADMIN_USER_ID });
      totals.fcInserted += fcInserted; totals.fcUpdated += fcTargets.length - fcInserted; totals.errors += rpt.errors.length;
      log(`${pkg.code} flashcards: ${fcTargets.length} targeted (${fcInserted} new, ${fcTargets.length - fcInserted} modified) -> ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
    }

    // ── Learning objectives: only subjects owning a modified LO ──────────────
    const hasModLo = [...modifiedLo].some((id) => id.startsWith(`${pkg.code}.`));
    if (hasModLo) {
      const losRaw = readJson(pkg.dir, 'learning-objectives.json').records as any[];
      const loByTopicSeq = new Map<string, number>();
      const loItems = losRaw.map((r) => {
        const topicSeq = [...topicCodeByOrig.keys()].indexOf(r.topic_id) + 1 || 1;
        const seqNum = (loByTopicSeq.get(String(topicSeq)) ?? 0) + 1;
        loByTopicSeq.set(String(topicSeq), seqNum);
        return { subjectCode: pkg.code, topicCode: topicSeq, subtopicCode: 1, sequenceNumber: seqNum, statement: r.text, subjectId: subject.id };
      });
      const rpt = await loSvc.bulkSync(loItems as never, { id: ADMIN_USER_ID } as never);
      totals.los += rpt.updated; totals.errors += rpt.errors.length;
      log(`${pkg.code} learning-objectives (subject re-sync for modified LO): ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
    }
  }

  // ── Verification against content-index ─────────────────────────────────────
  log('\n=== VERIFY ===');
  const idxCounts = Object.fromEntries(Object.entries(contentIndex).map(([k, v]) => [k, Object.keys(v as object).length]));
  const dbCounts = {
    questions: await prisma.question.count({ where: { subject: { code: { in: PACKAGES.map((p) => p.code) } } } }),
    flashcards: await prisma.flashcard.count(),
    formulas: await prisma.formulaLibrary.count(),
    concepts: await prisma.concept.count(),
    diagrams: await prisma.diagram.count(),
    learningObjectives: await prisma.learningObjective.count(),
    boardForms: await prisma.examTemplate.count({ where: { code: { startsWith: 'CE-PRCFORM-' } } }),
    templates: await prisma.examTemplate.count({ where: { code: { not: { startsWith: 'CE-PRCFORM-' } } } }),
  };
  log('content-index counts:', JSON.stringify(idxCounts));
  log('production DB counts:', JSON.stringify(dbCounts));
  log('totals:', JSON.stringify(totals));
  log('\n=== v1.1 SYNC COMPLETE ===');
  await app.close();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
