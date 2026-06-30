/**
 * @file question-sync.service.ts — Knowledge Library → Question Bank adapter.
 *
 * Consumes code-based question exports (no internal UUIDs): resolves
 * subject/topic/subtopic/difficulty codes → IDs, links formulas by slug, checks
 * diagram/learning-objective references (relationship warnings), upserts by
 * questionCode (reusing the question bulk-import engine) and publishes. Returns a
 * SyncReport so the same Import Preview UI works for questions.
 */
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { QuestionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QuestionSearchService } from '../questions/services/question-search.service';
import type { CreateQuestionDto } from '../questions/dto/question.dto';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { SyncReport } from './content-sync.types';

const CHOICE = z.object({ letter: z.enum(['A', 'B', 'C', 'D']), text: z.string().trim().min(1).max(2000), latex: z.string().trim().max(4000).nullable().optional() });
const STATUS = ['draft', 'in_review', 'approved', 'published', 'deprecated', 'archived'] as const;

export const QuestionImportSchema = z.object({
  questionCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9\-]{3,30}$/),
  subjectCode: z.string().trim(),
  topicCode: z.string().trim(),
  subtopicCode: z.string().trim(),
  difficultyCode: z.string().trim(),
  stemText: z.string().trim().min(10).max(8000),
  stemLatex: z.string().trim().max(16000).nullable().optional(),
  choices: z.array(CHOICE).length(4),
  correctChoice: z.enum(['A', 'B', 'C', 'D']),
  explanationText: z.string().trim().min(10).max(8000),
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).default('apply'),
  questionType: z.enum(['multiple_choice', 'computation', 'diagram_based']).default('multiple_choice'),
  estSolvingTimeSec: z.coerce.number().int().min(5).max(3600).default(90),
  learningObjective: z.string().trim().max(80).nullable().optional(),
  prcSyllabusRef: z.string().trim().max(100).nullable().optional(),
  prcYearAppeared: z.array(z.coerce.number().int().min(1900).max(2100)).max(50).default([]),
  keywords: z.array(z.string().trim().max(50)).max(30).default([]),
  formulaSlugs: z.array(z.string().trim().max(100)).max(20).default([]),
  diagramPublicIds: z.array(z.string().trim().max(80)).max(20).default([]),
  intelligence: z.object({
    engineeringNotes: z.string().trim().max(8000).nullable().optional(),
    commonMistakes: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  }).optional(),
  status: z.enum(STATUS).default('published'),
});
export type QuestionImport = z.infer<typeof QuestionImportSchema>;

@Injectable()
export class QuestionSyncService {
  private readonly logger = new Logger(QuestionSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: QuestionSearchService,
  ) {}

  async count(): Promise<number> {
    return this.prisma.question.count({ where: { deletedAt: null } });
  }

