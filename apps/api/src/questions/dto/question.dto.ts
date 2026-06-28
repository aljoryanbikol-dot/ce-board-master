/**
 * @file question.dto.ts
 * @module Questions/Dto
 *
 * Zod schemas + Swagger DTO classes for question CRUD.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHOICE_LETTERS } from '../constants/questions.constants';

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
// Must mirror the Prisma `QuestionType` enum (prisma/schema.prisma).
const QUESTION_TYPES = ['multiple_choice', 'computation', 'diagram_based'] as const;

// ── Choice sub-schema ─────────────────────────────────────────────────────────

const ChoiceSchema = z.object({
  letter:      z.enum(CHOICE_LETTERS),
  text:        z.string().trim().min(1, 'Choice text is required.').max(2000),
  latex:       z.string().trim().max(4000).nullable().optional(),
  html:        z.string().trim().max(8000).nullable().optional(),
  explanation: z.string().trim().max(2000).nullable().optional(),
  sortOrder:   z.coerce.number().int().min(0).max(9).optional(),
});

// ── Create ────────────────────────────────────────────────────────────────────

export const CreateQuestionSchema = z.object({
  questionCode:      z.string().trim().toUpperCase().regex(/^[A-Z0-9\-]{3,30}$/, 'Question code must be 3–30 chars: A–Z, 0–9, hyphen.'),
  subjectId:         z.string().uuid(),
  topicId:           z.string().uuid(),
  subtopicId:        z.string().uuid(),
  difficultyLevelId: z.string().uuid(),
  stemText:          z.string().trim().min(10, 'Stem must be at least 10 characters.').max(8000),
  stemLatex:         z.string().trim().max(16000).nullable().optional(),
  stemHtml:          z.string().trim().max(32000).nullable().optional(),
  choices:           z.array(ChoiceSchema).length(4, 'Exactly four choices (A–D) are required.'),
  correctChoice:     z.enum(CHOICE_LETTERS),
  explanationText:   z.string().trim().min(10, 'Explanation must be at least 10 characters.').max(8000),
  explanationLatex:  z.string().trim().max(16000).nullable().optional(),
  explanationHtml:   z.string().trim().max(32000).nullable().optional(),
  bloomLevel:        z.enum(BLOOM_LEVELS).default('apply'),
  questionType:      z.enum(QUESTION_TYPES).default('multiple_choice'),
  learningObjective: z.string().trim().max(1000).nullable().optional(),
  prcSyllabusRef:    z.string().trim().max(100).nullable().optional(),
  estSolvingTimeSec: z.coerce.number().int().min(5).max(3600).default(90),
  language:          z.string().trim().length(2).default('en'),
  keywords:          z.array(z.string().trim().max(50)).max(30).default([]),
  tags:              z.array(z.string().uuid()).max(30).default([]),
  isAiGenerated:     z.boolean().default(false),
}).superRefine((data, ctx) => {
  // Correct choice must exist among the provided letters
  const letters = data.choices.map((c) => c.letter);
  if (!letters.includes(data.correctChoice)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctChoice'], message: 'correctChoice must match one of the provided choice letters.' });
  }
  // Choice letters must be unique and exactly A–D
  const unique = new Set(letters);
  if (unique.size !== letters.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['choices'], message: 'Choice letters must be unique.' });
  }
});
export type CreateQuestionDto = z.infer<typeof CreateQuestionSchema>;

// ── Update (partial; optimistic-locked) ────────────────────────────────────────

export const UpdateQuestionSchema = z.object({
  stemText:          z.string().trim().min(10).max(8000).optional(),
  stemLatex:         z.string().trim().max(16000).nullable().optional(),
  stemHtml:          z.string().trim().max(32000).nullable().optional(),
  choices:           z.array(ChoiceSchema).length(4).optional(),
  correctChoice:     z.enum(CHOICE_LETTERS).optional(),
  explanationText:   z.string().trim().min(10).max(8000).optional(),
  explanationLatex:  z.string().trim().max(16000).nullable().optional(),
  explanationHtml:   z.string().trim().max(32000).nullable().optional(),
  bloomLevel:        z.enum(BLOOM_LEVELS).optional(),
  questionType:      z.enum(QUESTION_TYPES).optional(),
  learningObjective: z.string().trim().max(1000).nullable().optional(),
  prcSyllabusRef:    z.string().trim().max(100).nullable().optional(),
  estSolvingTimeSec: z.coerce.number().int().min(5).max(3600).optional(),
  difficultyLevelId: z.string().uuid().optional(),
  subtopicId:        z.string().uuid().optional(),
  keywords:          z.array(z.string().trim().max(50)).max(30).optional(),
  tags:              z.array(z.string().uuid()).max(30).optional(),
  changeSummary:     z.string().trim().max(500).optional(),
  /** Optimistic locking — the currentVersion the client last read. */
  version:           z.coerce.number().int().min(1).optional(),
}).refine(
  (d) => Object.keys(d).some((k) => k !== 'version' && k !== 'changeSummary' && d[k as keyof typeof d] !== undefined),
  { message: 'At least one updatable field must be provided.' },
);
export type UpdateQuestionDto = z.infer<typeof UpdateQuestionSchema>;

