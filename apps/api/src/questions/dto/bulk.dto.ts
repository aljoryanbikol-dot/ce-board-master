/**
 * @file bulk.dto.ts
 * @module Questions/Dto
 *
 * DTOs for bulk import and export.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateQuestionSchema } from './question.dto';
import { BULK_IMPORT_MAX, BULK_EXPORT_MAX } from '../constants/questions.constants';

export const BulkImportSchema = z.object({
  questions: z.array(CreateQuestionSchema)
    .min(1, 'At least one question is required.')
    .max(BULK_IMPORT_MAX, `A maximum of ${BULK_IMPORT_MAX} questions may be imported at once.`),
  /** If true, the whole batch is rejected when any row is invalid (default).
   *  If false, valid rows are imported and invalid rows reported. */
  atomic: z.boolean().default(true),
  /** 'create' (default) errors on existing questionCodes; 'upsert' updates them
   *  in place — idempotent sync from the Knowledge Library (no duplicates). */
  mode: z.enum(['create', 'upsert']).default('create'),
});
export type BulkImportDto = z.infer<typeof BulkImportSchema>;

export const BulkExportSchema = z.object({
  status:    z.enum(['draft', 'in_review', 'approved', 'published', 'archived', 'flagged']).optional(),
  subjectId: z.string().uuid().optional(),
  limit:     z.coerce.number().int().min(1).max(BULK_EXPORT_MAX).default(1000),
});
export type BulkExportDto = z.infer<typeof BulkExportSchema>;

export class BulkImportDtoClass {
  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Array of question payloads (same shape as POST /questions).' })
  questions!: unknown[];
  @ApiPropertyOptional({ default: true, description: 'Reject the entire batch if any row is invalid.' })
  atomic?: boolean;
}

export class BulkImportResultDto {
  @ApiProperty({ example: 12 }) imported!: number;
  @ApiProperty({ example: 0 }) failed!: number;
  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Per-row errors when non-atomic.' })
  errors!: { index: number; code: string; message: string }[];
  @ApiProperty({ type: [String], description: 'IDs of created questions.' }) createdIds!: string[];
}
