/**
 * @file content-sync.registry.ts — per-type sync configs.
 *
 * Each entry binds a Library export schema to a type-aware Prisma model. The
 * generic ContentSyncService consumes these; adding a new content type is just a
 * new model + a new entry here.
 */
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import type { SyncConfig } from './content-sync.types';

const STATUS = ['draft', 'in_review', 'approved', 'published', 'deprecated', 'archived'] as const;
const BLOOM = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;

const publicId = z.string().trim().min(1).max(80);
const subjectCode = z.string().trim().max(10).optional();
const topicCode = z.string().trim().max(10).optional();
const tags = z.array(z.string().trim().max(60)).max(50).default([]);
const statusField = z.enum(STATUS).default('published');
type Client = PrismaService | Prisma.TransactionClient;
const nn = <T>(v: T | undefined | null): T | null => (v === undefined ? null : v);
/** Erase the generic so heterogeneous configs live in one record. */
const erase = <T>(c: SyncConfig<T>): SyncConfig => c as unknown as SyncConfig;

// ── Concept ───────────────────────────────────────────────────────────────────
const ConceptInput = z.object({
  publicId, subjectCode, topicCode,
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(2000).nullable().optional(),
  body: z.string().trim().min(1),
  bloomLevel: z.enum(BLOOM).default('understand'),
  keywords: z.array(z.string().trim().max(60)).max(50).default([]),
  relatedFormulaSlugs: z.array(z.string().trim().max(100)).max(50).default([]),
  status: statusField,
});
const conceptCfg: SyncConfig<z.infer<typeof ConceptInput>> = {
  kind: 'concepts', entityType: 'concept', label: 'Concepts', schema: ConceptInput,
  naturalKey: (r) => r.publicId, searchFields: ['title', 'body', 'publicId'],
  getDelegate: (c: Client) => (c as PrismaService).concept,
  toData: (r) => ({ subjectCode: nn(r.subjectCode), topicCode: nn(r.topicCode), title: r.title, summary: nn(r.summary), body: r.body, bloomLevel: r.bloomLevel, keywords: r.keywords, relatedFormulaSlugs: r.relatedFormulaSlugs, status: r.status }),
  checkRelationships: async (r, prisma) => {
    const warnings: string[] = [];
    if (r.relatedFormulaSlugs.length) {
      const found = await prisma.formulaLibrary.findMany({ where: { slug: { in: r.relatedFormulaSlugs } }, select: { slug: true } });
      const set = new Set(found.map((f) => f.slug));
      for (const s of r.relatedFormulaSlugs) if (!set.has(s)) warnings.push(`formula slug '${s}' not found`);
    }
    return warnings;
  },
};

// ── Engineering Note ──────────────────────────────────────────────────────────
const EngineeringNoteInput = z.object({
  publicId, subjectCode, topicCode,
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1),
  tags, status: statusField,
});
const engineeringNoteCfg: SyncConfig<z.infer<typeof EngineeringNoteInput>> = {
  kind: 'engineering-notes', entityType: 'engineering_note', label: 'Engineering Notes', schema: EngineeringNoteInput,
  naturalKey: (r) => r.publicId, searchFields: ['title', 'body', 'publicId'],
  getDelegate: (c: Client) => (c as PrismaService).engineeringNote,
  toData: (r) => ({ subjectCode: nn(r.subjectCode), topicCode: nn(r.topicCode), title: r.title, body: r.body, tags: r.tags, status: r.status }),
};

// ── Engineering Tip ───────────────────────────────────────────────────────────
const EngineeringTipInput = z.object({
  publicId, subjectCode,
  category: z.string().trim().max(60).nullable().optional(),
  title: z.string().trim().min(1).max(300),
  tip: z.string().trim().min(1),
  tags, status: statusField,
});
const engineeringTipCfg: SyncConfig<z.infer<typeof EngineeringTipInput>> = {
  kind: 'engineering-tips', entityType: 'engineering_tip', label: 'Engineering Tips', schema: EngineeringTipInput,
  naturalKey: (r) => r.publicId, searchFields: ['title', 'tip', 'publicId'],
  getDelegate: (c: Client) => (c as PrismaService).engineeringTip,
  toData: (r) => ({ subjectCode: nn(r.subjectCode), category: nn(r.category), title: r.title, tip: r.tip, tags: r.tags, status: r.status }),
};