  async sync(rawItems: unknown[], opts: { atomic: boolean; dryRun?: boolean; user: AuthenticatedUser }): Promise<SyncReport> {
    const started = Date.now();
    const dryRun = !!opts.dryRun;
    const errors: SyncReport['errors'] = [];
    const warnings: SyncReport['warnings'] = [];

    // Resolve maps once.
    const [subjects, topics, subtopics, difficulties, formulas, diagrams, los] = await Promise.all([
      this.prisma.subject.findMany({ select: { id: true, code: true } }),
      this.prisma.topic.findMany({ select: { id: true, code: true } }),
      this.prisma.subtopic.findMany({ select: { id: true, code: true } }),
      this.prisma.difficultyLevel.findMany({ select: { id: true, name: true, code: true } }),
      this.prisma.formulaLibrary.findMany({ select: { id: true, slug: true } }),
      this.prisma.diagram.findMany({ select: { publicId: true } }),
      this.prisma.learningObjective.findMany({ where: { deletedAt: null }, select: { publicId: true } }),
    ]);
    const subjMap = new Map(subjects.map((s) => [s.code.toUpperCase(), s.id]));
    const topicMap = new Map(topics.map((t) => [t.code.toUpperCase(), t.id]));
    const subMap = new Map(subtopics.map((s) => [s.code.toUpperCase(), s.id]));
    const diffMap = new Map<string, string>();
    for (const d of difficulties) { diffMap.set(d.name.toLowerCase(), d.id); diffMap.set(String(d.code), d.id); }
    const formulaMap = new Map(formulas.map((f) => [f.slug.toLowerCase(), f.id]));
    const diagramSet = new Set(diagrams.map((d) => d.publicId));
    const loSet = new Set(los.map((l) => l.publicId));

    const resolved: { item: QuestionImport; dto: CreateQuestionDto }[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const parsed = QuestionImportSchema.safeParse(rawItems[i]);
      if (!parsed.success) {
        errors.push({ index: i, publicId: (rawItems[i] as { questionCode?: string })?.questionCode ?? '', message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
        continue;
      }
      const q = parsed.data;
      const subjectId = subjMap.get(q.subjectCode.toUpperCase());
      const topicId = topicMap.get(q.topicCode.toUpperCase());
      const subtopicId = subMap.get(q.subtopicCode.toUpperCase());
      const difficultyLevelId = diffMap.get(q.difficultyCode.toLowerCase()) ?? diffMap.get(q.difficultyCode);
      const missing: string[] = [];
      if (!subjectId) missing.push(`subjectCode '${q.subjectCode}'`);
      if (!topicId) missing.push(`topicCode '${q.topicCode}'`);
      if (!subtopicId) missing.push(`subtopicCode '${q.subtopicCode}'`);
      if (!difficultyLevelId) missing.push(`difficultyCode '${q.difficultyCode}'`);
      if (missing.length) { errors.push({ index: i, publicId: q.questionCode, message: `Unresolved: ${missing.join(', ')}` }); continue; }

      // Relationship warnings (non-fatal).
      for (const slug of q.formulaSlugs) if (!formulaMap.has(slug.toLowerCase())) warnings.push({ index: i, publicId: q.questionCode, message: `formula slug '${slug}' not found` });
      for (const d of q.diagramPublicIds) if (!diagramSet.has(d)) warnings.push({ index: i, publicId: q.questionCode, message: `diagram '${d}' not found` });
      if (q.learningObjective && !loSet.has(q.learningObjective)) warnings.push({ index: i, publicId: q.questionCode, message: `learningObjective '${q.learningObjective}' not found` });

      resolved.push({ item: q, dto: {
        questionCode: q.questionCode, subjectId: subjectId!, topicId: topicId!, subtopicId: subtopicId!, difficultyLevelId: difficultyLevelId!,
        stemText: q.stemText, stemLatex: q.stemLatex ?? null, stemHtml: null,
        choices: q.choices.map((c) => ({ letter: c.letter, text: c.text, latex: c.latex ?? null, html: null, explanation: null })),
        correctChoice: q.correctChoice, explanationText: q.explanationText, explanationLatex: null, explanationHtml: null,
        bloomLevel: q.bloomLevel, questionType: q.questionType, learningObjective: q.learningObjective ?? null,
        prcSyllabusRef: q.prcSyllabusRef ?? null, prcYearAppeared: q.prcYearAppeared, estSolvingTimeSec: q.estSolvingTimeSec,
        language: 'en', keywords: q.keywords, tags: [], intelligence: q.intelligence, isAiGenerated: false,
      } as CreateQuestionDto });
    }

    if (opts.atomic && errors.length > 0) {
      return { kind: 'questions', dryRun, total: rawItems.length, created: 0, updated: 0, unchanged: 0, failed: errors.length, errors, warnings, durationMs: Date.now() - started };
    }

    // Dry-run: classify by existence (no writes).
    if (dryRun) {
      const codes = resolved.map((r) => r.dto.questionCode);
      const existing = await this.prisma.question.findMany({ where: { questionCode: { in: codes }, deletedAt: null }, select: { questionCode: true } });
      const existingSet = new Set(existing.map((e) => e.questionCode));
      let created = 0, updated = 0;
      for (const c of codes) { if (existingSet.has(c)) updated++; else created++; }
      return { kind: 'questions', dryRun: true, total: rawItems.length, created, updated, unchanged: 0, failed: errors.length, errors, warnings, durationMs: Date.now() - started };
    }

    // Commit: upsert via the bulk-import engine, then publish + link formulas.
    const result = await this.search.bulkImport({ questions: resolved.map((r) => r.dto), atomic: opts.atomic, mode: 'upsert' }, opts.user);
    for (const e of result.errors ?? []) errors.push({ index: e.index, publicId: resolved[e.index]?.dto.questionCode ?? '', message: e.message });

    // Resolve final ids, publish, and link formulas.
    const okCodes = resolved.map((r) => r.dto.questionCode);
    const rows = await this.prisma.question.findMany({ where: { questionCode: { in: okCodes }, deletedAt: null }, select: { id: true, questionCode: true, questionStatus: true } });
    const idByCode = new Map(rows.map((r) => [r.questionCode, r.id]));
    for (const r of resolved) {
      const id = idByCode.get(r.dto.questionCode);
      if (!id) continue;
      if (r.item.status === 'published') {
        await this.prisma.question.update({ where: { id }, data: { questionStatus: QuestionStatus.published, publishedBy: opts.user.id, publishedAt: new Date() } });
      }
      if (r.item.formulaSlugs.length) {
        for (const slug of r.item.formulaSlugs) {
          const fid = formulaMap.get(slug.toLowerCase());
          if (!fid) continue;
          await this.prisma.questionFormula.upsert({ where: { questionId_formulaId: { questionId: id, formulaId: fid } }, create: { questionId: id, formulaId: fid }, update: {} });
        }
      }
    }

    const report: SyncReport = {
      kind: 'questions', dryRun: false, total: rawItems.length,
      created: result.imported, updated: result.updated ?? 0, unchanged: 0,
      failed: errors.length, errors, warnings, durationMs: Date.now() - started,
    };
    this.logger.log({ message: 'Question sync complete', created: report.created, updated: report.updated, failed: report.failed, warnings: warnings.length });
    return report;
  }
}
