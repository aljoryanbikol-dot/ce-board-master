/**
 * @file knowledge.errors.ts
 * @module Knowledge
 */
import {
  BadRequestException, ConflictException, ForbiddenException,
  NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { KNOWLEDGE_ERROR_CODES as E } from './constants/knowledge.constants';

export const KnowledgeErrors = {
  documentNotFound: (id: string) =>
    new NotFoundException({ code: E.DOCUMENT_NOT_FOUND, message: `Knowledge document not found: ${id}` }),
  bookTaken: (book: number) =>
    new ConflictException({ code: E.DOCUMENT_BOOK_TAKEN, message: `Book ${book} has already been ingested.` }),
  versionNotFound: (n: number) =>
    new NotFoundException({ code: E.VERSION_NOT_FOUND, message: `Document version ${n} not found.` }),
  duplicateContent: () =>
    new ConflictException({ code: E.DUPLICATE_CONTENT, message: 'This exact content has already been ingested (checksum match); no new version created.' }),
  entityNotFound: (kind: string, id: string) =>
    new NotFoundException({ code: E.ENTITY_NOT_FOUND, message: `${kind} not found: ${id}` }),
  publicIdTaken: (publicId: string) =>
    new ConflictException({ code: E.PUBLIC_ID_TAKEN, message: `Public ID '${publicId}' is already in use.` }),
  invalidPublicId: (publicId: string, expected: string) =>
    new UnprocessableEntityException({ code: E.INVALID_PUBLIC_ID, message: `Public ID '${publicId}' does not match the required format (${expected}).` }),
  invalidSubjectCode: (code: string) =>
    new UnprocessableEntityException({ code: E.INVALID_SUBJECT_CODE, message: `Unknown subject code: ${code}` }),
  invalidCategoryCode: (code: string) =>
    new UnprocessableEntityException({ code: E.INVALID_CATEGORY_CODE, message: `Unknown misconception category code: ${code}` }),
  invalidBlueprintType: (code: string) =>
    new UnprocessableEntityException({ code: E.INVALID_BLUEPRINT_TYPE, message: `Unknown blueprint type code: ${code}` }),
  validationFailed: (issues: unknown) =>
    new UnprocessableEntityException({ code: E.VALIDATION_FAILED, message: 'Knowledge entity failed validation against the governing specification.', issues }),
  crossRefExists: () =>
    new ConflictException({ code: E.CROSS_REFERENCE_EXISTS, message: 'This cross-reference already exists.' }),
  crossRefNotFound: (id: string) =>
    new NotFoundException({ code: E.CROSS_REFERENCE_NOT_FOUND, message: `Cross-reference not found: ${id}` }),
  cycleDetected: (detail: string) =>
    new UnprocessableEntityException({ code: E.CYCLE_DETECTED, message: `Adding this reference would create a dependency cycle: ${detail}` }),
  notPublishable: (status: string) =>
    new UnprocessableEntityException({ code: E.NOT_PUBLISHABLE, message: `An entity in status '${status}' cannot be published. It must be 'approved' first.` }),
  forbidden: (detail = 'You do not have permission for this knowledge-base action.') =>
    new ForbiddenException({ code: E.FORBIDDEN_KNOWLEDGE, message: detail }),
  badRequest: (detail: string) =>
    new BadRequestException({ code: E.VALIDATION_FAILED, message: detail }),
} as const;
