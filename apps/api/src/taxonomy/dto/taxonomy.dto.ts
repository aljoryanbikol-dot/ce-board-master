/**
 * @file taxonomy.dto.ts
 * @module Taxonomy/Dto
 *
 * Zod validation for the admin taxonomy CRUD (subjects → topics → subtopics).
 * Mirrors the Prisma model constraints so the API fails fast with clear errors.
 */
import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #1b4b8f.')
  .optional()
  .nullable();

const code = (max: number) =>
  z.string().trim().toUpperCase().min(2).max(max).regex(/^[A-Z0-9_-]+$/, 'Code may contain A–Z, 0–9, hyphen, underscore.');

// ── List query (shared) ─────────────────────────────────────────────────────
export const ListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true), z.boolean().optional()),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
});
export type ListQueryDto = z.infer<typeof ListQuerySchema>;

export const BulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });
export type BulkIdsDto = z.infer<typeof BulkIdsSchema>;

// ── Subjects ────────────────────────────────────────────────────────────────
export const CreateSubjectSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: code(20),
  examDay: z.coerce.number().int().min(1).max(7),
  prcWeightPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  colorHex: hexColor,
  iconName: z.string().trim().max(50).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export const UpdateSubjectSchema = CreateSubjectSchema.partial();
export type CreateSubjectDto = z.infer<typeof CreateSubjectSchema>;
export type UpdateSubjectDto = z.infer<typeof UpdateSubjectSchema>;

// ── Topics (Categories) ─────────────────────────────────────────────────────
export const CreateTopicSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  code: code(30),
  prcLearningOutcome: z.string().trim().max(2000).optional().nullable(),
  prcWeightPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export const UpdateTopicSchema = CreateTopicSchema.partial();
export type CreateTopicDto = z.infer<typeof CreateTopicSchema>;
export type UpdateTopicDto = z.infer<typeof UpdateTopicSchema>;

// ── Subtopics ───────────────────────────────────────────────────────────────
export const CreateSubtopicSchema = z.object({
  topicId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  code: code(40),
  keywords: z.array(z.string().trim().max(50)).max(30).default([]),
  description: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export const UpdateSubtopicSchema = CreateSubtopicSchema.partial();
export type CreateSubtopicDto = z.infer<typeof CreateSubtopicSchema>;
export type UpdateSubtopicDto = z.infer<typeof UpdateSubtopicSchema>;

// ── Difficulty Levels ───────────────────────────────────────────────────────
export const CreateDifficultyLevelSchema = z.object({
  name: z.string().trim().min(1).max(50),
  code: z.coerce.number().int().min(1).max(32767),
  description: z.string().trim().max(2000).optional().nullable(),
  passingThreshold: z.coerce.number().min(0).max(100).default(70),
  colorHex: hexColor,
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export const UpdateDifficultyLevelSchema = CreateDifficultyLevelSchema.partial();
export type CreateDifficultyLevelDto = z.infer<typeof CreateDifficultyLevelSchema>;
export type UpdateDifficultyLevelDto = z.infer<typeof UpdateDifficultyLevelSchema>;

// ── Tags ────────────────────────────────────────────────────────────────────
export const TAG_CATEGORIES = ['general', 'prc_exam', 'difficulty', 'topic_theme', 'skill_type', 'exam_year'] as const;
export const CreateTagSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().toLowerCase().min(1).max(80).regex(/^[a-z0-9-]+$/, 'Slug may contain a–z, 0–9, hyphen.').optional(),
  category: z.enum(TAG_CATEGORIES).default('general'),
  description: z.string().trim().max(2000).optional().nullable(),
  colorHex: hexColor,
  isActive: z.boolean().default(true),
});
export const UpdateTagSchema = CreateTagSchema.partial();
export type CreateTagDto = z.infer<typeof CreateTagSchema>;
export type UpdateTagDto = z.infer<typeof UpdateTagSchema>;

// ── Reference Books ─────────────────────────────────────────────────────────
export const CreateReferenceBookSchema = z.object({
  title: z.string().trim().min(1).max(500),
  edition: z.string().trim().max(50).optional().nullable(),
  publisher: z.string().trim().max(255).optional().nullable(),
  publicationYear: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  isbn13: z.string().trim().length(13).optional().nullable(),
  isbn10: z.string().trim().length(10).optional().nullable(),
  subjectArea: z.string().trim().max(100).optional().nullable(),
  coverImageUrl: z.string().trim().url().max(1000).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});
export const UpdateReferenceBookSchema = CreateReferenceBookSchema.partial();
export type CreateReferenceBookDto = z.infer<typeof CreateReferenceBookSchema>;
export type UpdateReferenceBookDto = z.infer<typeof UpdateReferenceBookSchema>;
