/**
 * @file kb-sync-situational.ts — Situational Question Library v1.0 import.
 *
 * Additive import of per-subject situational-sets.json (100 situations, 300
 * linked questions, 62 situation figures). Existing Question Bank rows are
 * NOT modified; nothing is regenerated. Idempotent: situations upsert by
 * publicId, questions upsert by questionCode through QuestionSyncService,
 * figures upsert by diagram publicId. Linkage (situationId/situationOrder)
 * is re-applied on every run.
 *
 * Run (from apps/api):
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/kb-sync-situational.ts
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ContentSyncService } from '../src/content-sync/content-sync.service';
import { QuestionSyncService } from '../src/content-sync/question-sync.service';
import { SYNC_CONFIGS } from '../src/content-sync/content-sync.registry';
import { CacheService } from '../src/cache/cache.service';

const EXPORT_ROOT = 'C:\\Users\\Gavino Family\\Claude\\Projects\\CE Board Master\\_Exports\\The Ultimate';
const ADMIN_USER_ID = '490885ef-97a3-45bc-afea-f8cbd3412360';
const PKGS = ['STR', 'SOM', 'EM', 'CEM', 'GEO', 'HYD', 'WRE', 'MATH', 'SUR', 'TRA', 'ECO', 'ENV', 'LAW'];

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

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const sync = app.get(ContentSyncService);
  const qSync = app.get(QuestionSyncService);

  const cacheSvc = app.get(CacheService);
  cacheSvc.get = async () => null;
  cacheSvc.set = async () => undefined;
  cacheSvc.del = async () => undefined;
  cacheSvc.invalidatePattern = async () => undefined;
  cacheSvc.remember = (async (_k: string, _t: number, f: () => Promise<unknown>) => f()) as never;

  const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
  const totals = { situations: 0, questions: 0, figures: 0, linked: 0, errors: 0 };

  for (const code of PKGS) {
    const file = path.join(EXPORT_ROOT, code, 'situational-sets.json');
    if (!fs.existsSync(file)) { log(`${code}: no situational-sets.json — skipped`); continue; }
    const pack = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const records = pack.records as any[];
    const subject = await prisma.subject.findUnique({ where: { code } });
    if (!subject) { log(`!! subject ${code} missing`); process.exit(1); }

    // Topic code map — index-ordered, identical to kb-migrate.
    const topicsRaw = readJson(`${code}/topics.json`).records as any[];
    const topicCodeByOrig = new Map<string, string>();
    const subtopicCodeByOrig = new Map<string, string>();
    const topicIdByCode = new Map<string, string>();
    topicsRaw.forEach((t, i) => {
      const tCode = `${code}-${String(i + 1).padStart(3, '0')}`;
      topicCodeByOrig.set(t.id, tCode);
      subtopicCodeByOrig.set(t.id, `${tCode}-G`);
    });
    for (const t of await prisma.topic.findMany({ where: { subjectId: subject.id }, select: { id: true, code: true } })) {
      topicIdByCode.set(t.code, t.id);
    }

    // Formula slug map for formula_used links.
    const formulasRaw = readJson(`${code}/formulas.json`).records as any[];
    const formulaSlugByOrigId = new Map<string, string>();
    for (const r of formulasRaw) formulaSlugByOrigId.set(r.formula_id, slugify(`${code}: ${r.name}`.slice(0, 200)));

    const difficultyMap: Record<string, string> = { foundational: 'foundational', intermediate: 'intermediate', advanced: 'advanced' };

    for (const s of records) {
      // 1. Situation figure (62 have real SVGs) — diagram pool, stable id.
      const figPublicId = s.figure && typeof s.figure.svg_markup === 'string' && s.figure.svg_markup.length > 0
        ? `FIG.${toCode(s.situation_id, 60).replace(/-/g, '.')}`
        : null;
      if (figPublicId) {
        const rpt = await sync.sync(SYNC_CONFIGS['diagrams'], [{
          publicId: figPublicId, subjectCode: code,
          title: (s.figure.title || `Figure for ${s.situation_id}`).slice(0, 300),
          description: s.figure.description || null,
          imageUrl: svgToDataUri(s.figure.svg_markup),
          altText: (s.figure.title || `Figure for ${s.situation_id}`).slice(0, 500),
          diagramType: 'situation-figure',
        }], { atomic: false, actorId: ADMIN_USER_ID });
        totals.figures += rpt.created + rpt.updated; totals.errors += rpt.errors.length;
      }

      // 2. Situation row (upsert by publicId).
      const topicCode = topicCodeByOrig.get(s.topic_id);
      const situation = await prisma.situation.upsert({
        where: { publicId: s.situation_id },
        update: {
          situationText: s.situation_text, givenData: s.given_data ?? undefined,
          figurePublicId: figPublicId, prcPaper: s.prc_paper ?? null, category: s.category ?? null,
        },
        create: {
          publicId: s.situation_id, subjectId: subject.id,
          topicId: topicCode ? topicIdByCode.get(topicCode) ?? null : null,
          situationText: s.situation_text, givenData: s.given_data ?? undefined,
          figurePublicId: figPublicId, prcPaper: s.prc_paper ?? null, category: s.category ?? null,
          sourceProject: 'situational-library-v1',
        },
      });
      totals.situations++;

      // 3. Linked questions through the normal question pipeline.
      const questionItems = (s.questions as any[]).map((r) => {
        const qTopicCode = topicCodeByOrig.get(r.topic_id) ?? topicCode ?? `${code}-001`;
        const subtopicCode = subtopicCodeByOrig.get(r.topic_id) ?? `${qTopicCode}-G`;
        const choices = Object.entries(r.choices ?? {}).map(([letter, text]) => ({ letter, text: String(text) }));
        const formulaSlugs = Array.isArray(r.formula_used)
          ? r.formula_used.map((fid: string) => formulaSlugByOrigId.get(fid)).filter(Boolean)
          : [];
        const intelligenceNotes = [r.engineering_notes, r.ai_tutor_explanation].filter(Boolean).join('\n\nAI Tutor: ');
        return {
          questionCode: toCode(r.question_id, 30),
          subjectCode: code, topicCode: qTopicCode, subtopicCode,
          difficultyCode: difficultyMap[r.difficulty] ?? 'foundational',
          stemText: r.question, choices, correctChoice: r.correct_answer,
          explanationText: r.detailed_explanation || (Array.isArray(r.solution_steps) ? r.solution_steps.join(' ') : 'See solution steps.'),
          estSolvingTimeSec: Math.round((r.estimated_solving_time_min ?? 3) * 60),
          formulaSlugs,
          intelligence: intelligenceNotes ? { engineeringNotes: intelligenceNotes.slice(0, 8000), commonMistakes: Array.isArray(r.common_mistakes) ? r.common_mistakes.slice(0, 20) : undefined } : undefined,
        };
      });
      const rpt = await qSync.sync(questionItems, { atomic: false, user: { id: ADMIN_USER_ID } as never });
      totals.questions += rpt.created + rpt.updated; totals.errors += rpt.errors.length;
      if (rpt.errors.length) log(`${code} ${s.situation_id} question errors:`, rpt.errors.slice(0, 2));

      // 4. Link questions to the situation with their board order.
      let order = 0;
      for (const r of s.questions as any[]) {
        order++;
        const upd = await prisma.question.updateMany({
          where: { questionCode: toCode(r.question_id, 30) },
          data: { situationId: situation.id, situationOrder: order },
        });
        totals.linked += upd.count;
      }
    }
    log(`${code}: ${records.length} situations imported`);
  }

  log('\n=== VERIFY ===');
  const dbSituations = await prisma.situation.count();
  const dbLinked = await prisma.question.count({ where: { situationId: { not: null } } });
  const dbFigs = await prisma.diagram.count({ where: { diagramType: 'situation-figure' } });
  log(JSON.stringify({ dbSituations, dbLinkedQuestions: dbLinked, dbSituationFigures: dbFigs, totals }));
  log('=== SITUATIONAL IMPORT COMPLETE ===');
  await app.close();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
