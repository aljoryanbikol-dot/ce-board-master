/**
 * @file misconception.dto.ts
 * @module Misconceptions/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MISCONCEPTION_CATEGORY_CODES } from '../../knowledge/constants/knowledge.constants';

const CATEGORIES = Object.keys(MISCONCEPTION_CATEGORY_CODES) as [string, ...string[]];

export const CreateMisconceptionSchema = z.object({
  subjectCode:    z.string().trim().toUpperCase().length(3),
  topicCode:      z.coerce.number().int().min(0).max(999),
  subtopicCode:   z.coerce.number().int().min(0).max(999),
  category:       z.enum(CATEGORIES),
  sequenceNumber: z.coerce.number().int().min(1).max(999),
  title:          z.string().trim().min(3).max(300),
  description:    z.string().trim().min(10).max(4000),
  whyItHappens:   z.string().trim().max(4000).optional(),
  correction:     z.string().trim().max(4000).optional(),
  primaryObjectiveId: z.string().uuid().optional(),
  sourceDocumentId: z.string().uuid().optional(),
});
export type CreateMisconceptionDto = z.infer<typeof CreateMisconceptionSchema>;

export const MisconceptionSearchSchema = z.object({
  subjectCode: z.string().trim().toUpperCase().length(3).optional(),
  category:    z.enum(CATEGORIES).optional(),
  status:      z.enum(['draft', 'in_review', 'approved', 'published', 'deprecated', 'archived']).optional(),
  q:           z.string().trim().max(200).optional(),
  cursor:      z.string().uuid().optional(),
  limit:       z.coerce.number().int().min(1).max(200).default(20),
});
export type MisconceptionSearchDto = z.infer<typeof MisconceptionSearchSchema>;

export class CreateMisconceptionDtoClass {
  @ApiProperty({ example: 'STR' }) subjectCode!: string;
  @ApiProperty({ example: 3 }) topicCode!: number;
  @ApiProperty({ example: 2 }) subtopicCode!: number;
  @ApiProperty({ enum: CATEGORIES, example: 'FRM' }) category!: string;
  @ApiProperty({ example: 1 }) sequenceNumber!: number;
  @ApiProperty({ example: 'Confusing stress and strain in axial loading' }) title!: string;
  @ApiProperty({ example: 'Students apply the stress formula where strain is required.' }) description!: string;
  @ApiPropertyOptional() whyItHappens?: string;
  @ApiPropertyOptional() correction?: string;
  @ApiPropertyOptional() primaryObjectiveId?: string;
  @ApiPropertyOptional() sourceDocumentId?: string;
}
export class MisconceptionSearchQueryDto {
  @ApiPropertyOptional() subjectCode?: string;
  @ApiPropertyOptional({ enum: CATEGORIES }) category?: string;
  @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional() q?: string;
  @ApiPropertyOptional() cursor?: string;
  @ApiPropertyOptional({ type: Number }) limit?: number;
}
