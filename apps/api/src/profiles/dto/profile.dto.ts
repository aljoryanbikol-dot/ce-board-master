/**
 * @file profile.dto.ts
 * @module Profiles/Dto
 *
 * Zod schemas and Swagger DTO classes for Profile endpoints.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { THEMES, SUPPORTED_LANGUAGES } from '../profiles.constants';

// ── PATCH /profile — general profile update ───────────────────────────────────

export const UpdateProfileSchema = z.object({
  firstName:    z.string().trim().min(1).max(100).optional(),
  lastName:     z.string().trim().min(1).max(100).optional(),
  displayName:  z.string().trim().min(1).max(150).optional(),
  bio:          z.string().trim().max(1000).optional(),
  phoneNumber:  z.string().trim().max(20).regex(/^[+0-9().\-\s]*$/, { message: 'Invalid phone number format.' }).optional(),
  gender:       z.string().trim().max(30).optional(),
  dateOfBirth:  z.string().date('Date of birth must be YYYY-MM-DD.').optional(),
  school:       z.string().trim().max(255).optional(),
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
  prcRegistrationNo: z.string().trim().max(50).optional(),
  examTargetDate: z.string().date('Exam target date must be YYYY-MM-DD.').optional(),
  studyGoalHours: z.coerce.number().int().min(0).max(24).optional(),
  version:      z.coerce.number().int().min(0).optional(),
}).refine(
  (data) => Object.keys(data).some((k) => k !== 'version' && data[k as keyof typeof data] !== undefined),
  { message: 'At least one field must be provided.' },
);
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

// ── PATCH /profile/avatar ─────────────────────────────────────────────────────

export const UpdateAvatarSchema = z.object({
  avatarUrl: z
    .string({ required_error: 'avatarUrl is required.' })
    .url({ message: 'avatarUrl must be a valid URL.' })
    .startsWith('https://', { message: 'avatarUrl must use HTTPS.' })
    .max(2048),
});
export type UpdateAvatarDto = z.infer<typeof UpdateAvatarSchema>;

// ── PATCH /profile/preferences ────────────────────────────────────────────────

export const UpdatePreferencesSchema = z.object({
  preferredLanguage:  z.enum(SUPPORTED_LANGUAGES).optional(),
  timezone:           z.string().trim().min(1).max(50).optional(),
  theme:              z.enum(THEMES).optional(),
  notificationsEmail: z.boolean().optional(),
  notificationsPush:  z.boolean().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one preference must be provided.' },
);
export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesSchema>;

// ── Swagger DTO classes ───────────────────────────────────────────────────────

export class UpdateProfileDtoClass {
  @ApiPropertyOptional({ example: 'Juan' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'dela Cruz' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'Juan DC' })
  displayName?: string;

  @ApiPropertyOptional({ example: 'Aspiring civil engineer.' })
  bio?: string;

  @ApiPropertyOptional({ example: '+63 917 123 4567' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'male' })
  gender?: string;

  @ApiPropertyOptional({ example: '1998-05-12' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Mapua University' })
  school?: string;

  @ApiPropertyOptional({ example: 2020 })
  graduationYear?: number;

  @ApiPropertyOptional({ example: 'PRC-0123456' })
  prcRegistrationNo?: string;

  @ApiPropertyOptional({ example: '2026-08-24' })
  examTargetDate?: string;

  @ApiPropertyOptional({ example: 2 })
  studyGoalHours?: number;

  @ApiPropertyOptional({ example: 1, description: 'Optimistic locking version.' })
  version?: number;
}

export class UpdateAvatarDtoClass {
  @ApiProperty({ example: 'https://cdn.ce-boardmaster.ph/avatars/u1.webp', description: 'HTTPS avatar URL.' })
  avatarUrl!: string;
}

export class UpdatePreferencesDtoClass {
  @ApiPropertyOptional({ example: 'en', enum: SUPPORTED_LANGUAGES })
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: 'Asia/Manila' })
  timezone?: string;

  @ApiPropertyOptional({ example: 'dark', enum: THEMES })
  theme?: string;

  @ApiPropertyOptional({ example: true })
  notificationsEmail?: boolean;

  @ApiPropertyOptional({ example: false })
  notificationsPush?: boolean;
}

export class ProfileDetailDto {
  @ApiProperty({ example: '01J4XYZ...' })
  userId!: string;

  @ApiProperty({ example: 'juan@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'juan_delacruz' })
  username?: string | null;

  @ApiPropertyOptional({ example: 'Juan' })
  firstName?: string | null;

  @ApiPropertyOptional({ example: 'dela Cruz' })
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'Juan DC' })
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.test/a.webp' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'Aspiring civil engineer.' })
  bio?: string | null;

  @ApiProperty({ example: 'en' })
  preferredLanguage!: string;

  @ApiProperty({ example: 'Asia/Manila' })
  timezone!: string;

  @ApiProperty({ example: 'system' })
  theme!: string;

  @ApiProperty({ example: true })
  notificationsEmail!: boolean;

  @ApiProperty({ example: true })
  notificationsPush!: boolean;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '2026-06-26T08:00:00.000Z' })
  updatedAt!: string;
}
