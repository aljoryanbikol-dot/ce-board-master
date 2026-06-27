/**
 * @file ai.dto.ts
 * @module AI/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DIFFICULTY_BANDS, AI_LIMITS } from '../constants/ai.constants';

const DIFFICULTY = DIFFICULTY_BANDS as unknown as [string, ...string[]];

/** Generate question(s) from a Learning Objective. */
export const GenerateFromLoSchema = z.object({
  learningObjectiveId: z.string().trim().toUpperCase().regex(/^LO-[A-Z]{3}-\d{3}-\d{3}-\d{3}$/, 'Must be a valid LO public ID.'),
  difficultyBand:      z.enum(DIFFICULTY).default('moderate'),
  variantType:         z.enum(['base', 'numerical', 'conceptual']).default('base'),
  count:               z.coerce.number().int().min(1).max(AI_LIMITS.MAX_VARIANTS_PER_REQUEST).default(1),
  seed:                z.string().trim().max(64).optional(),
});
export type GenerateFromLoDto = z.infer<typeof GenerateFromLoSchema>;

/** Generate question(s) from a Blueprint. */
export const GenerateFromBlueprintSchema = z.object({
  blueprintId:    z.string().trim().toUpperCase().regex(/^BP-[A-Z]{3}-\d{3}-\d{3}-[A-Z]{3}-\d{3}$/, 'Must be a valid Blueprint public ID.'),
  difficultyBand: z.enum(DIFFICULTY).default('moderate'),
  count:          z.coerce.number().int().min(1).max(AI_LIMITS.MAX_VARIANTS_PER_REQUEST).default(1),
  seed:           z.string().trim().max(64).optional(),
});
export type GenerateFromBlueprintDto = z.infer<typeof GenerateFromBlueprintSchema>;

/** Generate numerical/conceptual variants of an existing generation. */
export const GenerateVariantsSchema = z.object({
  sourceRequestId: z.string().uuid(),
  variantType:     z.enum(['numerical', 'conceptual']),
  count:           z.coerce.number().int().min(1).max(AI_LIMITS.MAX_VARIANTS_PER_REQUEST).default(AI_LIMITS.DEFAULT_VARIANT_COUNT),
  seed:            z.string().trim().max(64).optional(),
});
export type GenerateVariantsDto = z.infer<typeof GenerateVariantsSchema>;

/** Generate distractors for a stem grounded in a Learning Objective. */
export const GenerateDistractorsSchema = z.object({
  learningObjectiveId: z.string().trim().toUpperCase().regex(/^LO-[A-Z]{3}-\d{3}-\d{3}-\d{3}$/),
  count:               z.coerce.number().int().min(AI_LIMITS.MIN_DISTRACTORS).max(AI_LIMITS.MAX_DISTRACTORS).default(3),
  seed:                z.string().trim().max(64).optional(),
});
export type GenerateDistractorsDto = z.infer<typeof GenerateDistractorsSchema>;

/** Promote a validated generation into the Question Bank as a draft. */
export const PromoteGenerationSchema = z.object({
  variantIndex: z.coerce.number().int().min(0).default(0),
  questionCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9\-]{3,30}$/).optional(),
});
export type PromoteGenerationDto = z.infer<typeof PromoteGenerationSchema>;

export const ListGenerationsSchema = z.object({
  status: z.enum(['pending', 'generating', 'validating', 'validated', 'rejected', 'promoted', 'failed']).optional(),
  kind:   z.string().trim().optional(),
  cursor: z.string().uuid().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});
export type ListGenerationsDto = z.infer<typeof ListGenerationsSchema>;

// ── Swagger classes ────────────────────────────────────────────────────────────

export class GenerateFromLoDtoClass {
  @ApiProperty({ example: 'LO-STR-001-003-001' }) learningObjectiveId!: string;
  @ApiPropertyOptional({ enum: DIFFICULTY_BANDS, default: 'moderate' }) difficultyBand?: string;
  @ApiPropertyOptional({ enum: ['base', 'numerical', 'conceptual'], default: 'base' }) variantType?: string;
  @ApiPropertyOptional({ type: Number, default: 1 }) count?: number;
  @ApiPropertyOptional() seed?: string;
}
export class GenerateFromBlueprintDtoClass {
  @ApiProperty({ example: 'BP-STR-004-002-CMP-001' }) blueprintId!: string;
  @ApiPropertyOptional({ enum: DIFFICULTY_BANDS, default: 'moderate' }) difficultyBand?: string;
  @ApiPropertyOptional({ type: Number, default: 1 }) count?: number;
  @ApiPropertyOptional() seed?: string;
}
export class GenerateVariantsDtoClass {
  @ApiProperty() sourceRequestId!: string;
  @ApiProperty({ enum: ['numerical', 'conceptual'] }) variantType!: string;
  @ApiPropertyOptional({ type: Number, default: 3 }) count?: number;
  @ApiPropertyOptional() seed?: string;
}
export class GenerateDistractorsDtoClass {
  @ApiProperty({ example: 'LO-STR-001-003-001' }) learningObjectiveId!: string;
  @ApiPropertyOptional({ type: Number, default: 3 }) count?: number;
  @ApiPropertyOptional() seed?: string;
}
export class PromoteGenerationDtoClass {
  @ApiPropertyOptional({ type: Number, default: 0 }) variantIndex?: number;
  @ApiPropertyOptional() questionCode?: string;
}
export class ListGenerationsQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'generating', 'validating', 'validated', 'rejected', 'promoted', 'failed'] }) status?: string;
  @ApiPropertyOptional() kind?: string;
  @ApiPropertyOptional() cursor?: string;
  @ApiPropertyOptional({ type: Number }) limit?: number;
}
