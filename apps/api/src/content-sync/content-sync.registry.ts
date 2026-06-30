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
  imageUrl: z.string().trim().url().max(1000),
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

export const SYNC_CONFIGS: Record<string, SyncConfig> = {
  concepts: erase(conceptCfg),
  'engineering-notes': erase(engineeringNoteCfg),
  'engineering-tips': erase(engineeringTipCfg),
  diagrams: erase(diagramCfg),
  'review-notes': erase(reviewNoteCfg),
  flashcards: erase(flashcardCfg),
  'tutor-prompts': erase(tutorPromptCfg),
};

export const SYNC_KINDS = Object.keys(SYNC_CONFIGS);
