/**
 * @file users.errors.ts
 * @module Users
 *
 * Typed exception factories for the Users module.
 */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { USER_ERROR_CODES } from './users.constants';

export const UserErrors = {
  notFound: (id: string) =>
    new NotFoundException({
      code:    USER_ERROR_CODES.USER_NOT_FOUND,
      message: `User not found: ${id}`,
    }),

  usernameTaken: (username: string) =>
    new ConflictException({
      code:    USER_ERROR_CODES.USERNAME_TAKEN,
      message: `Username '${username}' is already taken.`,
      field:   'username',
    }),

  emailTaken: (email: string) =>
    new ConflictException({
      code:    USER_ERROR_CODES.EMAIL_TAKEN,
      message: `Email '${email}' is already in use.`,
      field:   'email',
    }),

  forbiddenOwnership: () =>
    new ForbiddenException({
      code:    USER_ERROR_CODES.FORBIDDEN_OWNERSHIP,
      message: 'You do not have permission to access or modify this user.',
    }),

  versionConflict: () =>
    new ConflictException({
      code:    USER_ERROR_CODES.VERSION_CONFLICT,
      message: 'This record was modified by another request. Please reload and try again.',
    }),

  cannotDeleteSelf: () =>
    new ForbiddenException({
      code:    USER_ERROR_CODES.CANNOT_DELETE_SELF,
      message: 'You cannot delete your own account through this endpoint.',
    }),

  cannotModifySuperAdmin: () =>
    new ForbiddenException({
      code:    USER_ERROR_CODES.CANNOT_MODIFY_SUPERADMIN,
      message: 'Super administrator accounts cannot be modified through this endpoint.',
    }),
} as const;
