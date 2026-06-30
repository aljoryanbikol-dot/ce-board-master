/**
 * @file learning-objective.dto.ts
 * @module LearningObjectives/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const BLOOM = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;

export const CreateLearningObjectiveSchema = z.object({
  subjectCode:   z.string().trim().toUpperCase().min(2).max(10),
  topicCode:     z.coerce.number().int().min(0).max(999),
  subtopicCode:  z.coerce.number().int().min(0).max(999),
  sequenceNumber: z.coerce.number().int().min(1).max(999),
  statement:     z.string().trim().min(10).max(2000),
  bloomLevel:    z.enum(BLOOM).default('apply'),
  measurable:    z.boolean().default(true),
  keywords:      z.array(z.string().trim().max(50)).max(30).default([]),
  subjectId:     z.string().uuid().optional(),
  sourceDocumentId: z.string().uuid().optional(),
});
export type CreateLearningObjectiveDto = z.infer<typeof CreateLearningObjectiveSchema>;

/** Idempotent sync of learning objectives authored in the Knowledge Library. */
export const BulkSyncLoSchema = z.object({
  objectives: z.array(CreateLearningObjectiveSchema).min(1, 'At least one objective is required.').max(2000),
});
export type BulkSyncLoDto = z.infer<typeof BulkSyncLoSchema>;

export const UpdateLearningObjectiveSchema = z.object({
  statement:  z.string().trim().min(10).max(2000).optional(),
  bloomLevel: z.enum(BLOOM).optional(),
  measurable: z.boolean().optional(),
  keywords:   z.array(z.string().trim().max(50)).max(30).optional(),
  changeSummary: z.string().trim().max(500).optional(),
  bumpMajor:  z.boolean().default(false),
}).refine((d) => Object.keys(d).some((k) => k !== 'changeSummary' && k !== 'bumpMajor' && d[k as keyof typeof d] !== undefined), {
  message: 'At least one field must be provided.',
});
export type UpdateLearningObjectiveDto = z.infer<typeof UpdateLearningObjectiveSchema>;

export const LoSearchSchema = z.object({
  subjectCode: z.string().trim().toUpperCase().min(2).max(10).optional(),
  topicCode:   z.string().trim().optional(),
  status:      z.enum(['draft', 'in_review', 'approved', 'published', 'deprecated', 'archived']).optional(),
  bloomLevel:  z.enum(BLOOM).optional(),
  q:           z.string().trim().max(200).optional(),
  cursor:      z.string().uuid().optional(),
  limit:       z.coerce.number().int().min(1).max(200).default(20),
});
export type LoSearchDto = z.infer<typeof LoSearchSchema>;

export class CreateLearningObjectiveDtoClass {
  @ApiProperty({ example: 'STR' }) subjectCode!: string;
  @ApiProperty({ example: 1 }) topicCode!: number;
  @ApiProperty({ example: 3 }) subtopicCode!: number;
  @ApiProperty({ example: 1 }) sequenceNumber!: number;
  @ApiProperty({ example: 'Calculate normal stress in an axially loaded member.' }) statement!: string;
  @ApiPropertyOptional({ enum: BLOOM, default: 'apply' }) bloomLevel?: string;
  @ApiPropertyOptional({ default: true }) measurable?: boolean;
  @ApiPropertyOptional({ type: [String] }) keywords?: string[];
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() sourceDocumentId?: string;
}
export class UpdateLearningObjectiveDtoClass {
  @ApiPropertyOptional() statement?: string;
  @ApiPropertyOptional({ enum: BLOOM }) bloomLevel?: string;
  @ApiPropertyOptional() measurable?: boolean;
  @ApiPropertyOptional({ type: [String] }) keywords?: string[];
  @ApiPropertyOptional() changeSummary?: string;
  @ApiPropertyOptional({ default: false, description: 'Bump the major version instead of minor.' }) bumpMajor?: boolean;
}
export class LoSearchQueryDto {
  @ApiPropertyOptional({ example: 'STR' }) subjectCode?: string;
  @ApiPropertyOptional() topicCode?: string;
  @ApiPropertyOptional({ enum: ['draft', 'in_review', 'approved', 'published', 'deprecated', 'archived'] }) status?: string;
  @ApiPropertyOptional({ enum: BLOOM }) bloomLevel?: string;
  @ApiPropertyOptional() q?: string;
  @ApiPropertyOptional() cursor?: string;
  @ApiPropertyOptional({ type: Number }) limit?: number;
}
