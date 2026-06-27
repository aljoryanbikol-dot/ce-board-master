/**
 * @file search.dto.ts
 * @module Questions/Dto
 *
 * Query DTO for question search/filter + version history.
 */
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAGINATION } from '../../common/constants';

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
const STATUSES = ['draft', 'in_review', 'approved', 'published', 'archived', 'flagged'] as const;

export const SearchQuestionsSchema = z.object({
  cursor:            z.string().uuid().optional(),
  limit:             z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT_ADMIN).default(PAGINATION.DEFAULT_LIMIT),
  subjectId:         z.string().uuid().optional(),
  topicId:           z.string().uuid().optional(),
  subtopicId:        z.string().uuid().optional(),
  difficultyLevelId: z.string().uuid().optional(),
  bloomLevel:        z.enum(BLOOM_LEVELS).optional(),
  status:            z.enum(STATUSES).optional(),
  authorId:          z.string().uuid().optional(),
  reviewerId:        z.string().uuid().optional(),
  learningObjective: z.string().trim().max(200).optional(),
  tag:               z.string().uuid().optional(),
  q:                 z.string().trim().max(200).optional(), // free-text over stem/keywords
  isAiGenerated:     z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional()),
});
export type SearchQuestionsDto = z.infer<typeof SearchQuestionsSchema>;

export class SearchQuestionsQueryDto {
  @ApiPropertyOptional() cursor?: string;
  @ApiPropertyOptional({ type: Number, example: 20 }) limit?: number;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
  @ApiPropertyOptional() subtopicId?: string;
  @ApiPropertyOptional() difficultyLevelId?: string;
  @ApiPropertyOptional({ enum: BLOOM_LEVELS }) bloomLevel?: string;
  @ApiPropertyOptional({ enum: STATUSES }) status?: string;
  @ApiPropertyOptional() authorId?: string;
  @ApiPropertyOptional() reviewerId?: string;
  @ApiPropertyOptional() learningObjective?: string;
  @ApiPropertyOptional({ description: 'Tag UUID' }) tag?: string;
  @ApiPropertyOptional({ description: 'Free-text search over stem and keywords.' }) q?: string;
  @ApiPropertyOptional({ type: Boolean }) isAiGenerated?: boolean;
}
