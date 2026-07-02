/**
 * @file kb-migrate.ts — Full 13-subject Knowledge Library taxonomy migration.
 *
 * One-off production migration script (Sprint "Beta content sync"). Retires
 * the legacy 8-subject PRC-cluster taxonomy and replaces it with the new
 * 13-subject Knowledge Library taxonomy delivered in _Exports/Full 2026.07.01.
 *
 * Reuses the real NestJS services (ContentSyncService, QuestionSyncService,
 * FormulaService, LearningObjectiveService) via an application context so
 * every write goes through the same validation/versioning/idempotency logic
 * as the admin UI — this is not a raw-SQL bypass.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/kb-migrate.ts
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
const ADMIN_USER_ID = '490885ef-97a3-45bc-afea-f8cbd3412360'; // super_admin, for audit trail only

const PACKAGES = [
  { dir: 'STR', code: 'STR', name: 'Structural Engineering', examDay: 1, weight: 20 },
  { dir: 'SOM', code: 'SOM', name: 'Mechanics of Deformable Bodies', examDay: 1, weight: 10 },
  { dir: 'EM', code: 'EM', name: 'Engineering Mechanics', examDay: 1, weight: 10 },
  { dir: 'CEM', code: 'CEM', name: 'Construction Engineering and Management', examDay: 2, weight: 8 },
  { dir: 'GEO', code: 'GEO', name: 'Geotechnical Engineering', examDay: 1, weight: 10 },
  { dir: 'HYD', code: 'HYD', name: 'Fluid Mechanics and Hydraulics', examDay: 1, weight: 10 },
  { dir: 'WRE', code: 'WRE', name: 'Hydrology and Water Resources', examDay: 2, weight: 5 },
  { dir: 'MATH', code: 'MATH', name: 'Engineering Mathematics', examDay: 1, weight: 20 },
  { dir: 'SUR', code: 'SUR', name: 'Surveying and Geomatics', examDay: 1, weight: 10 },
  { dir: 'TRA', code: 'TRA', name: 'Transportation Engineering', examDay: 2, weight: 8 },
  { dir: 'ECO', code: 'ECO', name: 'Engineering Economics', examDay: 2, weight: 5 },
  { dir: 'ENV', code: 'ENV', name: 'Environmental Engineering', examDay: 2, weight: 8 },
  { dir: 'LAW', code: 'LAW', name: 'Engineering Laws and Ethics', examDay: 2, weight: 8 },
];

const LEGACY_CODES = ['MATH', 'HGE', 'STRUC', 'SURV', 'TRANSP', 'SANIT', 'ETHICS', 'GCE'];

function readJson(dir: string, file: string): any {
  const p = path.join(EXPORT_ROOT, dir, file);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
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
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const sync = app.get(ContentSyncService);
  const qSync = app.get(QuestionSyncService);
  const formulaSvc = app.get(FormulaService);
  const loSvc = app.get(LearningObjectiveService);

  // This environment has no reachable Redis. The underlying keyv-redis client
  // has no command timeout, so cache.get/set queue forever while it retries
  // the connection in the background — every cache-touching write in the
  // import path (e.g. QuestionService via QuestionSearchService) hangs
  // indefinitely rather than the try/catch in CacheService ever firing.
  // Stub the shared CacheService instance to no-ops for this one-off script
  // only; the real service/admin UI is untouched.
  const cacheSvc = app.get(CacheService);
  cacheSvc.get = async () => null;
  cacheSvc.set = async () => undefined;
  cacheSvc.del = async () => undefined;
  cacheSvc.invalidatePattern = async () => undefined;
  cacheSvc.remember = (async (_key: string, _ttl: number, factory: () => Promise<unknown>) => factory()) as never;

  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

  // ── Phase 0: retire legacy taxonomy ─────────────────────────────────────────
  log('=== Phase 0: retiring legacy taxonomy ===');
  // Free the 'MATH' code before the new MATH subject is created. Idempotent:
  // only rename if a genuinely-legacy MATH row still holds that code (i.e.
  // its name isn't already the new taxonomy's "Engineering Mathematics").
  const legacyMath = await prisma.subject.findUnique({ where: { code: 'MATH' } });
  if (legacyMath && legacyMath.name !== 'Engineering Mathematics') {
    await prisma.subject.update({ where: { code: 'MATH' }, data: { code: 'MATH_LEGACY', isActive: false } });
  }
  await prisma.subject.updateMany({ where: { code: { in: LEGACY_CODES.filter((c) => c !== 'MATH') } }, data: { isActive: false } });
  log('legacy subjects retired (isActive=false, MATH renamed to MATH_LEGACY)');

  // ── Phase 1: create the 13 new subjects ─────────────────────────────────────
  log('=== Phase 1: creating new subjects ===');
  const subjectIdByCode = new Map<string, string>();
  for (let i = 0; i < PACKAGES.length; i++) {
    const p = PACKAGES[i];
    const row = await prisma.subject.upsert({
      where: { code: p.code },
      update: { name: p.name, examDay: p.examDay, prcWeightPercent: p.weight, isActive: true, sortOrder: i },
      create: { code: p.code, name: p.name, examDay: p.examDay, prcWeightPercent: p.weight, isActive: true, sortOrder: i },
    });
    subjectIdByCode.set(p.code, row.id);
    log(`subject ${p.code} -> ${row.id}`);
  }

  // ── Per-subject import ───────────────────────────────────────────────────────
  for (const pkg of PACKAGES) {
    log(`\n=== ${pkg.code} (${pkg.name}) ===`);
    const subjectId = subjectIdByCode.get(pkg.code)!;

    // Topics + one generic Subtopic per Topic.
    const topicsRaw = readJson(pkg.dir, 'topics.json').records as any[];
    const topicIdByOrig = new Map<string, string>(); // orig dotted id -> UUID
    const topicCodeByOrig = new Map<string, string>(); // orig dotted id -> short code
    const subtopicCodeByOrig = new Map<string, string>(); // orig dotted id -> generic subtopic code
    let topicIdx = 0;
    for (const t of topicsRaw) {
      topicIdx++;
      const code = `${pkg.code}-${String(topicIdx).padStart(3, '0')}`;
      const row = await prisma.topic.upsert({
        where: { code },
        update: { name: t.title, subjectId, sortOrder: topicIdx },
        create: { code, name: t.title, subjectId, sortOrder: topicIdx },
      });
      topicIdByOrig.set(t.id, row.id);
      topicCodeByOrig.set(t.id, code);
      const subCode = `${code}-G`;
      await prisma.subtopic.upsert({
        where: { code: subCode },
        update: { name: 'General', topicId: row.id },
        create: { code: subCode, name: 'General', topicId: row.id, keywords: [] },
      });
      subtopicCodeByOrig.set(t.id, subCode);
    }
    log(`topics: ${topicsRaw.length} upserted`);

    // Concepts
    const concepts = (readJson(pkg.dir, 'concepts.json').records as any[]).map((r) => ({
      publicId: r.concept_id, subjectCode: pkg.code, topicCode: topicCodeByOrig.get(r.topic_id),
      title: r.name, body: r.definition || r.name, keywords: r.category ? [r.category] : [],
    }));
    if (concepts.length) {
      const rpt = await sync.sync(SYNC_CONFIGS['concepts'], concepts, { atomic: false, actorId: ADMIN_USER_ID });
      log(`concepts: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
      if (rpt.errors.length) log('concept errors sample:', rpt.errors.slice(0, 3));
    }

    // Engineering notes (no title in source — synthesize).
    const notes = (readJson(pkg.dir, 'engineering-notes.json').records as any[]).map((r) => ({
      publicId: r.note_id, subjectCode: pkg.code, topicCode: topicCodeByOrig.get(r.topic_id),
      title: (r.category_note || r.text.slice(0, 60)), body: r.text, tags: r.category_note ? [r.category_note] : [],
    }));
    if (notes.length) {
      const rpt = await sync.sync(SYNC_CONFIGS['engineering-notes'], notes, { atomic: false, actorId: ADMIN_USER_ID });
      log(`engineering-notes: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
    }

    // Engineering tips (no title/category in source — synthesize).
    const tips = (readJson(pkg.dir, 'engineering-tips.json').records as any[]).map((r) => ({
      publicId: r.tip_id, subjectCode: pkg.code, title: r.text.slice(0, 60), tip: r.text,
    }));
    if (tips.length) {
      const rpt = await sync.sync(SYNC_CONFIGS['engineering-tips'], tips, { atomic: false, actorId: ADMIN_USER_ID });
      log(`engineering-tips: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
    }

    // Diagrams — only where svg_markup is non-empty (pure-SVG-complete subjects).
    const diagramsRaw = (readJson(pkg.dir, 'diagrams.json').records as any[]).filter((r) => r.svg_markup && r.svg_markup.length > 0);
    const diagrams = diagramsRaw.map((r) => ({
      publicId: r.diagram_id, subjectCode: pkg.code, topicCode: topicCodeByOrig.get(r.topic_id),
      title: r.title, description: r.figure_description ?? null, imageUrl: svgToDataUri(r.svg_markup),
      altText: r.title, diagramType: r.type ?? null,
    }));
    if (diagrams.length) {
      const rpt = await sync.sync(SYNC_CONFIGS['diagrams'], diagrams, { atomic: false, actorId: ADMIN_USER_ID });
      log(`diagrams: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors (${diagramsRaw.length}/${readJson(pkg.dir, 'diagrams.json').records.length} had svg_markup)`);
    } else {
      log(`diagrams: 0 imported (no svg_markup yet for this subject — svg_spec pending retrofit per HANDOFF-REPORT)`);
    }

    // Misconceptions (title synthesized; topicCode/subtopicCode/category capped at 3 chars).
    const misconceptions = (readJson(pkg.dir, 'misconceptions.json').records as any[]).map((r, i) => ({
      publicId: r.misconception_id, subjectCode: pkg.code,
      topicCode: String((topicIdx && topicCodeByOrig.has(r.topic_id)) ? [...topicCodeByOrig.keys()].indexOf(r.topic_id) + 1 : 1).padStart(3, '0'),
      subtopicCode: '001', category: 'GEN', sequenceNumber: (i % 999) + 1,
      title: r.text.slice(0, 60), description: r.text,
    }));
    if (misconceptions.length) {
      const rpt = await sync.sync(SYNC_CONFIGS['misconceptions'], misconceptions, { atomic: false, actorId: ADMIN_USER_ID });
      log(`misconceptions: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
      if (rpt.errors.length) log('misconception errors sample:', rpt.errors.slice(0, 3));
    }

    // Review notes (assemble body from sections).
    const reviewNotes = (readJson(pkg.dir, 'review-notes.json').records as any[]).map((r) => ({
      publicId: r.review_id, subjectCode: pkg.code, topicCode: topicCodeByOrig.get(r.topic_id),
      title: r.title,
      body: [
        Array.isArray(r.learning_objectives) ? `Learning Objectives:\n${r.learning_objectives.join('\n')}` : '',
        Array.isArray(r.core_concepts) ? `Core Concepts:\n${r.core_concepts.join('\n')}` : '',
        Array.isArray(r.board_strategies) ? `Board Strategies:\n${r.board_strategies.join('\n')}` : '',
      ].filter(Boolean).join('\n\n') || r.title,
    }));
    if (reviewNotes.length) {
      const rpt = await sync.sync(SYNC_CONFIGS['review-notes'], reviewNotes, { atomic: false, actorId: ADMIN_USER_ID });
      log(`review-notes: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
    }

    // Flashcards
    const flashcards = (readJson(pkg.dir, 'flashcards.json').records as any[]).map((r) => ({
      publicId: r.flashcard_id, subjectCode: pkg.code, topicCode: topicCodeByOrig.get(r.topic_id),
      front: r.front, back: r.back, tags: r.tags ?? [],
    }));
    if (flashcards.length) {
      const rpt = await sync.sync(SYNC_CONFIGS['flashcards'], flashcards, { atomic: false, actorId: ADMIN_USER_ID });
      log(`flashcards: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
    }

    // NOTE: tutor-prompts.json is deliberately NOT imported into the
    // TutorPrompt table — its records are per-question AI Tutor grounding
    // (question_id/tutor_explanation), not generic reusable system prompts,
    // which is what TutorPrompt models. That data is instead captured via
    // each question's own `ai_tutor_explanation` field below (folded into
    // Question.intelligence.engineeringNotes), the mechanism AI Tutor
    // grounding actually reads from.

    // Formulas (name prefixed with subject code for global-uniqueness; slug
    // is deterministic so questions can reference it via formulaSlugs).
    const formulasRaw = readJson(pkg.dir, 'formulas.json').records as any[];
    const formulaSlugByOrigId = new Map<string, string>();
    const formulaItems = formulasRaw.map((r) => {
      const name = `${pkg.code}: ${r.name}`.slice(0, 200);
      formulaSlugByOrigId.set(r.formula_id, slugify(name));
      const variables = r.variables && typeof r.variables === 'object'
        ? Object.entries(r.variables).map(([symbol, desc]) => ({ symbol, name: String(desc).slice(0, 200) }))
        : [];
      return {
        subjectCode: pkg.code, name,
        expressionText: r.formula || name, expressionLatex: r.formula || name,
        variables, derivation: r.derivation || undefined,
        assumptions: Array.isArray(r.assumptions) ? r.assumptions.slice(0, 20) : [],
        limitations: Array.isArray(r.limitations) ? r.limitations.join('; ').slice(0, 2000) : (r.limitations || undefined),
        exampleProblem: r.engineering_interpretation || undefined,
      };
    });
    if (formulaItems.length) {
      // bulkSync processes in batches of up to 1000 per its own schema max.
      for (let i = 0; i < formulaItems.length; i += 500) {
        const batch = formulaItems.slice(i, i + 500);
        const rpt = await formulaSvc.bulkSync(batch as never);
        log(`formulas [${i}-${i + batch.length}]: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
        if (rpt.errors.length) log('formula errors sample:', rpt.errors.slice(0, 3));
      }
    }

    // Learning objectives (topicCode/subtopicCode are numeric sequence slots, not real codes).
    const losRaw = readJson(pkg.dir, 'learning-objectives.json').records as any[];
    const loByTopicSeq = new Map<string, number>();
    const loItems = losRaw.map((r) => {
      const topicSeq = [...topicCodeByOrig.keys()].indexOf(r.topic_id) + 1 || 1;
      const seqKey = String(topicSeq);
      const seqNum = (loByTopicSeq.get(seqKey) ?? 0) + 1;
      loByTopicSeq.set(seqKey, seqNum);
      return { subjectCode: pkg.code, topicCode: topicSeq, subtopicCode: 1, sequenceNumber: seqNum, statement: r.text, subjectId };
    });
    if (loItems.length) {
      for (let i = 0; i < loItems.length; i += 1000) {
        const batch = loItems.slice(i, i + 1000);
        const rpt = await loSvc.bulkSync(batch as never, { id: ADMIN_USER_ID } as never);
        log(`learning-objectives [${i}-${i + batch.length}]: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
        if (rpt.errors.length) log('LO errors sample:', rpt.errors.slice(0, 3));
      }
    }

    // Questions — must run after topics/subtopics/formulas/diagrams exist.
    const questionsRaw = readJson(pkg.dir, 'questions.json').records as any[];
    const difficultyMap: Record<string, string> = { foundational: 'foundational', intermediate: 'intermediate', advanced: 'advanced' };
    let qIdx = 0;
    const questionItems = questionsRaw.map((r) => {
      qIdx++;
      const topicCode = topicCodeByOrig.get(r.topic_id) ?? `${pkg.code}-001`;
      const subtopicCode = subtopicCodeByOrig.get(r.topic_id) ?? `${topicCode}-G`;
      const choices = Object.entries(r.choices ?? {}).map(([letter, text]) => ({ letter, text: String(text) }));
      const formulaSlugs = Array.isArray(r.formula_used)
        ? r.formula_used.map((fid: string) => formulaSlugByOrigId.get(fid)).filter(Boolean)
        : [];
      const intelligenceNotes = [r.engineering_notes, r.ai_tutor_explanation].filter(Boolean).join('\n\nAI Tutor: ');
      return {
        questionCode: toCode(r.question_id, 30),
        subjectCode: pkg.code, topicCode, subtopicCode,
        difficultyCode: difficultyMap[r.difficulty] ?? 'foundational',
        stemText: r.question, choices, correctChoice: r.correct_answer,
        explanationText: r.detailed_explanation || (Array.isArray(r.solution_steps) ? r.solution_steps.join(' ') : 'See solution steps.'),
        estSolvingTimeSec: Math.round((r.estimated_solving_time_min ?? 2) * 60),
        formulaSlugs,
        intelligence: intelligenceNotes ? { engineeringNotes: intelligenceNotes.slice(0, 8000), commonMistakes: Array.isArray(r.common_mistakes) ? r.common_mistakes.slice(0, 20) : undefined } : undefined,
      };
    });
    if (questionItems.length) {
      const rpt = await qSync.sync(questionItems, { atomic: false, user: { id: ADMIN_USER_ID } as never });
      log(`questions: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
      if (rpt.errors.length) log('question errors sample:', rpt.errors.slice(0, 5));
    }

    // Mock exam templates.
    const templatesRaw = readJson(pkg.dir, 'mock-exam-templates.json').records as any[];
    const templates = templatesRaw.map((r) => ({
      code: toCode(r.template_id, 50), name: r.title, description: r.description ?? null,
      kind: 'subject', durationMinutes: Math.max(15, Math.round((r.total_items ?? 20) * 4.7)),
      passingScore: 70, randomizeQuestions: true, randomizeChoices: true,
      composition: [{ subjectId, count: r.total_items ?? 20 }],
    }));
    if (templates.length) {
      const rpt = await sync.sync(SYNC_CONFIGS['mock-exam-templates'], templates, { atomic: false, actorId: ADMIN_USER_ID });
      log(`mock-exam-templates: ${rpt.created}+${rpt.updated} ok, ${rpt.errors.length} errors`);
      if (rpt.errors.length) log('template errors sample:', rpt.errors.slice(0, 3));
    }
  }

  log('\n=== MIGRATION COMPLETE ===');
  await app.close();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
