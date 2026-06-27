/**
 * @file questions.errors.ts
 * @module Questions
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QUESTION_ERROR_CODES as E } from './constants/questions.constants';

export const QuestionErrors = {
  notFound: (id: string) =>
    new NotFoundException({ code: E.QUESTION_NOT_FOUND, message: `Question not found: ${id}` }),

  codeTaken: (code: string) =>
    new ConflictException({ code: E.QUESTION_CODE_TAKEN, message: `Question code '${code}' is already in use.` }),

  invalidTransition: (from: string, action: string) =>
    new UnprocessableEntityException({
      code: E.INVALID_TRANSITION,
      message: `Action '${action}' is not permitted from status '${from}'.`,
    }),

  invalidReviewStage: (stage: string) =>
    new UnprocessableEntityException({ code: E.INVALID_REVIEW_STAGE, message: `Invalid review stage: ${stage}` }),

  forbiddenOwnership: () =>
    new ForbiddenException({ code: E.FORBIDDEN_OWNERSHIP, message: 'You do not have permission to modify this question.' }),

  versionConflict: () =>
    new ConflictException({ code: E.VERSION_CONFLICT, message: 'This question was modified concurrently. Reload and retry.' }),

  versionNotFound: (n: number) =>
    new NotFoundException({ code: E.VERSION_NOT_FOUND, message: `Version ${n} not found for this question.` }),

  choicesInvalid: (detail: string) =>
    new UnprocessableEntityException({ code: E.CHOICES_INVALID, message: `Invalid answer choices: ${detail}` }),

  correctChoiceInvalid: () =>
    new UnprocessableEntityException({ code: E.CORRECT_CHOICE_INVALID, message: 'The correct choice must match exactly one provided choice letter.' }),

  alreadyPublished: () =>
    new ConflictException({ code: E.ALREADY_PUBLISHED, message: 'This question is already published.' }),

  notPublishable: (status: string) =>
    new UnprocessableEntityException({ code: E.NOT_PUBLISHABLE, message: `A question in status '${status}' cannot be published. It must be 'approved' first.` }),

  cannotDeletePublished: () =>
    new ForbiddenException({ code: E.CANNOT_DELETE_PUBLISHED, message: 'Published questions cannot be deleted. Archive instead.' }),

  bulkImportInvalid: (detail: string) =>
    new BadRequestException({ code: E.BULK_IMPORT_INVALID, message: `Bulk import rejected: ${detail}` }),

  taxonomyNotFound: (detail: string) =>
    new BadRequestException({ code: E.TAXONOMY_NOT_FOUND, message: `Referenced taxonomy not found: ${detail}` }),
} as const;
