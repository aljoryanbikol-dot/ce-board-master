/**
 * @file blueprint.dto.ts
 * @module Blueprints/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BLUEPRINT_TYPE_CODES } from '../../knowledge/constants/knowledge.constants';

const TYPES = Object.keys(BLUEPRINT_TYPE_CODES) as [string, ...string[]];

export const CreateBlueprintSchema = z.object({
  subjectCode:    z.string().trim().toUpperCase().length(3),
  topicCode:      z.coerce.number().int().min(0).max(999),
  subtopicCode:   z.coerce.number().int().min(0).max(999),
  blueprintType:  z.enum(TYPES),
  sequenceNumber: z.coerce.number().int().min(1).max(999),
  name:           z.string().trim().min(3).max(300),
  description:    z.string().trim().max(4000).optional(),
  primaryObjectiveId: z.string().uuid().optional(),
  structure:      z.record(z.unknown()).default({}),
  difficultyBand: z.string().trim().max(20).optional(),
  sourceDocumentId: z.string().uuid().optional(),
});
export type CreateBlueprintDto = z.infer<typeof CreateBlueprintSchema>;

export const BlueprintSearchSchema = z.object({
  subjectCode:   z.string().trim().toUpperCase().length(3).optional(),
  blueprintType: z.enum(TYPES).optional(),
  status:        z.enum(['draft', 'in_review', 'approved', 'published', 'deprecated', 'archived']).optional(),
  q:             z.string().trim().max(200).optional(),
  cursor:        z.string().uuid().optional(),
  limit:         z.coerce.number().int().min(1).max(200).default(20),
});
export type BlueprintSearchDto = z.infer<typeof BlueprintSearchSchema>;

export class CreateBlueprintDtoClass {
  @ApiProperty({ example: 'STR' }) subjectCode!: string;
  @ApiProperty({ example: 4 }) topicCode!: number;
  @ApiProperty({ example: 2 }) subtopicCode!: number;
  @ApiProperty({ enum: TYPES, example: 'CMP' }) blueprintType!: string;
  @ApiProperty({ example: 1 }) sequenceNumber!: number;
  @ApiProperty({ example: 'Axial stress computation blueprint' }) name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() primaryObjectiveId?: string;
  @ApiPropertyOptional({ type: Object }) structure?: Record<string, unknown>;
  @ApiPropertyOptional() difficultyBand?: string;
  @ApiPropertyOptional() sourceDocumentId?: string;
}
export class BlueprintSearchQueryDto {
  @ApiPropertyOptional() subjectCode?: string;
  @ApiPropertyOptional({ enum: TYPES }) blueprintType?: string;
  @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional() q?: string;
  @ApiPropertyOptional() cursor?: string;
  @ApiPropertyOptional({ type: Number }) limit?: number;
}
