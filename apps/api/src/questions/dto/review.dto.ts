/**
 * @file review.dto.ts
 * @module Questions/Dto
 *
 * DTOs for workflow transitions: submit, approve, reject, publish, archive,
 * flag/unflag. Each maps to a ReviewAction the status machine validates.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REVIEW_STAGES } from '../constants/questions.constants';

const STAGES = [REVIEW_STAGES.TECHNICAL, REVIEW_STAGES.EDUCATIONAL, REVIEW_STAGES.EDITORIAL, REVIEW_STAGES.QA] as const;

/** Submit a draft for review — optionally targeting a starting stage. */
export const SubmitForReviewSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
export type SubmitForReviewDto = z.infer<typeof SubmitForReviewSchema>;

/** Approve the current review stage (advances stage, or status if final). */
export const ApproveSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
export type ApproveDto = z.infer<typeof ApproveSchema>;

/** Reject / request changes — returns the question to draft. */
export const RejectSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required.').max(1000),
  requestChanges: z.boolean().default(false),
});
export type RejectDto = z.infer<typeof RejectSchema>;

/** Flag a published question. */
export const FlagSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});
export type FlagDto = z.infer<typeof FlagSchema>;

/** Optional notes-only body for publish/archive/unflag. */
export const NotesOnlySchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
export type NotesOnlyDto = z.infer<typeof NotesOnlySchema>;

// ── Swagger classes ────────────────────────────────────────────────────────────

export class SubmitForReviewDtoClass {
  @ApiPropertyOptional({ description: 'Optional note recorded in the workflow log.' }) notes?: string;
}
export class ApproveDtoClass {
  @ApiPropertyOptional({ description: 'Reviewer note for this stage approval.' }) notes?: string;
}
export class RejectDtoClass {
  @ApiProperty({ example: 'Stem contains an ambiguous unit.', description: 'Reason returned to the author.' }) reason!: string;
  @ApiPropertyOptional({ default: false, description: 'If true, recorded as request_changes rather than reject.' }) requestChanges?: boolean;
}
export class FlagDtoClass {
  @ApiProperty({ example: 'Reported incorrect answer key.' }) reason!: string;
}
export class NotesOnlyDtoClass {
  @ApiPropertyOptional() notes?: string;
}

export class WorkflowEntryDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) fromStatus?: string | null;
  @ApiProperty() toStatus!: string;
  @ApiProperty({ example: 'approve' }) actionType!: string;
  @ApiProperty() actionBy!: string;
  @ApiPropertyOptional({ nullable: true }) notes?: string | null;
  @ApiProperty() occurredAt!: string;
}

/** Exposed so OpenAPI lists the valid review stages. */
export const REVIEW_STAGE_VALUES = STAGES;