// ── Swagger DTO classes ────────────────────────────────────────────────────────

export class ChoiceDtoClass {
  @ApiProperty({ enum: CHOICE_LETTERS, example: 'A' }) letter!: string;
  @ApiProperty({ example: '9.81 m/s²' }) text!: string;
  @ApiPropertyOptional({ nullable: true }) latex?: string | null;
  @ApiPropertyOptional({ nullable: true }) html?: string | null;
  @ApiPropertyOptional({ nullable: true }) explanation?: string | null;
  @ApiPropertyOptional({ example: 0 }) sortOrder?: number;
}

export class CreateQuestionDtoClass {
  @ApiProperty({ example: 'HYD-FLOW-001' }) questionCode!: string;
  @ApiProperty() subjectId!: string;
  @ApiProperty() topicId!: string;
  @ApiProperty() subtopicId!: string;
  @ApiProperty() difficultyLevelId!: string;
  @ApiProperty({ example: 'What is the acceleration due to gravity?' }) stemText!: string;
  @ApiPropertyOptional({ nullable: true }) stemLatex?: string | null;
  @ApiPropertyOptional({ nullable: true }) stemHtml?: string | null;
  @ApiProperty({ type: [ChoiceDtoClass] }) choices!: ChoiceDtoClass[];
  @ApiProperty({ enum: CHOICE_LETTERS, example: 'A' }) correctChoice!: string;
  @ApiProperty({ example: 'g equals 9.81 m/s² at sea level.' }) explanationText!: string;
  @ApiPropertyOptional({ nullable: true }) explanationLatex?: string | null;
  @ApiPropertyOptional({ nullable: true }) explanationHtml?: string | null;
  @ApiPropertyOptional({ enum: BLOOM_LEVELS, example: 'apply' }) bloomLevel?: string;
  @ApiPropertyOptional({ enum: QUESTION_TYPES, example: 'multiple_choice' }) questionType?: string;
  @ApiPropertyOptional({ nullable: true }) learningObjective?: string | null;
  @ApiPropertyOptional({ nullable: true }) prcSyllabusRef?: string | null;
  @ApiPropertyOptional({ example: 90 }) estSolvingTimeSec?: number;
  @ApiPropertyOptional({ example: 'en' }) language?: string;
  @ApiPropertyOptional({ type: [String] }) keywords?: string[];
  @ApiPropertyOptional({ type: [String], description: 'Tag UUIDs' }) tags?: string[];
  @ApiPropertyOptional({ example: false }) isAiGenerated?: boolean;
}

export class UpdateQuestionDtoClass {
  @ApiPropertyOptional() stemText?: string;
  @ApiPropertyOptional({ type: [ChoiceDtoClass] }) choices?: ChoiceDtoClass[];
  @ApiPropertyOptional({ enum: CHOICE_LETTERS }) correctChoice?: string;
  @ApiPropertyOptional() explanationText?: string;
  @ApiPropertyOptional({ enum: BLOOM_LEVELS }) bloomLevel?: string;
  @ApiPropertyOptional({ enum: QUESTION_TYPES }) questionType?: string;
  @ApiPropertyOptional({ nullable: true }) learningObjective?: string | null;
  @ApiPropertyOptional() difficultyLevelId?: string;
  @ApiPropertyOptional() subtopicId?: string;
  @ApiPropertyOptional({ type: [String] }) keywords?: string[];
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
  @ApiPropertyOptional({ description: 'Summary of what changed (recorded in version history).' }) changeSummary?: string;
  @ApiPropertyOptional({ example: 3, description: 'Optimistic locking version.' }) version?: number;
}

export class QuestionDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() questionCode!: string;
  @ApiProperty() subjectId!: string;
  @ApiProperty() topicId!: string;
  @ApiProperty() subtopicId!: string;
  @ApiProperty() difficultyLevelId!: string;
  @ApiProperty() stemText!: string;
  @ApiProperty({ example: 'draft' }) status!: string;
  @ApiProperty({ example: 'apply' }) bloomLevel!: string;
  @ApiProperty({ example: 'multiple_choice' }) questionType!: string;
  @ApiProperty() correctChoice!: string;
  @ApiProperty() explanationText!: string;
  @ApiProperty({ type: [ChoiceDtoClass] }) choices!: ChoiceDtoClass[];
  @ApiProperty() authorId!: string;
  @ApiPropertyOptional({ nullable: true }) reviewerId?: string | null;
  @ApiProperty() currentVersion!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Active review stage when in_review.' }) reviewStage?: string | null;
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
  @ApiPropertyOptional({ nullable: true }) publishedAt?: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
