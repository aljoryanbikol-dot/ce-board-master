/**
 * @file exam.errors.ts
 * @module Exams/Errors
 */
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EXAM_ERROR_CODES as E } from '../constants/exam.constants';

export const ExamErrors = {
  templateNotFound: (id: string) => new NotFoundException({ code: E.TEMPLATE_NOT_FOUND, message: `Exam template not found: ${id}` }),
  templateInactive: (id: string) => new BadRequestException({ code: E.TEMPLATE_INACTIVE, message: `Exam template is inactive: ${id}` }),
  examNotFound: (id: string) => new NotFoundException({ code: E.EXAM_NOT_FOUND, message: `Exam not found: ${id}` }),
  examForbidden: () => new ForbiddenException({ code: E.EXAM_FORBIDDEN, message: 'You do not own this exam.' }),
  examNotInProgress: (status: string) => new BadRequestException({ code: E.EXAM_NOT_IN_PROGRESS, message: `Exam is '${status}', not in progress.` }),
  examAlreadyStarted: () => new ConflictException({ code: E.EXAM_ALREADY_STARTED, message: 'Exam has already been started.' }),
  examAlreadySubmitted: () => new ConflictException({ code: E.EXAM_ALREADY_SUBMITTED, message: 'Exam has already been submitted.' }),
  examExpired: () => new BadRequestException({ code: E.EXAM_EXPIRED, message: 'Exam time has expired.' }),
  examNotPaused: () => new BadRequestException({ code: E.EXAM_NOT_PAUSED, message: 'Exam is not paused.' }),
  examQuestionNotFound: (id: string) => new NotFoundException({ code: E.EXAM_QUESTION_NOT_FOUND, message: `Exam question not found: ${id}` }),
  invalidChoice: (letter: string) => new BadRequestException({ code: E.INVALID_CHOICE, message: `Invalid choice: ${letter}` }),
  insufficientQuestions: (detail: string) => new UnprocessableEntityException({ code: E.INSUFFICIENT_QUESTIONS, message: detail }),
  invalidComposition: (detail: string) => new BadRequestException({ code: E.INVALID_COMPOSITION, message: detail }),
  resultNotFound: (id: string) => new NotFoundException({ code: E.RESULT_NOT_FOUND, message: `Exam result not found: ${id}` }),
  resultNotReady: () => new BadRequestException({ code: E.RESULT_NOT_READY, message: 'Exam result is not ready (exam not submitted).' }),
  ownershipViolation: () => new ForbiddenException({ code: E.OWNERSHIP_VIOLATION, message: 'You do not have access to this resource.' }),
} as const;
