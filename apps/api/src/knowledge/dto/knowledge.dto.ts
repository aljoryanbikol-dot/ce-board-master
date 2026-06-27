/**
 * @file knowledge.dto.ts
 * @module Knowledge/Dto
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BOOK_DOCUMENT_TYPES } from '../constants/knowledge.constants';

const BOOK_NUMBERS = Object.keys(BOOK_DOCUMENT_TYPES).map(Number) as [number, ...number[]];

/** Ingest (or re-version) an enterprise document from its extracted text. */
export const IngestDocumentSchema = z.object({
  bookNumber:    z.coerce.number().int().min(1).max(15),
  title:         z.string().trim().min(3).max(300),
  contentText:   z.string().trim().min(50, 'Document content is required (extracted text).'),
  description:   z.string().trim().max(2000).optional(),
  ownerTeam:     z.string().trim().max(120).optional(),
  changeSummary: z.string().trim().max(500).optional(),
  semver:        z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
});
export type IngestDocumentDto = z.infer<typeof IngestDocumentSchema>;

export const CreateCrossReferenceSchema = z.object({
  referenceType: z.enum([
    'lo_to_formula', 'lo_to_blueprint', 'lo_to_misconception', 'blueprint_to_lo',
    'blueprint_to_formula', 'misconception_to_lo', 'formula_to_lo', 'document_to_entity', 'lo_prerequisite',
  ]),
  fromType:     z.string().trim().max(30),
  fromId:       z.string().uuid(),
  fromPublicId: z.string().trim().max(50).optional(),
  toType:       z.string().trim().max(30),
  toId:         z.string().uuid(),
  toPublicId:   z.string().trim().max(50).optional(),
  weight:       z.coerce.number().int().min(1).max(100).default(1),
  note:         z.string().trim().max(1000).optional(),
});
export type CreateCrossReferenceDto = z.infer<typeof CreateCrossReferenceSchema>;

export const KnowledgeSearchSchema = z.object({
  q:      z.string().trim().min(1).max(200),
  types:  z.string().trim().optional(), // comma-separated entity types
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});
export type KnowledgeSearchDto = z.infer<typeof KnowledgeSearchSchema>;

// ── Swagger classes ────────────────────────────────────────────────────────────

export class IngestDocumentDtoClass {
  @ApiProperty({ enum: BOOK_NUMBERS, example: 11, description: 'Book number (1–15).' }) bookNumber!: number;
  @ApiProperty({ example: 'Learning Objectives Master Library' }) title!: string;
  @ApiProperty({ description: 'Extracted plain text of the document.' }) contentText!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() ownerTeam?: string;
  @ApiPropertyOptional() changeSummary?: string;
  @ApiPropertyOptional({ example: '2.0.0' }) semver?: string;
}

export class CreateCrossReferenceDtoClass {
  @ApiProperty({ example: 'lo_to_formula' }) referenceType!: string;
  @ApiProperty({ example: 'learning_objective' }) fromType!: string;
  @ApiProperty() fromId!: string;
  @ApiPropertyOptional({ example: 'LO-STR-001-003-001' }) fromPublicId?: string;
  @ApiProperty({ example: 'formula' }) toType!: string;
  @ApiProperty() toId!: string;
  @ApiPropertyOptional({ example: 'ST-F-0015' }) toPublicId?: string;
  @ApiPropertyOptional({ default: 1 }) weight?: number;
  @ApiPropertyOptional() note?: string;
}

export class KnowledgeSearchQueryDto {
  @ApiProperty({ description: 'Free-text query.' }) q!: string;
  @ApiPropertyOptional({ description: 'Comma-separated entity types to include.' }) types?: string;
  @ApiPropertyOptional({ type: Number, example: 20 }) limit?: number;
}
