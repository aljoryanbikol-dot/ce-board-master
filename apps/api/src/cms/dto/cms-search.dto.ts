/**
 * @file cms-search.dto.ts
 * @module Cms/Dto
 *
 * Advanced CMS search query — a superset of the Question Bank search with
 * date-range and reviewer/assignment filters used by the CMS queues.
 */
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PAGINATION } from '../../common/constants';

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
const STATUSES = ['draft', 'in_review', 'approved', 'published', 'archived', 'flagged'] as const;

export const CmsSearchSchema = z.object({
  cursor:            z.string().uuid().optional(),
  limit:             z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT_ADMIN).default(PAGINATION.DEFAULT_LIMIT),
  subjectId:         z.string().uuid().optional(),
  topicId:           z.string().uuid().optional(),
  subtopicId:        z.string().uuid().optional(),
  difficultyLevelId: z.string().uuid().optional(),
  learningObjective: z.string().trim().max(200).optional(),
  bloomLevel:        z.enum(BLOOM_LEVELS).optional(),
  status:            z.enum(STATUSES).optional(),
  authorId:          z.string().uuid().optional(),
  reviewerId:        z.string().uuid().optional(),
  tag:               z.string().uuid().optional(),
  q:                 z.string().trim().max(200).optional(),
  createdFrom:       z.string().datetime().optional(),
  createdTo:         z.string().datetime().optional(),
  updatedFrom:       z.string().datetime().optional(),
  updatedTo:         z.string().datetime().optional(),
});
export type CmsSearchDto = z.infer<typeof CmsSearchSchema>;

export class CmsSearchQueryDto {
  @ApiPropertyOptional() cursor?: string;
  @ApiPropertyOptional({ type: Number, example: 20 }) limit?: number;
  @ApiPropertyOptional() subjectId?: string;
  @ApiPropertyOptional() topicId?: string;
  @ApiPropertyOptional() subtopicId?: string;
  @ApiPropertyOptional() difficultyLevelId?: string;
  @ApiPropertyOptional() learningObjective?: string;
  @ApiPropertyOptional({ enum: BLOOM_LEVELS }) bloomLevel?: string;
  @ApiPropertyOptional({ enum: STATUSES }) status?: string;
  @ApiPropertyOptional() authorId?: string;
  @ApiPropertyOptional() reviewerId?: string;
  @ApiPropertyOptional({ description: 'Tag UUID' }) tag?: string;
  @ApiPropertyOptional({ description: 'Free-text over stem/keywords/code' }) q?: string;
  @ApiPropertyOptional({ description: 'ISO date — created on/after' }) createdFrom?: string;
  @ApiPropertyOptional({ description: 'ISO date — created on/before' }) createdTo?: string;
  @ApiPropertyOptional({ description: 'ISO date — updated on/after' }) updatedFrom?: string;
  @ApiPropertyOptional({ description: 'ISO date — updated on/before' }) updatedTo?: string;
}
