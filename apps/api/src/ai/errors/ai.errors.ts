/**
 * @file ai.errors.ts
 * @module AI/Errors
 */
import {
  BadRequestException, ConflictException, ForbiddenException,
  NotFoundException, ServiceUnavailableException, UnprocessableEntityException,
} from '@nestjs/common';
import { AI_ERROR_CODES as E } from '../constants/ai.constants';

export const AiErrors = {
  generationNotFound: (id: string) =>
    new NotFoundException({ code: E.GENERATION_NOT_FOUND, message: `Generation request not found: ${id}` }),
  loNotFound: (publicId: string) =>
    new NotFoundException({ code: E.LO_NOT_FOUND, message: `Learning Objective not found: ${publicId}` }),
  loNotPublished: (publicId: string) =>
    new UnprocessableEntityException({ code: E.LO_NOT_PUBLISHED, message: `Learning Objective '${publicId}' must be published before it can ground generation.` }),
  blueprintNotFound: (publicId: string) =>
    new NotFoundException({ code: E.BLUEPRINT_NOT_FOUND, message: `Blueprint not found: ${publicId}` }),
  blueprintNotPublished: (publicId: string) =>
    new UnprocessableEntityException({ code: E.BLUEPRINT_NOT_PUBLISHED, message: `Blueprint '${publicId}' must be published before it can ground generation.` }),
  groundingRequired: () =>
    new UnprocessableEntityException({ code: E.KB_GROUNDING_REQUIRED, message: 'AI generation must be grounded in a published Knowledge Base entity (Learning Objective or Blueprint).' }),
  generationFailed: (detail: string) =>
    new UnprocessableEntityException({ code: E.GENERATION_FAILED, message: `Generation failed: ${detail}` }),
  validationFailed: (report: unknown) =>
    new UnprocessableEntityException({ code: E.VALIDATION_FAILED, message: 'Generated content failed the validation pipeline.', report }),
  notValidated: (status: string) =>
    new UnprocessableEntityException({ code: E.NOT_VALIDATED, message: `A generation in status '${status}' cannot be promoted. It must be 'validated' first.` }),
  alreadyPromoted: (id: string) =>
    new ConflictException({ code: E.ALREADY_PROMOTED, message: `Generation '${id}' has already been promoted to the Question Bank.` }),
  duplicateContent: () =>
    new ConflictException({ code: E.DUPLICATE_CONTENT, message: 'Generated content duplicates an existing question or generation.' }),
  quotaExceeded: (limit: number) =>
    new ForbiddenException({ code: E.QUOTA_EXCEEDED, message: `Daily AI generation quota of ${limit} reached for your subscription tier.` }),
  subscriptionRequired: () =>
    new ForbiddenException({ code: E.SUBSCRIPTION_REQUIRED, message: 'AI content generation requires an active subscription.' }),
  invalidVariantRequest: (detail: string) =>
    new BadRequestException({ code: E.INVALID_VARIANT_REQUEST, message: detail }),
  providerError: (detail: string) =>
    new ServiceUnavailableException({ code: E.PROVIDER_ERROR, message: `AI provider error: ${detail}` }),
} as const;
