/**
 * @file user.dto.ts
 * @module Users/Dto
 *
 * Zod schemas and Swagger DTO classes for Users endpoints.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PAGINATION } from '../../common/constants';

// ── Shared fields ─────────────────────────────────────────────────────────────

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3,  { message: 'Username must be at least 3 characters.' })
  .max(30, { message: 'Username must not exceed 30 characters.' })
  .regex(/^[a-z0-9_]+$/, { message: 'Username may contain only lowercase letters, digits, and underscores.' });

// ── GET /users — list query ───────────────────────────────────────────────────

export const ListUsersQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit:  z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT_ADMIN).default(PAGINATION.DEFAULT_LIMIT),
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  role:   z.string().trim().toLowerCase().optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional(),
  ),
});
export type ListUsersQueryDto = z.infer<typeof ListUsersQuerySchema>;

// ── PATCH /users/:id — admin update ───────────────────────────────────────────

export const UpdateUserSchema = z.object({
  username:   usernameField.optional(),
  status:     z.enum(['pending', 'active', 'suspended']).optional(),
  isActive:   z.boolean().optional(),
  isVerified: z.boolean().optional(),
  version:    z.coerce.number().int().min(0).optional(),
}).refine(
  (data) => Object.keys(data).some((k) => k !== 'version' && data[k as keyof typeof data] !== undefined),
  { message: 'At least one updatable field must be provided.' },
);
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

// ── Swagger DTO classes ───────────────────────────────────────────────────────

export class UpdateUserDtoClass {
  @ApiPropertyOptional({ example: 'juan_delacruz', description: 'Unique username (3–30 chars, lowercase alphanumeric + underscore).' })
  username?: string;

  @ApiPropertyOptional({ example: 'active', enum: ['pending', 'active', 'suspended'] })
  status?: string;

  @ApiPropertyOptional({ example: true, description: 'Account active flag.' })
  isActive?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Email verification status (admin override).' })
  isVerified?: boolean;

  @ApiPropertyOptional({ example: 3, description: 'Version the client last read (optimistic locking). Rejected if stale.' })
  version?: number;
}

export class UserSummaryDto {
  @ApiProperty({ example: '01J4XYZ...' })
  id!: string;

  @ApiProperty({ example: 'juan@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'juan_delacruz' })
  username?: string | null;

  @ApiProperty({ example: 'subscriber' })
  role!: string;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty({ example: true })
  isVerified!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: 'Juan dela Cruz' })
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.test/a.webp' })
  avatarUrl?: string | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-06-25T10:00:00.000Z' })
  lastLoginAt?: string | null;
}

export class UserDetailDto extends UserSummaryDto {
  @ApiPropertyOptional({ example: '203.0.113.7' })
  lastLoginIp?: string | null;

  @ApiProperty({ example: '2026-06-26T08:00:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ example: 2, description: 'Optimistic locking version.' })
  version!: number;

  @ApiPropertyOptional({ example: 'Juan' })
  firstName?: string | null;

  @ApiPropertyOptional({ example: 'dela Cruz' })
  lastName?: string | null;
}
