/**
 * @file kb-sync-v2_6.ts — Knowledge Library v2.6 final production import.
 *
 * Reads `_Exports/The Ultimate` directly (per HANDOFF-REPORT.md v2.6) and
 * upserts every entity by its stable ID through the real Nest services, so
 * validation/versioning matches the admin UI. Idempotent: re-running is a
 * no-op because every write is an upsert on a stable key and nothing is ever
 * deleted.
 *
 * Scope (additive; nothing removed):
 *   topics · concepts · formulas · diagrams · question-figures · questions
 *   learning-objectives · flashcards · engineering-notes · engineering-tips
 *   misconceptions · review-notes · situational-sets (+ their linked questions)
 * FROZEN, never touched: BOARD-SIMULATIONS.json, MOCK-EXAM-LIBRARY.json,
 * per-subject mock-exam-templates.json.
 *
 * Run (from apps/api):
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/kb-sync-v2_6.ts [SUBJECT_CODE ...]
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
const ADMIN_USER_ID = '490885ef-97a3-45bc-afea-f8cbd3412360';
const ALL_PKGS = ['STR', 'SOM', 'EM', 'CEM', 'GEO', 'HYD', 'WRE', 'MATH', 'SUR', 'TRA', 'ECO', 'ENV', 'LAW'];

const SUBJECT_META: Record<string, { name: string; examDay: number; weight: number }> = {
  STR: { name: 'Structural Engineering', examDay: 1, weight: 20 },
  SOM: { name: 'Mechanics of Deformable Bodies', examDay: 1, weight: 10 },
  EM: { name: 'Engineering Mechanics', examDay: 1, weight: 10 },
  CEM: { name: 'Construction Engineering and Management', examDay: 2, weight: 8 },
  GEO: { name: 'Geotechnical Engineering', examDay: 1, weight: 10 },
  HYD: { name: 'Fluid Mechanics and Hydraulics', examDay: 1, weight: 10 },
  WRE: { name: 'Hydrology and Water Resources', examDay: 2, weight: 5 },
  MATH: { name: 'Engineering Mathematics', examDay: 1, weight: 20 },
  SUR: { name: 'Surveying and Geomatics', examDay: 1, weight: 10 },
  TRA: { name: 'Transportation Engineering', examDay: 2, weight: 8 },
  ECO: { name: 'Engineering Economics', examDay: 2, weight: 5 },
  ENV: { name: 'Environmental Engineering', examDay: 2, weight: 8 },
  LAW: { name: 'Engineering Laws and Ethics', examDay: 2, weight: 8 },
};

function readJson(rel: string): any {
  return JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, rel), 'utf-8'));
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
/**
 * Serverless Postgres (Neon) drops idle/long connections mid-run, which
 * surfaces as "Can't reach database server" or "Transaction not found".
 * Every write here is an idempotent upsert, so the safe response is to wait
 * and retry the same step rather than abort a multi-hour import.
 */
