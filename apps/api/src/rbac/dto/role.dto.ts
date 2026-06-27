/**
 * @file role.dto.ts
 * @module Rbac/Dto
 *
 * Zod validation schemas and Swagger DTO classes for Role endpoints.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Zod Schemas ───────────────────────────────────────────────────────────────

/** POST /admin/roles */
export const CreateRoleSchema = z.object({
  name: z
    .string({ required_error: 'Role name is required.' })
    .trim()
    .min(2,   { message: 'Name must be at least 2 characters.' })
    .max(100, { message: 'Name must not exceed 100 characters.' }),
  slug: z
    .string({ required_error: 'Role slug is required.' })
    .trim()
    .toLowerCase()
    .min(2,  { message: 'Slug must be at least 2 characters.' })
    .max(50, { message: 'Slug must not exceed 50 characters.' })
    .regex(/^[a-z][a-z0-9_]*$/, { message: 'Slug must be lowercase alphanumeric with underscores, starting with a letter.' }),
  description: z.string().trim().max(500).optional(),
  sortOrder:   z.coerce.number().int().min(0).max(999).default(0),
});
export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;

/** PATCH /admin/roles/:id */
export const UpdateRoleSchema = z.object({
  name:        z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  sortOrder:   z.coerce.number().int().min(0).max(999).optional(),
  isActive:    z.boolean().optional(),
});
export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;

/** POST /admin/roles/:id/permissions */
export const AssignPermissionToRoleSchema = z.object({
  permissionId: z
    .string({ required_error: 'permissionId is required.' })
    .uuid({ message: 'permissionId must be a valid UUID.' }),
});
export type AssignPermissionToRoleDto = z.infer<typeof AssignPermissionToRoleSchema>;

/** POST /admin/users/:userId/roles */
export const AssignRoleToUserSchema = z.object({
  roleId: z
    .string({ required_error: 'roleId is required.' })
    .uuid({ message: 'roleId must be a valid UUID.' }),
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be a valid ISO 8601 datetime string.' })
    .optional(),
});
export type AssignRoleToUserDto = z.infer<typeof AssignRoleToUserSchema>;

// ── Swagger DTO classes ───────────────────────────────────────────────────────

export class CreateRoleDtoClass {
  @ApiProperty({ example: 'Content Author', description: 'Human-readable role name (2–100 chars).' })
  name!: string;

  @ApiProperty({ example: 'content_author', description: 'Unique slug: lowercase letters, digits, underscores.' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Creates and manages questions and formulas.' })
  description?: string;

  @ApiPropertyOptional({ example: 50, description: 'Sort order for display. Lower = higher in list.' })
  sortOrder?: number;
}

export class UpdateRoleDtoClass {
  @ApiPropertyOptional({ example: 'Senior Content Author' })
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  description?: string;

  @ApiPropertyOptional({ example: 55 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

export class AssignPermissionToRoleDtoClass {
  @ApiProperty({ description: 'UUID of the permission to assign to this role.' })
  permissionId!: string;
}

export class AssignRoleToUserDtoClass {
  @ApiProperty({ description: 'UUID of the role to assign.' })
  roleId!: string;

  @ApiPropertyOptional({
    description: 'Optional ISO 8601 expiry datetime. Role assignment becomes inactive after this.',
    example: '2027-01-01T00:00:00Z',
  })
  expiresAt?: string;
}
