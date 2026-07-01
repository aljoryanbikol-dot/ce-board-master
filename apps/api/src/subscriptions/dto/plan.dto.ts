/**
 * @file plan.dto.ts
 * @module Subscriptions/Dto
 *
 * Plan management DTOs (admin) + public plan representation.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TIERS = ['free', 'basic', 'pro'] as const;
const INTERVALS = ['free', 'monthly', 'quarterly', 'annual', 'lifetime', 'custom'] as const;

const PlanLimitsSchema = z.object({
  maxQuestions: z.coerce.number().int().min(0).optional(),
  maxMockExams: z.coerce.number().int().min(0).optional(),
  contentPreviewItems: z.coerce.number().int().min(0).optional(),
}).nullable();

export const CreatePlanSchema = z.object({
  name:            z.string().trim().min(2).max(120),
  slug:            z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]*$/).max(60),
  tier:            z.enum(TIERS),
  interval:        z.enum(INTERVALS),
  priceMinor:      z.coerce.number().int().min(0),
  currency:        z.string().length(3).default('PHP'),
  durationDays:    z.coerce.number().int().min(1).max(36500).nullable().optional(),
  /** Only meaningful when interval='custom' — every purchase expires on this
   * exact date regardless of purchase date (e.g. "valid until the next board
   * exam"). ISO date string. */
  fixedExpiryDate: z.coerce.date().nullable().optional(),
  trialDays:       z.coerce.number().int().min(0).max(365).default(0),
  features:        z.array(z.string()).default([]),
  /** Free-tier usage caps. Null/omitted = unlimited (paid plans). */
  limits:          PlanLimitsSchema.optional(),
  sortOrder:       z.coerce.number().int().min(0).max(999).default(0),
});
export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;

export const UpdatePlanSchema = z.object({
  name:            z.string().trim().min(2).max(120).optional(),
  priceMinor:      z.coerce.number().int().min(0).optional(),
  durationDays:    z.coerce.number().int().min(1).max(36500).nullable().optional(),
  fixedExpiryDate: z.coerce.date().nullable().optional(),
  features:        z.array(z.string()).optional(),
  limits:          PlanLimitsSchema.optional(),
  trialDays:       z.coerce.number().int().min(0).max(365).optional(),
  isActive:        z.boolean().optional(),
  sortOrder:       z.coerce.number().int().min(0).max(999).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required.' });
export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;

export class CreatePlanDtoClass {
  @ApiProperty({ example: 'Premium Monthly' }) name!: string;
  @ApiProperty({ example: 'premium_monthly' }) slug!: string;
  @ApiProperty({ enum: TIERS, example: 'pro' }) tier!: string;
  @ApiProperty({ enum: INTERVALS, example: 'monthly' }) interval!: string;
  @ApiProperty({ example: 19900, description: 'Price in minor units (centavos).' }) priceMinor!: number;
  @ApiPropertyOptional({ example: 'PHP' }) currency?: string;
  @ApiPropertyOptional({ example: 30, description: 'Duration in days. Null for lifetime/custom.' }) durationDays?: number | null;
  @ApiPropertyOptional({ description: "For interval='custom' only — fixed date every purchase expires on." }) fixedExpiryDate?: string | null;
  @ApiPropertyOptional({ example: 0 }) trialDays?: number;
  @ApiPropertyOptional({ type: [String], example: ['unlimited_questions', 'ai_tutor'] }) features?: string[];
  @ApiPropertyOptional({ description: 'Free-tier usage caps. Omit/null for unlimited.', example: { maxQuestions: 100, maxMockExams: 1, contentPreviewItems: 10 } }) limits?: Record<string, number> | null;
  @ApiPropertyOptional({ example: 10 }) sortOrder?: number;
}

export class UpdatePlanDtoClass {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional({ example: 19900 }) priceMinor?: number;
  @ApiPropertyOptional() durationDays?: number | null;
  @ApiPropertyOptional() fixedExpiryDate?: string | null;
  @ApiPropertyOptional({ type: [String] }) features?: string[];
  @ApiPropertyOptional() limits?: Record<string, number> | null;
  @ApiPropertyOptional() trialDays?: number;
  @ApiPropertyOptional() isActive?: boolean;
  @ApiPropertyOptional() sortOrder?: number;
}

export class PlanDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ example: 'pro' }) tier!: string;
  @ApiProperty({ example: 'monthly' }) interval!: string;
  @ApiProperty({ example: 19900 }) priceMinor!: number;
  @ApiProperty({ example: 'PHP' }) currency!: string;
  @ApiPropertyOptional() durationDays?: number | null;
  @ApiPropertyOptional() fixedExpiryDate?: string | null;
  @ApiProperty({ example: 7 }) trialDays!: number;
  @ApiProperty({ type: [String] }) features!: string[];
  @ApiPropertyOptional() limits?: Record<string, number> | null;
  @ApiProperty() isActive!: boolean;
}