async function retryable<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /Can't reach database server|Transaction not found|Connection .*closed|ECONNRESET|terminating connection/i.test(msg);
      if (!transient || i === attempts) throw err;
      const waitMs = Math.min(30_000, 2_000 * 2 ** (i - 1));
      console.log(`${new Date().toISOString()} [retry ${i}/${attempts}] ${label}: ${msg.split('\n')[0]} — waiting ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

/** Collision-aware 30-char question code (preserves the numeric tail). */
function codeFactory(ids: string[]): (id: string) => string {
  const trunc = new Map<string, number>();
  for (const id of ids) {
    const t = toCode(id, 30);
    trunc.set(t, (trunc.get(t) ?? 0) + 1);
  }
  return (id: string) => {
    const t = toCode(id, 30);
    if ((trunc.get(t) ?? 0) <= 1) return t;
    const tail = id.match(/(\d+)$/)?.[1] ?? '0';
    return `${toCode(id, 30 - tail.length - 1)}-${tail}`;
  };
}

async function main() {
  const only = process.argv.slice(2).filter((a) => ALL_PKGS.includes(a));
  const PKGS = only.length > 0 ? only : ALL_PKGS;

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const sync = app.get(ContentSyncService);
  const qSync = app.get(QuestionSyncService);
  const formulaSvc = app.get(FormulaService);
  const loSvc = app.get(LearningObjectiveService);

  // No reachable Redis from a script host — stub the cache (keyv has no
  // command timeout, so real calls would queue forever).
  const cacheSvc = app.get(CacheService);
  cacheSvc.get = async () => null;
  cacheSvc.set = async () => undefined;
  cacheSvc.del = async () => undefined;
  cacheSvc.invalidatePattern = async () => undefined;
  cacheSvc.remember = (async (_k: string, _t: number, f: () => Promise<unknown>) => f()) as never;

  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
  const T = { topics: 0, concepts: 0, formulas: 0, diagrams: 0, figures: 0, questions: 0, los: 0, flashcards: 0, notes: 0, tips: 0, misconceptions: 0, reviewNotes: 0, situations: 0, situationalQ: 0, errors: 0 };

  log(`=== KL v2.6 import — subjects: ${PKGS.join(', ')} ===`);

  for (const code of PKGS) {
    const meta = SUBJECT_META[code]!;
    const dir = code;
    log(`\n=== ${code} (${meta.name}) ===`);

    const subject = await prisma.subject.upsert({
      where: { code },
      update: { name: meta.name, examDay: meta.examDay, prcWeightPercent: meta.weight, isActive: true },
      create: { code, name: meta.name, examDay: meta.examDay, prcWeightPercent: meta.weight, isActive: true, sortOrder: ALL_PKGS.indexOf(code) },
    });

    // ── Topics + generic subtopics ────────────────────────────────────────────
    const topicsRaw = readJson(`${dir}/topics.json`).records as any[];
    const topicCodeByOrig = new Map<string, string>();
    const subtopicCodeByOrig = new Map<string, string>();
    const topicIdByCode = new Map<string, string>();
    for (let i = 0; i < topicsRaw.length; i++) {
      const t = topicsRaw[i];
      const tCode = `${code}-${String(i + 1).padStart(3, '0')}`;
      const row = await prisma.topic.upsert({
        where: { code: tCode },
        update: { name: t.title, subjectId: subject.id, sortOrder: i + 1 },
        create: { code: tCode, name: t.title, subjectId: subject.id, sortOrder: i + 1 },
      });
      await prisma.subtopic.upsert({
        where: { code: `${tCode}-G` },
        update: { name: 'General', topicId: row.id },
        create: { code: `${tCode}-G`, name: 'General', topicId: row.id, keywords: [] },
      });
      topicCodeByOrig.set(t.id, tCode);
      subtopicCodeByOrig.set(t.id, `${tCode}-G`);
      topicIdByCode.set(tCode, row.id);
      T.topics++;
    }
    log(`topics: ${topicsRaw.length}`);

    const firstTopicCode = topicCodeByOrig.size > 0 ? [...topicCodeByOrig.values()][0]! : `${code}-001`;

    // ── Concepts ──────────────────────────────────────────────────────────────
    const concepts = (readJson(`${dir}/concepts.json`).records as any[]).map((r) => ({
      publicId: r.concept_id, subjectCode: code, topicCode: topicCodeByOrig.get(r.topic_id),
      title: r.name, body: r.definition || r.name, keywords: r.category ? [r.category] : [],
    }));
    if (concepts.length) {
      const rpt = await retryable('concepts', () => sync.sync(SYNC_CONFIGS['concepts'], concepts, { atomic: false, actorId: ADMIN_USER_ID }));
      T.concepts += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`concepts: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    // ── Engineering notes / tips / misconceptions / review notes ──────────────
    const notes = (readJson(`${dir}/engineering-notes.json`).records as any[]).map((r) => ({
      publicId: r.note_id, subjectCode: code, topicCode: topicCodeByOrig.get(r.topic_id),
      title: (r.category_note || String(r.text).slice(0, 60)), body: r.text, tags: r.category_note ? [r.category_note] : [],
    }));
    if (notes.length) {
      const rpt = await retryable('notes', () => sync.sync(SYNC_CONFIGS['engineering-notes'], notes, { atomic: false, actorId: ADMIN_USER_ID }));
      T.notes += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`notes: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    const tips = (readJson(`${dir}/engineering-tips.json`).records as any[]).map((r) => ({
      publicId: r.tip_id, subjectCode: code, title: String(r.text).slice(0, 60), tip: r.text,
    }));
    if (tips.length) {
      const rpt = await retryable('tips', () => sync.sync(SYNC_CONFIGS['engineering-tips'], tips, { atomic: false, actorId: ADMIN_USER_ID }));
      T.tips += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`tips: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    const topicSeqOf = (origTopicId: string) => {
      const c = topicCodeByOrig.get(origTopicId);
      return c ? Number(c.split('-')[1]) : 1;
    };
    const misconceptions = (readJson(`${dir}/misconceptions.json`).records as any[]).map((r, i) => ({
      publicId: r.misconception_id, subjectCode: code,
      topicCode: String(topicSeqOf(r.topic_id)).padStart(3, '0'),
      subtopicCode: '001', category: 'GEN', sequenceNumber: (i % 999) + 1,
      title: String(r.text).slice(0, 60), description: r.text,
    }));
    if (misconceptions.length) {
      const rpt = await retryable('misconceptions', () => sync.sync(SYNC_CONFIGS['misconceptions'], misconceptions, { atomic: false, actorId: ADMIN_USER_ID }));
      T.misconceptions += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`misconceptions: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    const reviewNotes = (readJson(`${dir}/review-notes.json`).records as any[]).map((r) => ({
      publicId: r.review_note_id ?? r.review_id, subjectCode: code, topicCode: topicCodeByOrig.get(r.topic_id),
      title: r.title,
      body: [
        Array.isArray(r.learning_objectives) ? `Learning Objectives:\n${r.learning_objectives.join('\n')}` : '',
        Array.isArray(r.core_concepts) ? `Core Concepts:\n${r.core_concepts.join('\n')}` : '',
        Array.isArray(r.board_strategies) ? `Board Strategies:\n${r.board_strategies.join('\n')}` : '',
      ].filter(Boolean).join('\n\n') || r.title,
    }));
    if (reviewNotes.length) {
      const rpt = await retryable('review-notes', () => sync.sync(SYNC_CONFIGS['review-notes'], reviewNotes, { atomic: false, actorId: ADMIN_USER_ID }));
      T.reviewNotes += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`review-notes: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    // ── Flashcards ────────────────────────────────────────────────────────────
    const flashcards = (readJson(`${dir}/flashcards.json`).records as any[]).map((r) => ({
      publicId: r.flashcard_id, subjectCode: code, topicCode: topicCodeByOrig.get(r.topic_id),
      front: r.front, back: r.back || 'See the Formula Library for the full expression.', tags: r.tags ?? [],
    }));
    for (let i = 0; i < flashcards.length; i += 1000) {
      const batch = flashcards.slice(i, i + 1000);
      const rpt = await retryable('flashcards', () => sync.sync(SYNC_CONFIGS['flashcards'], batch, { atomic: false, actorId: ADMIN_USER_ID }));
      T.flashcards += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`flashcards [${i}-${i + batch.length}]: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    // ── Diagrams (standalone pool) ────────────────────────────────────────────
    const diagramsRaw = (readJson(`${dir}/diagrams.json`).records as any[]).filter((r) => r.svg_markup?.length > 0);
    const diagrams = diagramsRaw.map((r) => ({
      publicId: r.diagram_id, subjectCode: code, topicCode: topicCodeByOrig.get(r.topic_id),
      title: r.title, description: r.figure_description ?? null, imageUrl: svgToDataUri(r.svg_markup),
      altText: r.title, diagramType: r.type ?? null,
    }));
    for (let i = 0; i < diagrams.length; i += 300) {
      const batch = diagrams.slice(i, i + 300);
      const rpt = await retryable('diagrams', () => sync.sync(SYNC_CONFIGS['diagrams'], batch, { atomic: false, actorId: ADMIN_USER_ID }));
      T.diagrams += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`diagrams [${i}-${i + batch.length}]: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    // ── Formulas ──────────────────────────────────────────────────────────────
    const formulasRaw = readJson(`${dir}/formulas.json`).records as any[];
    const formulaSlugByOrigId = new Map<string, string>();
    const formulaItems = formulasRaw.map((r) => {
      const name = `${code}: ${r.name}`.slice(0, 200);
      formulaSlugByOrigId.set(r.formula_id, slugify(name));
      const variables = r.variables && typeof r.variables === 'object'
        ? Object.entries(r.variables).map(([symbol, desc]) => ({ symbol, name: String(desc).slice(0, 200) }))
        : [];
      return {
        subjectCode: code, name,
        expressionText: r.formula || name, expressionLatex: r.formula || name,
        variables, derivation: r.derivation || undefined,
        assumptions: Array.isArray(r.assumptions)
          ? r.assumptions.slice(0, 20).map((a: unknown) => typeof a === 'string' ? a : Object.entries(a as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join('; '))
          : [],
        limitations: Array.isArray(r.limitations) ? r.limitations.join('; ').slice(0, 2000) : (r.limitations || undefined),
        exampleProblem: r.engineering_interpretation || undefined,
      };
    });
    for (let i = 0; i < formulaItems.length; i += 500) {
      const batch = formulaItems.slice(i, i + 500);
      const rpt = await retryable('formulas', () => formulaSvc.bulkSync(batch as never));
      T.formulas += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`formulas [${i}-${i + batch.length}]: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    // ── Learning objectives ───────────────────────────────────────────────────
    const losRaw = readJson(`${dir}/learning-objectives.json`).records as any[];
    const loSeq = new Map<string, number>();
    const loItems = losRaw.map((r) => {
      const topicSeq = topicSeqOf(r.topic_id);
      const n = (loSeq.get(String(topicSeq)) ?? 0) + 1;
      loSeq.set(String(topicSeq), n);
      return { subjectCode: code, topicCode: topicSeq, subtopicCode: 1, sequenceNumber: n, statement: r.text ?? r.statement, subjectId: subject.id };
    });
    for (let i = 0; i < loItems.length; i += 1000) {
      const batch = loItems.slice(i, i + 1000);
      const rpt = await retryable('LOs', () => loSvc.bulkSync(batch as never, { id: ADMIN_USER_ID } as never));
      T.los += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`LOs [${i}-${i + batch.length}]: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    const difficultyMap: Record<string, string> = { foundational: 'foundational', intermediate: 'intermediate', advanced: 'advanced' };
    const buildQuestion = (r: any, questionCode: string) => {
      const topicCode = topicCodeByOrig.get(r.topic_id) ?? firstTopicCode;
      const subtopicCode = subtopicCodeByOrig.get(r.topic_id) ?? `${topicCode}-G`;
      const choices = Object.entries(r.choices ?? {}).map(([letter, text]) => ({ letter, text: String(text) }));
      const formulaSlugs = Array.isArray(r.formula_used)
        ? r.formula_used.map((fid: string) => formulaSlugByOrigId.get(fid)).filter(Boolean)
        : [];
      const notesJoined = [r.engineering_notes, r.ai_tutor_explanation].filter(Boolean).join('\n\nAI Tutor: ');
      return {
        questionCode, subjectCode: code, topicCode, subtopicCode,
        difficultyCode: difficultyMap[r.difficulty] ?? 'foundational',
        stemText: r.question, choices, correctChoice: r.correct_answer,
        explanationText: r.detailed_explanation || (Array.isArray(r.solution_steps) ? r.solution_steps.join(' ') : 'See solution steps.'),
        estSolvingTimeSec: Math.round((r.estimated_solving_time_min ?? 3) * 60),
        formulaSlugs,
        intelligence: notesJoined ? { engineeringNotes: notesJoined.slice(0, 8000), commonMistakes: Array.isArray(r.common_mistakes) ? r.common_mistakes.slice(0, 20) : undefined } : undefined,
      };
    };

    // ── Questions + their embedded figures ────────────────────────────────────
    const questionsRaw = readJson(`${dir}/questions.json`).records as any[];
    const qCodeOf = codeFactory(questionsRaw.map((r) => r.question_id));

    const figureItems = questionsRaw
      .filter((r) => typeof r.figure?.svg_markup === 'string' && r.figure.svg_markup.length > 0)
      .map((r) => ({
        publicId: `FIG.${qCodeOf(r.question_id).replace(/-/g, '.')}`,
        subjectCode: code,
        title: (r.figure.title || `Figure for ${r.question_id}`).slice(0, 300),
        description: r.figure.description || null,
        imageUrl: svgToDataUri(r.figure.svg_markup),
        altText: (r.figure.title || r.figure.description || `Figure for ${r.question_id}`).slice(0, 500),
        diagramType: 'question-figure',
      }));
    for (let i = 0; i < figureItems.length; i += 300) {
      const batch = figureItems.slice(i, i + 300);
      const rpt = await retryable('question-figures', () => sync.sync(SYNC_CONFIGS['diagrams'], batch, { atomic: false, actorId: ADMIN_USER_ID }));
      T.figures += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`question-figures [${i}-${i + batch.length}]: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
    }

    const questionItems = questionsRaw.map((r) => buildQuestion(r, qCodeOf(r.question_id)));
    for (let i = 0; i < questionItems.length; i += 250) {
      const batch = questionItems.slice(i, i + 250);
      const rpt = await retryable('questions', () => qSync.sync(batch, { atomic: false, user: { id: ADMIN_USER_ID } as never }));
      T.questions += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      log(`questions [${i}-${i + batch.length}]: ${rpt.created}+${rpt.updated}, err ${rpt.errors.length}`);
      if (rpt.errors.length) log('  sample:', rpt.errors.slice(0, 2));
    }

    // ── Situational sets (shared scenario + linked sub-questions) ─────────────
    const sitRaw = readJson(`${dir}/situational-sets.json`).records as any[];
    for (const s of sitRaw) {
      const figPublicId = typeof s.figure?.svg_markup === 'string' && s.figure.svg_markup.length > 0
        ? `FIG.${toCode(s.situation_id, 60).replace(/-/g, '.')}` : null;
      if (figPublicId) {
        const rpt = await sync.sync(SYNC_CONFIGS['diagrams'], [{
          publicId: figPublicId, subjectCode: code,
          title: (s.figure.title || `Figure for ${s.situation_id}`).slice(0, 300),
          description: s.figure.description || null,
          imageUrl: svgToDataUri(s.figure.svg_markup),
          altText: (s.figure.title || `Figure for ${s.situation_id}`).slice(0, 500),
          diagramType: 'situation-figure',
        }], { atomic: false, actorId: ADMIN_USER_ID });
        T.figures += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      }

      const tCode = topicCodeByOrig.get(s.topic_id);
      const situation = await prisma.situation.upsert({
        where: { publicId: s.situation_id },
        update: {
          situationText: s.situation_text, givenData: s.given_data ?? undefined,
          figurePublicId: figPublicId, prcPaper: s.prc_paper ?? null, category: s.category ?? null,
        },
        create: {
          publicId: s.situation_id, subjectId: subject.id,
          topicId: tCode ? topicIdByCode.get(tCode) ?? null : null,
          situationText: s.situation_text, givenData: s.given_data ?? undefined,
          figurePublicId: figPublicId, prcPaper: s.prc_paper ?? null, category: s.category ?? null,
          sourceProject: 'kl-v2.6',
        },
      });
      T.situations++;

      const subQ = (s.questions as any[]).map((r) => buildQuestion(r, toCode(r.question_id, 30)));
      const rpt = await retryable('situational-q', () => qSync.sync(subQ, { atomic: false, user: { id: ADMIN_USER_ID } as never }));
      T.situationalQ += rpt.created + rpt.updated; T.errors += rpt.errors.length;
      if (rpt.errors.length) log(`  ${s.situation_id} errors:`, rpt.errors.slice(0, 2));

      let order = 0;
      for (const r of s.questions as any[]) {
        order++;
        await prisma.question.updateMany({
          where: { questionCode: toCode(r.question_id, 30) },
          data: { situationId: situation.id, situationOrder: order },
        });
      }
    }
    log(`situational: ${sitRaw.length} sets`);
  }

  // ── Verify ─────────────────────────────────────────────────────────────────
  log('\n=== VERIFY ===');
  const counts = {
    questions: await prisma.question.count({ where: { subject: { code: { in: ALL_PKGS } }, deletedAt: null } }),
    situations: await prisma.situation.count(),
    linkedQuestions: await prisma.question.count({ where: { situationId: { not: null } } }),
    flashcards: await prisma.flashcard.count({ where: { isActive: true } }),
    concepts: await prisma.concept.count(),
    formulas: await prisma.formulaLibrary.count(),
    diagrams: await prisma.diagram.count(),
    learningObjectives: await prisma.learningObjective.count(),
    boardForms: await prisma.examTemplate.count({ where: { code: { startsWith: 'CE-PRCFORM-' } } }),
  };
  log('totals:', JSON.stringify(T));
  log('production counts:', JSON.stringify(counts));
  log('=== v2.6 IMPORT COMPLETE ===');
  await app.close();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