// ── Diagram ───────────────────────────────────────────────────────────────────
const DiagramInput = z.object({
  publicId, subjectCode, topicCode,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  imageUrl: z.string().trim().url().max(300000),
  altText: z.string().trim().min(1).max(500),
  caption: z.string().trim().max(500).nullable().optional(),
  diagramType: z.string().trim().max(60).nullable().optional(),
  tags, status: statusField,
});
const diagramCfg: SyncConfig<z.infer<typeof DiagramInput>> = {
  kind: 'diagrams', entityType: 'diagram', label: 'Diagram Library', schema: DiagramInput,
  naturalKey: (r) => r.publicId, searchFields: ['title', 'description', 'publicId'],
  getDelegate: (c: Client) => (c as PrismaService).diagram,
  toData: (r) => ({ subjectCode: nn(r.subjectCode), topicCode: nn(r.topicCode), title: r.title, description: nn(r.description), imageUrl: r.imageUrl, altText: r.altText, caption: nn(r.caption), diagramType: nn(r.diagramType), tags: r.tags, status: r.status }),
};

// ── Review Note ───────────────────────────────────────────────────────────────
const ReviewNoteInput = z.object({
  publicId, subjectCode, topicCode,
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1),
  examWeight: z.coerce.number().min(0).max(100).nullable().optional(),
  tags, status: statusField,
});
const reviewNoteCfg: SyncConfig<z.infer<typeof ReviewNoteInput>> = {
  kind: 'review-notes', entityType: 'review_note', label: 'Review Notes', schema: ReviewNoteInput,
  naturalKey: (r) => r.publicId, searchFields: ['title', 'body', 'publicId'],
  getDelegate: (c: Client) => (c as PrismaService).reviewNote,
  toData: (r) => ({ subjectCode: nn(r.subjectCode), topicCode: nn(r.topicCode), title: r.title, body: r.body, examWeight: nn(r.examWeight), tags: r.tags, status: r.status }),
};

// ── Flashcard ─────────────────────────────────────────────────────────────────
const FlashcardInput = z.object({
  publicId, subjectCode, topicCode,
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
  hint: z.string().trim().max(2000).nullable().optional(),
  difficulty: z.string().trim().max(20).nullable().optional(),
  tags, status: statusField,
});
const flashcardCfg: SyncConfig<z.infer<typeof FlashcardInput>> = {
  kind: 'flashcards', entityType: 'flashcard', label: 'Flashcards', schema: FlashcardInput,
  naturalKey: (r) => r.publicId, searchFields: ['front', 'back', 'publicId'],
  getDelegate: (c: Client) => (c as PrismaService).flashcard,
  toData: (r) => ({ subjectCode: nn(r.subjectCode), topicCode: nn(r.topicCode), front: r.front, back: r.back, hint: nn(r.hint), difficulty: nn(r.difficulty), tags: r.tags, status: r.status }),
};

// ── AI Tutor Prompt ───────────────────────────────────────────────────────────
const TutorPromptInput = z.object({
  publicId,
  name: z.string().trim().min(1).max(200),
  role: z.enum(['system', 'user', 'assistant']).default('system'),
  category: z.string().trim().max(60).nullable().optional(),
  promptText: z.string().trim().min(1),
  model: z.string().trim().max(100).nullable().optional(),
  tags, status: statusField,
});
const tutorPromptCfg: SyncConfig<z.infer<typeof TutorPromptInput>> = {
  kind: 'tutor-prompts', entityType: 'tutor_prompt', label: 'AI Tutor Prompts', schema: TutorPromptInput,
  naturalKey: (r) => r.publicId, searchFields: ['name', 'promptText', 'publicId'],
  getDelegate: (c: Client) => (c as PrismaService).tutorPrompt,
  toData: (r) => ({ name: r.name, role: r.role, category: nn(r.category), promptText: r.promptText, model: nn(r.model), tags: r.tags, status: r.status }),
};

