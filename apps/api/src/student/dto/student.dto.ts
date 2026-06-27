/**
 * @file student.dto.ts
 * @module Student/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PRACTICE_LIMITS, RECOMMENDATION_LIMITS } from '../constants/student.constants';

// ── Practice ────────────────────────────────────────────────────────────────────
export const StartPracticeSchema = z.object({
  mode: z.enum(['subject', 'topic', 'learning_objective', 'blueprint', 'difficulty', 'recommended', 'mixed']),
  subjectId:        z.string().uuid().optional(),
  topicId:          z.string().uuid().optional(),
  subtopicId:       z.string().uuid().optional(),
  learningObjectiveId: z.string().trim().toUpperCase().optional(),
  blueprintId:      z.string().trim().toUpperCase().optional(),
  difficultyLevelId: z.string().uuid().optional(),
  targetCount:      z.coerce.number().int().min(PRACTICE_LIMITS.MIN_QUESTIONS).max(PRACTICE_LIMITS.MAX_QUESTIONS).default(PRACTICE_LIMITS.DEFAULT_QUESTIONS),
}).refine((d) =>
  d.mode === 'recommended' || d.mode === 'mixed' ||
  d.subjectId || d.topicId || d.subtopicId || d.learningObjectiveId || d.blueprintId || d.difficultyLevelId,
  { message: 'A target (subject/topic/LO/blueprint/difficulty) is required for this mode.' });
export type StartPracticeDto = z.infer<typeof StartPracticeSchema>;

export const SubmitAnswerSchema = z.object({
  questionId:     z.string().uuid(),
  selectedChoice: z.string().trim().toUpperCase().max(2).nullable().optional(),
  timeSpentSec:   z.coerce.number().int().min(0).max(36_000).default(0),
  skipped:        z.boolean().default(false),
});
export type SubmitAnswerDto = z.infer<typeof SubmitAnswerSchema>;

// ── Engagement ──────────────────────────────────────────────────────────────────
export const CreateBookmarkSchema = z.object({
  questionId: z.string().uuid(),
  note:       z.string().trim().max(500).optional(),
});
export type CreateBookmarkDto = z.infer<typeof CreateBookmarkSchema>;

export const FavoriteSchema = z.object({ questionId: z.string().uuid() });
export type FavoriteDto = z.infer<typeof FavoriteSchema>;

export const ViewQuestionSchema = z.object({ questionId: z.string().uuid() });
export type ViewQuestionDto = z.infer<typeof ViewQuestionSchema>;

// ── Study goals ─────────────────────────────────────────────────────────────────
export const UpsertGoalSchema = z.object({
  period:          z.enum(['daily', 'weekly', 'monthly']),
  targetQuestions: z.coerce.number().int().min(1).max(1000),
  targetMinutes:   z.coerce.number().int().min(0).max(1440).optional(),
});
export type UpsertGoalDto = z.infer<typeof UpsertGoalSchema>;

// ── Study planner ─────────────────────────────────────────────────────────────
export const CreatePlanSchema = z.object({
  title:       z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;

export const CreateTaskSchema = z.object({
  title:           z.string().trim().min(1).max(200),
  scheduledDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subjectId:       z.string().uuid().optional(),
  topicId:         z.string().uuid().optional(),
  targetQuestions: z.coerce.number().int().min(1).max(200).default(10),
});
export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']),
});
export type UpdateTaskStatusDto = z.infer<typeof UpdateTaskStatusSchema>;

// ── Queries ───────────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationDto = z.infer<typeof PaginationSchema>;

export const HistoryQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  topicId:   z.string().uuid().optional(),
  outcome:   z.enum(['correct', 'incorrect', 'skipped']).optional(),
  cursor:    z.string().uuid().optional(),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});
export type HistoryQueryDto = z.infer<typeof HistoryQuerySchema>;

export const AnalyticsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  days:   z.coerce.number().int().min(1).max(365).default(30),
});
export type AnalyticsQueryDto = z.infer<typeof AnalyticsQuerySchema>;

export const RecommendationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(RECOMMENDATION_LIMITS.MAX).default(RECOMMENDATION_LIMITS.DEFAULT),
  subjectId: z.string().uuid().optional(),
});
export type RecommendationQueryDto = z.infer<typeof RecommendationQuerySchema>;

export const LeaderboardQuerySchema = z.object({
  scope: z.enum(['global', 'subject']).default('global'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type LeaderboardQueryDto = z.infer<typeof LeaderboardQuerySchema>;

// ── Swagger classes ───────────────────────────────────────────────────────────
export class StartPracticeDtoClass {
  @ApiProperty({ enum: ['subject', 'topic', 'learning_objective', 'blueprint', 'difficulty', 'recommended', 'mixed'] }) mode!: string;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
  @ApiPropertyOptional() subtopicId?: string;
  @ApiPropertyOptional() learningObjectiveId?: string;
  @ApiPropertyOptional() blueprintId?: string;
  @ApiPropertyOptional() difficultyLevelId?: string;
  @ApiPropertyOptional({ type: Number, default: 10 }) targetCount?: number;
}
export class SubmitAnswerDtoClass {
  @ApiProperty() questionId!: string;
  @ApiPropertyOptional({ example: 'B' }) selectedChoice?: string | null;
  @ApiPropertyOptional({ type: Number }) timeSpentSec?: number;
  @ApiPropertyOptional({ type: Boolean }) skipped?: boolean;
}
export class CreateBookmarkDtoClass {
  @ApiProperty() questionId!: string;
  @ApiPropertyOptional() note?: string;
}
export class FavoriteDtoClass { @ApiProperty() questionId!: string; }
export class ViewQuestionDtoClass { @ApiProperty() questionId!: string; }
export class UpsertGoalDtoClass {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'] }) period!: string;
  @ApiProperty({ type: Number }) targetQuestions!: number;
  @ApiPropertyOptional({ type: Number }) targetMinutes?: number;
}
export class CreatePlanDtoClass {
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ example: '2026-07-01' }) startDate!: string;
  @ApiProperty({ example: '2026-09-30' }) endDate!: string;
}
export class CreateTaskDtoClass {
  @ApiProperty() title!: string;
  @ApiProperty({ example: '2026-07-05' }) scheduledDate!: string;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
  @ApiPropertyOptional({ type: Number, default: 10 }) targetQuestions?: number;
}
export class UpdateTaskStatusDtoClass {
  @ApiProperty({ enum: ['pending', 'in_progress', 'completed', 'skipped'] }) status!: string;
}
export class HistoryQueryDtoClass {
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
  @ApiPropertyOptional({ enum: ['correct', 'incorrect', 'skipped'] }) outcome?: string;
  @ApiPropertyOptional() cursor?: string;
  @ApiPropertyOptional({ type: Number }) limit?: number;
}
export class AnalyticsQueryDtoClass {
  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly'], default: 'daily' }) period?: string;
  @ApiPropertyOptional({ type: Number, default: 30 }) days?: number;
}
export class RecommendationQueryDtoClass {
  @ApiPropertyOptional({ type: Number, default: 10 }) limit?: number;
  @ApiPropertyOptional() subjectId?: string;
}
export class LeaderboardQueryDtoClass {
  @ApiPropertyOptional({ enum: ['global', 'subject'], default: 'global' }) scope?: string;
  @ApiPropertyOptional({ type: Number, default: 20 }) limit?: number;
}
