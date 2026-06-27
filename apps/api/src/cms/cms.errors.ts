/**
 * @file cms.errors.ts
 * @module Cms
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CMS_ERROR_CODES as E } from './constants/cms.constants';

export const CmsErrors = {
  questionLocked: (lockedBy: string) =>
    new ConflictException({ code: E.QUESTION_LOCKED, message: `Question is currently locked by another editor (${lockedBy}).` }),

  lockNotHeld: () =>
    new ForbiddenException({ code: E.LOCK_NOT_HELD, message: 'You do not hold the active lock on this question.' }),

  lockNotFound: () =>
    new NotFoundException({ code: E.LOCK_NOT_FOUND, message: 'No active lock found for this question.' }),

  assignmentExists: (stage: string) =>
    new ConflictException({ code: E.ASSIGNMENT_EXISTS, message: `An active assignment already exists for the ${stage} stage.` }),

  assignmentNotFound: (id: string) =>
    new NotFoundException({ code: E.ASSIGNMENT_NOT_FOUND, message: `Assignment not found: ${id}` }),

  commentNotFound: (id: string) =>
    new NotFoundException({ code: E.COMMENT_NOT_FOUND, message: `Comment not found: ${id}` }),

  noteNotFound: (id: string) =>
    new NotFoundException({ code: E.NOTE_NOT_FOUND, message: `Editorial note not found: ${id}` }),

  forbidden: (detail = 'You do not have permission to perform this CMS action.') =>
    new ForbiddenException({ code: E.FORBIDDEN_CMS, message: detail }),

  invalidStage: (stage: string) =>
    new UnprocessableEntityException({ code: E.INVALID_STAGE, message: `Invalid review stage: ${stage}` }),

  bulkInvalid: (detail: string) =>
    new BadRequestException({ code: E.BULK_OPERATION_INVALID, message: `Bulk operation rejected: ${detail}` }),
} as const;
