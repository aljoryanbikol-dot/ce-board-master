/**
 * @file formula.dto.ts
 * @module Formulas/Dto
 *
 * DTOs for the Formula Library (Book 4). Wraps the EXISTING FormulaLibrary
 * model (Module 5) — no new table. The optional `formulaId` carries the
 * governing [Subject]-F-#### identifier, validated against the spec.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const VariableSchema = z.object({
  symbol:      z.string().trim().min(1).max(20),
  name:        z.string().trim().min(1).max(120),
  unit:        z.string().trim().max(40).optional(),
  description: z.string().trim().max(300).optional(),
});

export const CreateFormulaSchema = z.object({
  formulaId:           z.string().trim().toUpperCase().optional(), // [Subject]-F-#### (validated against spec)
  name:                z.string().trim().min(3).max(200),
  subjectId:           z.string().uuid(),
  topicId:             z.string().uuid().optional(),
  expressionText:      z.string().trim().min(1).max(2000),
  expressionLatex:     z.string().trim().min(1).max(2000),
  variables:           z.array(VariableSchema).default([]),
  unitsSystem:         z.string().trim().max(10).default('SI'),
  imperialExpression:  z.string().trim().max(2000).optional(),
  derivation:          z.string().trim().max(8000).optional(),
  assumptions:         z.array(z.string().trim().max(300)).default([]),
  limitations:         z.string().trim().max(2000).optional(),
  typicalApplications: z.array(z.string().trim().max(200)).default([]),
  exampleProblem:      z.string().trim().max(8000).optional(),
});
export type CreateFormulaDto = z.infer<typeof CreateFormulaSchema>;

export const UpdateFormulaSchema = CreateFormulaSchema.partial().omit({ formulaId: true });
export type UpdateFormulaDto = z.infer<typeof UpdateFormulaSchema>;

/**
 * Idempotent sync of formulas authored in the Knowledge Library. Matches on the
 * natural key (name/slug): existing formulas are updated, new ones created — so
 * re-importing the same Library export never duplicates.
 */
// Sync items may identify the subject by code (Library-friendly) OR by uuid.
export const FormulaSyncItemSchema = CreateFormulaSchema.extend({
  subjectId: z.string().uuid().optional(),
  subjectCode: z.string().trim().max(20).optional(),
}).refine((d) => d.subjectId || d.subjectCode, { message: 'subjectId or subjectCode is required.' });
export type FormulaSyncItem = z.infer<typeof FormulaSyncItemSchema>;

export const BulkSyncFormulaSchema = z.object({
  formulas: z.array(FormulaSyncItemSchema).min(1, 'At least one formula is required.').max(1000),
});
export type BulkSyncFormulaDto = z.infer<typeof BulkSyncFormulaSchema>;

export const FormulaSearchSchema = z.object({
  subjectId: z.string().uuid().optional(),
  q:         z.string().trim().max(200).optional(),
  cursor:    z.string().uuid().optional(),
  limit:     z.coerce.number().int().min(1).max(200).default(20),
});
export type FormulaSearchDto = z.infer<typeof FormulaSearchSchema>;

export class FormulaVariableDtoClass {
  @ApiProperty({ example: 'σ' }) symbol!: string;
  @ApiProperty({ example: 'Normal Stress' }) name!: string;
  @ApiPropertyOptional({ example: 'MPa' }) unit?: string;
  @ApiPropertyOptional() description?: string;
}
export class CreateFormulaDtoClass {
  @ApiPropertyOptional({ example: 'ST-F-0015', description: 'Governing Formula ID ([Subject]-F-####).' }) formulaId?: string;
  @ApiProperty({ example: 'Normal Stress Equation' }) name!: string;
  @ApiProperty() subjectId!: string;
  @ApiPropertyOptional() topicId?: string;
  @ApiProperty({ example: 'σ = P / A' }) expressionText!: string;
  @ApiProperty({ example: '\\sigma = \\frac{P}{A}' }) expressionLatex!: string;
  @ApiPropertyOptional({ type: [FormulaVariableDtoClass] }) variables?: FormulaVariableDtoClass[];
  @ApiPropertyOptional({ default: 'SI' }) unitsSystem?: string;
  @ApiPropertyOptional() imperialExpression?: string;
  @ApiPropertyOptional() derivation?: string;
  @ApiPropertyOptional({ type: [String] }) assumptions?: string[];
  @ApiPropertyOptional() limitations?: string;
  @ApiPropertyOptional({ type: [String] }) typicalApplications?: string[];
  @ApiPropertyOptional() exampleProblem?: string;
}
export class UpdateFormulaDtoClass {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional() expressionText?: string;
  @ApiPropertyOptional() expressionLatex?: string;
  @ApiPropertyOptional({ type: [FormulaVariableDtoClass] }) variables?: FormulaVariableDtoClass[];
  @ApiPropertyOptional({ type: [String] }) assumptions?: string[];
  @ApiPropertyOptional({ type: [String] }) typicalApplications?: string[];
}
export class FormulaSearchQueryDto {
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() q?: string;
  @ApiPropertyOptional() cursor?: string;
  @ApiPropertyOptional({ type: Number }) limit?: number;
}
