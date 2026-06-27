/**
 * @file cms.dto.ts
 * @module Cms/Dto
 *
 * Zod schemas + Swagger DTO classes for CMS operations: locking, review
 * assignment, comments, editorial notes, and bulk operations.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LOCK_MAX_TTL_SECONDS, CMS_BULK_MAX, BULK_OPERATIONS,
} from '../constants/cms.constants';

const REVIEW_STAGES = ['technical', 'educational', 'editorial', 'qa'] as const;
const NOTE_CATEGORIES = ['general', 'style', 'sourcing', 'prc_alignment', 'correction', 'warning'] as const;
const BULK_OPS = Object.values(BULK_OPERATIONS) as [string, ...string[]];

// ── Lock ──────────────────────────────────────────────────────────────────────

export const AcquireLockSchema = z.object({
  reason:     z.string().trim().max(500).optional(),
  ttlSeconds: z.coerce.number().int().min(30).max(LOCK_MAX_TTL_SECONDS).optional(),
});
export type AcquireLockDto = z.infer<typeof AcquireLockSchema>;

// ── Assignment ────────────────────────────────────────────────────────────────

export const AssignReviewSchema = z.object({
  assigneeId: z.string().uuid(),
  stage:      z.enum(REVIEW_STAGES),
  dueAt:      z.string().datetime().optional(),
});
export type AssignReviewDto = z.infer<typeof AssignReviewSchema>;

export const UpdateAssignmentSchema = z.object({
  status: z.enum(['pending', 'accepted', 'completed', 'declined', 'reassigned']),
});
export type UpdateAssignmentDto = z.infer<typeof UpdateAssignmentSchema>;

// ── Comments ──────────────────────────────────────────────────────────────────

export const CreateCommentSchema = z.object({
  body:     z.string().trim().min(1, 'Comment body is required.').max(4000),
  stage:    z.enum(REVIEW_STAGES).optional(),
  parentId: z.string().uuid().optional(),
});
export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;

// ── Editorial notes ────────────────────────────────────────────────────────────

export const CreateNoteSchema = z.object({
  body:     z.string().trim().min(1, 'Note body is required.').max(4000),
  category: z.enum(NOTE_CATEGORIES).default('general'),
  isPinned: z.boolean().default(false),
});
export type CreateNoteDto = z.infer<typeof CreateNoteSchema>;

// ── Bulk operations ────────────────────────────────────────────────────────────

export const BulkOperationSchema = z.object({
  operation:   z.enum(BULK_OPS),
  questionIds: z.array(z.string().uuid()).min(1).max(CMS_BULK_MAX),
  // optional params depending on operation
  reason:      z.string().trim().max(1000).optional(),
  assigneeId:  z.string().uuid().optional(),
  stage:       z.enum(REVIEW_STAGES).optional(),
}).superRefine((data, ctx) => {
  if (data.operation === BULK_OPERATIONS.REJECT && !data.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'A reason is required for bulk reject.' });
  }
  if (data.operation === BULK_OPERATIONS.ASSIGN && (!data.assigneeId || !data.stage)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assigneeId'], message: 'assigneeId and stage are required for bulk assign.' });
  }
});
export type BulkOperationDto = z.infer<typeof BulkOperationSchema>;

// ── Swagger classes ────────────────────────────────────────────────────────────

export class AcquireLockDtoClass {
  @ApiPropertyOptional({ description: 'Why the lock is being acquired.' }) reason?: string;
  @ApiPropertyOptional({ description: 'Lock duration in seconds (default 900).' }) ttlSeconds?: number;
}
export class AssignReviewDtoClass {
  @ApiProperty({ description: 'User UUID of the reviewer.' }) assigneeId!: string;
  @ApiProperty({ enum: REVIEW_STAGES }) stage!: string;
  @ApiPropertyOptional({ description: 'ISO due date.' }) dueAt?: string;
}
export class UpdateAssignmentDtoClass {
  @ApiProperty({ enum: ['pending', 'accepted', 'completed', 'declined', 'reassigned'] }) status!: string;
}
export class CreateCommentDtoClass {
  @ApiProperty({ example: 'The stem unit should be kN, not N.' }) body!: string;
  @ApiPropertyOptional({ enum: REVIEW_STAGES }) stage?: string;
  @ApiPropertyOptional({ description: 'Parent comment UUID for threaded replies.' }) parentId?: string;
}
export class CreateNoteDtoClass {
  @ApiProperty({ example: 'Verify against NSCP 2015 §403.' }) body!: string;
  @ApiPropertyOptional({ enum: NOTE_CATEGORIES, default: 'general' }) category?: string;
  @ApiPropertyOptional({ default: false }) isPinned?: boolean;
}
export class BulkOperationDtoClass {
  @ApiProperty({ enum: BULK_OPS }) operation!: string;
  @ApiProperty({ type: [String], description: 'Question UUIDs (max 200).' }) questionIds!: string[];
  @ApiPropertyOptional() reason?: string;
  @ApiPropertyOptional() assigneeId?: string;
  @ApiPropertyOptional({ enum: REVIEW_STAGES }) stage?: string;
}
export class BulkOperationResultDto {
  @ApiProperty() operation!: string;
  @ApiProperty() total!: number;
  @ApiProperty() succeeded!: number;
  @ApiProperty() failed!: number;
  @ApiProperty({ type: 'array', items: { type: 'object' } }) errors!: { questionId: string; code: string; message: string }[];
}