// ── Common Misconception (existing table; key publicId, version=currentVersion) ─
const MisconceptionInput = z.object({
  publicId,
  subjectCode: z.string().trim().min(2).max(10),
  topicCode: z.string().trim().max(3),
  subtopicCode: z.string().trim().max(3),
  category: z.string().trim().max(3),
  sequenceNumber: z.coerce.number().int().min(1).max(999),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1),
  whyItHappens: z.string().trim().nullable().optional(),
  correction: z.string().trim().nullable().optional(),
  status: statusField,
});
const misconceptionCfg: SyncConfig<z.infer<typeof MisconceptionInput>> = {
  kind: 'misconceptions', entityType: 'misconception', label: 'Common Misconceptions', schema: MisconceptionInput,
  naturalKey: (r) => r.publicId, searchFields: ['title', 'description', 'publicId'],
  keyField: 'publicId', versionField: 'currentVersion', semverField: 'semver', softDeleteField: 'deletedAt',
  getDelegate: (c: Client) => (c as PrismaService).misconception,
  toData: (r) => ({ subjectCode: r.subjectCode, topicCode: r.topicCode, subtopicCode: r.subtopicCode, category: r.category, sequenceNumber: r.sequenceNumber, title: r.title, description: r.description, whyItHappens: nn(r.whyItHappens), correction: nn(r.correction), status: r.status }),
};

// ── References (existing ReferenceBook; key publicId, active=isActive) ───────────
const ReferenceInput = z.object({
  publicId,
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().trim().max(200)).max(50).default([]),
  edition: z.string().trim().max(50).nullable().optional(),
  publisher: z.string().trim().max(255).nullable().optional(),
  publicationYear: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
  isbn13: z.string().trim().length(13).nullable().optional(),
  isbn10: z.string().trim().length(10).nullable().optional(),
  subjectArea: z.string().trim().max(100).nullable().optional(),
  coverImageUrl: z.string().trim().url().max(1000).nullable().optional(),
  description: z.string().trim().nullable().optional(),
});
const referenceCfg: SyncConfig<z.infer<typeof ReferenceInput>> = {
  kind: 'references', entityType: 'reference', label: 'References', schema: ReferenceInput,
  naturalKey: (r) => r.publicId, searchFields: ['title', 'publisher', 'publicId'],
  keyField: 'publicId', activeField: 'isActive',
  getDelegate: (c: Client) => (c as PrismaService).referenceBook,
  toData: (r) => ({ title: r.title, authors: r.authors, edition: nn(r.edition), publisher: nn(r.publisher), publicationYear: nn(r.publicationYear), isbn13: nn(r.isbn13), isbn10: nn(r.isbn10), subjectArea: nn(r.subjectArea), coverImageUrl: nn(r.coverImageUrl), description: nn(r.description) }),
};

// ── Mock Exam Templates (existing ExamTemplate; key code, active=isActive) ──────
const ExamTemplateInput = z.object({
  code: z.string().trim().toUpperCase().min(2).max(50),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  kind: z.enum(['full_board', 'subject', 'custom', 'adaptive', 'ai_generated']),
  durationMinutes: z.coerce.number().int().min(1).max(600),
  passingScore: z.coerce.number().min(0).max(100).default(70),
  randomizeQuestions: z.boolean().default(true),
  randomizeChoices: z.boolean().default(true),
  composition: z.array(z.object({
    subjectId: z.string().uuid(),
    count: z.coerce.number().int().min(1).max(500),
    difficultyLevelId: z.string().uuid().optional(),
    weightPercent: z.coerce.number().min(0).max(100).optional(),
  })).min(1),
});
const examTemplateCfg: SyncConfig<z.infer<typeof ExamTemplateInput>> = {
  kind: 'mock-exam-templates', entityType: 'exam_template', label: 'Mock Exam Templates', schema: ExamTemplateInput,
  naturalKey: (r) => r.code, searchFields: ['code', 'name'],
  keyField: 'code', activeField: 'isActive',
  getDelegate: (c: Client) => (c as PrismaService).examTemplate,
  toData: (r) => ({ name: r.name, description: nn(r.description), kind: r.kind, durationMinutes: r.durationMinutes, passingScore: r.passingScore, randomizeQuestions: r.randomizeQuestions, randomizeChoices: r.randomizeChoices, composition: r.composition as unknown, totalQuestions: r.composition.reduce((s, e) => s + e.count, 0) }),
};

export const SYNC_CONFIGS: Record<string, SyncConfig> = {
  concepts: erase(conceptCfg),
  'engineering-notes': erase(engineeringNoteCfg),
  'engineering-tips': erase(engineeringTipCfg),
  diagrams: erase(diagramCfg),
  'review-notes': erase(reviewNoteCfg),
  flashcards: erase(flashcardCfg),
  'tutor-prompts': erase(tutorPromptCfg),
  misconceptions: erase(misconceptionCfg),
  references: erase(referenceCfg),
  'mock-exam-templates': erase(examTemplateCfg),
};

export const SYNC_KINDS = Object.keys(SYNC_CONFIGS);
