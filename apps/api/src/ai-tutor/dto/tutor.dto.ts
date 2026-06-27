/**
 * @file tutor.dto.ts
 * @module AITutor/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TUTOR_LIMITS } from '../constants/tutor.constants';

// ── Conversations ───────────────────────────────────────────────────────────────
export const StartConversationSchema = z.object({
  title: z.string().trim().max(TUTOR_LIMITS.MAX_TITLE_CHARS).optional(),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  firstMessage: z.string().trim().min(1).max(TUTOR_LIMITS.MAX_MESSAGE_CHARS).optional(),
});
export type StartConversationDto = z.infer<typeof StartConversationSchema>;

export const SendMessageSchema = z.object({
  message: z.string().trim().min(1).max(TUTOR_LIMITS.MAX_MESSAGE_CHARS),
  intent: z.enum(['ask_question', 'explain_concept', 'explain_question', 'step_solution', 'hint', 'formula_help', 'coaching', 'followup']).optional(),
  questionId: z.string().uuid().optional(),
});
export type SendMessageDto = z.infer<typeof SendMessageSchema>;

// ── One-shot helpers (no conversation needed) ──────────────────────────────────
export const AskSchema = z.object({
  question: z.string().trim().min(1).max(TUTOR_LIMITS.MAX_MESSAGE_CHARS),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
});
export type AskDto = z.infer<typeof AskSchema>;

export const ExplainConceptSchema = z.object({
  concept: z.string().trim().min(1).max(TUTOR_LIMITS.MAX_MESSAGE_CHARS),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
});
export type ExplainConceptDto = z.infer<typeof ExplainConceptSchema>;

export const ExplainQuestionSchema = z.object({ questionId: z.string().uuid() });
export type ExplainQuestionDto = z.infer<typeof ExplainQuestionSchema>;

export const HintSchema = z.object({
  questionId: z.string().uuid(),
  level: z.coerce.number().int().min(1).max(3).optional(),
});
export type HintDto = z.infer<typeof HintSchema>;

export const SolutionSchema = z.object({ questionId: z.string().uuid() });
export type SolutionDto = z.infer<typeof SolutionSchema>;

export const FormulaQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
});
export type FormulaQueryDto = z.infer<typeof FormulaQuerySchema>;

// ── Queries ───────────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(TUTOR_LIMITS.HISTORY_PAGE_SIZE),
});
export type PaginationDto = z.infer<typeof PaginationSchema>;

export const CoachingQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type CoachingQueryDto = z.infer<typeof CoachingQuerySchema>;

// ── Swagger classes ───────────────────────────────────────────────────────────
export class StartConversationDtoClass {
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
  @ApiPropertyOptional() firstMessage?: string;
}
export class SendMessageDtoClass {
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ enum: ['ask_question', 'explain_concept', 'explain_question', 'step_solution', 'hint', 'formula_help', 'coaching', 'followup'] }) intent?: string;
  @ApiPropertyOptional() questionId?: string;
}
export class AskDtoClass {
  @ApiProperty() question!: string;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
}
export class ExplainConceptDtoClass {
  @ApiProperty() concept!: string;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
}
export class ExplainQuestionDtoClass { @ApiProperty() questionId!: string; }
export class HintDtoClass {
  @ApiProperty() questionId!: string;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 3 }) level?: number;
}
export class SolutionDtoClass { @ApiProperty() questionId!: string; }
export class FormulaQueryDtoClass {
  @ApiProperty() query!: string;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
}
export class CoachingQueryDtoClass {
  @ApiPropertyOptional({ type: Boolean }) unreadOnly?: boolean;
  @ApiPropertyOptional({ type: Number, default: 20 }) limit?: number;
}
