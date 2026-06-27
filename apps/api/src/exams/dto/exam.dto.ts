/**
 * @file exam.dto.ts
 * @module Exams/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EXAM_LIMITS } from '../constants/exam.constants';

// ── Templates ───────────────────────────────────────────────────────────────────
const CompositionEntrySchema = z.object({
  subjectId: z.string().uuid(),
  count: z.coerce.number().int().min(1).max(EXAM_LIMITS.MAX_QUESTIONS),
  difficultyLevelId: z.string().uuid().optional(),
  weightPercent: z.coerce.number().min(0).max(100).optional(),
});

export const CreateTemplateSchema = z.object({
  code: z.string().trim().min(2).max(50).toUpperCase(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  kind: z.enum(['full_board', 'subject', 'custom', 'adaptive', 'ai_generated']),
  durationMinutes: z.coerce.number().int().min(EXAM_LIMITS.MIN_DURATION_MIN).max(EXAM_LIMITS.MAX_DURATION_MIN),
  passingScore: z.coerce.number().min(EXAM_LIMITS.MIN_PASSING_SCORE).max(EXAM_LIMITS.MAX_PASSING_SCORE).default(EXAM_LIMITS.DEFAULT_PASSING_SCORE),
  randomizeQuestions: z.boolean().default(true),
  randomizeChoices: z.boolean().default(true),
  composition: z.array(CompositionEntrySchema).min(1),
}).refine((d) => d.composition.reduce((s, e) => s + e.count, 0) >= EXAM_LIMITS.MIN_QUESTIONS, {
  message: `Composition must total at least ${EXAM_LIMITS.MIN_QUESTIONS} questions.`,
});
export type CreateTemplateDto = z.infer<typeof CreateTemplateSchema>;

// ── Start an exam ─────────────────────────────────────────────────────────────
export const StartExamSchema = z.object({
  kind: z.enum(['full_board', 'subject', 'custom', 'adaptive', 'ai_generated']),
  templateId: z.string().uuid().optional(),
  title: z.string().trim().max(160).optional(),
  // For custom/subject/adaptive without a template:
  subjectId: z.string().uuid().optional(),
  composition: z.array(CompositionEntrySchema).optional(),
  totalQuestions: z.coerce.number().int().min(EXAM_LIMITS.MIN_QUESTIONS).max(EXAM_LIMITS.MAX_QUESTIONS).optional(),
  durationMinutes: z.coerce.number().int().min(EXAM_LIMITS.MIN_DURATION_MIN).max(EXAM_LIMITS.MAX_DURATION_MIN).optional(),
  passingScore: z.coerce.number().min(EXAM_LIMITS.MIN_PASSING_SCORE).max(EXAM_LIMITS.MAX_PASSING_SCORE).optional(),
}).refine((d) => d.templateId || d.kind === 'full_board' || d.kind === 'adaptive' || d.kind === 'ai_generated' || d.subjectId || (d.composition && d.composition.length > 0), {
  message: 'Provide a templateId, a subjectId, or a composition (unless full_board/adaptive/ai_generated).',
});
export type StartExamDto = z.infer<typeof StartExamSchema>;

// ── Answer (autosave) ─────────────────────────────────────────────────────────
export const SaveAnswerSchema = z.object({
  examQuestionId: z.string().uuid(),
  selectedChoice: z.string().trim().toUpperCase().max(1).nullable().optional(), // presented letter
  timeSpentSec: z.coerce.number().int().min(0).max(36_000).default(0),
  flagged: z.boolean().optional(),
});
export type SaveAnswerDto = z.infer<typeof SaveAnswerSchema>;

export const BookmarkExamQuestionSchema = z.object({
  examQuestionId: z.string().uuid(),
  bookmarked: z.boolean(),
});
export type BookmarkExamQuestionDto = z.infer<typeof BookmarkExamQuestionSchema>;

// ── Queries ───────────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationDto = z.infer<typeof PaginationSchema>;

export const ReviewQuerySchema = z.object({
  filter: z.enum(['all', 'incorrect', 'bookmarked', 'skipped']).default('all'),
});
export type ReviewQueryDto = z.infer<typeof ReviewQuerySchema>;

export const LeaderboardQuerySchema = z.object({
  templateId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type LeaderboardQueryDto = z.infer<typeof LeaderboardQuerySchema>;

// ── Swagger classes ───────────────────────────────────────────────────────────
class CompositionEntryClass {
  @ApiProperty() subjectId!: string;
  @ApiProperty({ type: Number }) count!: number;
  @ApiPropertyOptional() difficultyLevelId?: string;
  @ApiPropertyOptional({ type: Number }) weightPercent?: number;
}
export class CreateTemplateDtoClass {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ enum: ['full_board', 'subject', 'custom', 'adaptive', 'ai_generated'] }) kind!: string;
  @ApiProperty({ type: Number }) durationMinutes!: number;
  @ApiPropertyOptional({ type: Number, default: 70 }) passingScore?: number;
  @ApiPropertyOptional({ type: Boolean }) randomizeQuestions?: boolean;
  @ApiPropertyOptional({ type: Boolean }) randomizeChoices?: boolean;
  @ApiProperty({ type: [CompositionEntryClass] }) composition!: CompositionEntryClass[];
}
export class StartExamDtoClass {
  @ApiProperty({ enum: ['full_board', 'subject', 'custom', 'adaptive', 'ai_generated'] }) kind!: string;
  @ApiPropertyOptional() templateId?: string;
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional({ type: [CompositionEntryClass] }) composition?: CompositionEntryClass[];
  @ApiPropertyOptional({ type: Number }) totalQuestions?: number;
  @ApiPropertyOptional({ type: Number }) durationMinutes?: number;
  @ApiPropertyOptional({ type: Number }) passingScore?: number;
}
export class SaveAnswerDtoClass {
  @ApiProperty() examQuestionId!: string;
  @ApiPropertyOptional({ example: 'B' }) selectedChoice?: string | null;
  @ApiPropertyOptional({ type: Number }) timeSpentSec?: number;
  @ApiPropertyOptional({ type: Boolean }) flagged?: boolean;
}
export class BookmarkExamQuestionDtoClass {
  @ApiProperty() examQuestionId!: string;
  @ApiProperty({ type: Boolean }) bookmarked!: boolean;
}
export class ReviewQueryDtoClass {
  @ApiPropertyOptional({ enum: ['all', 'incorrect', 'bookmarked', 'skipped'], default: 'all' }) filter?: string;
}
export class LeaderboardQueryDtoClass {
  @ApiPropertyOptional() templateId?: string;
  @ApiPropertyOptional({ type: Number, default: 20 }) limit?: number;
}
