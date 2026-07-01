/**
 * @file platform-analytics.dto.ts
 * @module PlatformAnalytics/Dto
 */
import { z } from 'zod';

export const PlatformAnalyticsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  days:   z.coerce.number().int().min(1).max(365).default(30),
});
export type PlatformAnalyticsQueryDto = z.infer<typeof PlatformAnalyticsQuerySchema>;

export const TopListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type TopListQueryDto = z.infer<typeof TopListQuerySchema>;
