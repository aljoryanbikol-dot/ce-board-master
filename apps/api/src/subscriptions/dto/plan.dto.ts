/**
 * @file plan.dto.ts
 * @module Subscriptions/Dto
 *
 * Plan management DTOs (admin) + public plan representation.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TIERS = ['free', 'basic', 'pro'] as const;
const INTERVALS = ['free', 'monthly', 'quarterly', 'annual', 'lifetime'] as const;

export const CreatePlanSchema = z.object({
  name:         z.string().trim().min(2).max(120),
  slug:         z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]*$/).max(60),
  tier:         z.enum(TIERS),
  interval:     z.enum(INTERVALS),
  priceMinor:   z.coerce.number().int().min(0),
  currency:     z.string().length(3).default('PHP'),
  durationDays: z.coerce.number().int().min(1).max(36500).nullable().optional(),
  trialDays:    z.coerce.number().int().min(0).max(365).default(0),
  features:     z.array(z.string()).default([]),
  sortOrder:    z.coerce.number().int().min(0).max(999).default(0),
});
export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;

export const UpdatePlanSchema = z.object({
  name:       z.string().trim().min(2).max(120).optional(),
  priceMinor: z.coerce.number().int().min(0).optional(),
  features:   z.array(z.string()).optional(),
  trialDays:  z.coerce.number().int().min(0).max(365).optional(),
  isActive:   z.boolean().optional(),
  sortOrder:  z.coerce.number().int().min(0).max(999).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required.' });
export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;

export class CreatePlanDtoClass {
  @ApiProperty({ example: 'Pro Monthly' }) name!: string;
  @ApiProperty({ example: 'pro_monthly' }) slug!: string;
  @ApiProperty({ enum: TIERS, example: 'pro' }) tier!: string;
  @ApiProperty({ enum: INTERVALS, example: 'monthly' }) interval!: string;
  @ApiProperty({ example: 49900, description: 'Price in minor units (centavos).' }) priceMinor!: number;
  @ApiPropertyOptional({ example: 'PHP' }) currency?: string;
  @ApiPropertyOptional({ example: 30, description: 'Duration in days. Null for lifetime.' }) durationDays?: number | null;
  @ApiPropertyOptional({ example: 7 }) trialDays?: number;
  @ApiPropertyOptional({ type: [String], example: ['unlimited_questions', 'ai_tutor'] }) features?: string[];
  @ApiPropertyOptional({ example: 10 }) sortOrder?: number;
}

export class UpdatePlanDtoClass {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional({ example: 59900 }) priceMinor?: number;
  @ApiPropertyOptional({ type: [String] }) features?: string[];
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
  @ApiProperty({ example: 49900 }) priceMinor!: number;
  @ApiProperty({ example: 'PHP' }) currency!: string;
  @ApiPropertyOptional() durationDays?: number | null;
  @ApiProperty({ example: 7 }) trialDays!: number;
  @ApiProperty({ type: [String] }) features!: string[];
  @ApiProperty() isActive!: boolean;
}
