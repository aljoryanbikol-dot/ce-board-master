/**
 * @file profiles.errors.ts
 * @module Profiles
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PROFILE_ERROR_CODES } from './profiles.constants';

export const ProfileErrors = {
  notFound: (userId: string) =>
    new NotFoundException({
      code:    PROFILE_ERROR_CODES.PROFILE_NOT_FOUND,
      message: `Profile not found for user: ${userId}`,
    }),

  versionConflict: () =>
    new ConflictException({
      code:    PROFILE_ERROR_CODES.VERSION_CONFLICT,
      message: 'This profile was modified by another request. Please reload and try again.',
    }),

  invalidAvatarUrl: () =>
    new BadRequestException({
      code:    PROFILE_ERROR_CODES.INVALID_AVATAR_URL,
      message: 'Avatar URL must be a valid HTTPS URL.',
    }),
} as const;
