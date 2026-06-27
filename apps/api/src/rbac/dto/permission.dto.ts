/**
 * @file permission.dto.ts
 * @module Rbac/Dto
 *
 * Zod validation schemas and Swagger DTO classes for Permission endpoints.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Zod Schemas ───────────────────────────────────────────────────────────────

/** POST /admin/permissions */
export const CreatePermissionSchema = z.object({
  name: z
    .string({ required_error: 'Permission name is required.' })
    .trim()
    .min(3,   { message: 'Name must be at least 3 characters.' })
    .max(150, { message: 'Name must not exceed 150 characters.' }),
  slug: z
    .string({ required_error: 'Permission slug is required.' })
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/,
      { message: 'Slug must follow the format module.action (e.g. questions.create).' },
    )
    .max(100, { message: 'Slug must not exceed 100 characters.' }),
  module: z
    .string({ required_error: 'Module is required.' })
    .trim()
    .toLowerCase()
    .min(2,  { message: 'Module must be at least 2 characters.' })
    .max(50, { message: 'Module must not exceed 50 characters.' }),
  description: z.string().trim().max(500).optional(),
});
export type CreatePermissionDto = z.infer<typeof CreatePermissionSchema>;

/** PATCH /admin/permissions/:id */
export const UpdatePermissionSchema = z.object({
  name:        z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(500).optional(),
  isActive:    z.boolean().optional(),
});
export type UpdatePermissionDto = z.infer<typeof UpdatePermissionSchema>;

/** GET /admin/permissions?module=questions */
export const ListPermissionsQuerySchema = z.object({
  module:   z.string().toLowerCase().optional(),
  isActive: z.preprocess(
    (v) => v === 'true' ? true : v === 'false' ? false : v,
    z.boolean().optional(),
  ),
  cursor:   z.string().optional(),
  limit:    z.coerce.number().int().min(1).max(200).default(50),
});
export type ListPermissionsQueryDto = z.infer<typeof ListPermissionsQuerySchema>;

/** GET /rbac/check?permission=questions.create */
export const CheckPermissionQuerySchema = z.object({
  permission: z
    .string({ required_error: 'permission query parameter is required.' })
    .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, { message: 'Permission must be module.action format.' }),
});
export type CheckPermissionQueryDto = z.infer<typeof CheckPermissionQuerySchema>;

// ── Swagger DTO classes ───────────────────────────────────────────────────────

export class CreatePermissionDtoClass {
  @ApiProperty({ example: 'Create Questions', description: 'Human-readable name (3–150 chars).' })
  name!: string;

  @ApiProperty({ example: 'questions.create', description: 'Unique slug in module.action format.' })
  slug!: string;

  @ApiProperty({ example: 'questions', description: 'Module grouping (lowercase, 2–50 chars).' })
  module!: string;

  @ApiPropertyOptional({ example: 'Author new questions and submit for review.' })
  description?: string;
}

export class UpdatePermissionDtoClass {
  @ApiPropertyOptional({ example: 'Updated name' })
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  description?: string;

  @ApiPropertyOptional({ example: false, description: 'Set false to deactivate without deleting.' })
  isActive?: boolean;
}
