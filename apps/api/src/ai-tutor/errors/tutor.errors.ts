/**
 * @file tutor.errors.ts
 * @module AITutor/Errors
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TUTOR_ERROR_CODES as E } from '../constants/tutor.constants';

export const TutorErrors = {
  conversationNotFound: (id: string) => new NotFoundException({ code: E.CONVERSATION_NOT_FOUND, message: `Conversation not found: ${id}` }),
  conversationForbidden: () => new ForbiddenException({ code: E.CONVERSATION_FORBIDDEN, message: 'You do not own this conversation.' }),
  conversationArchived: () => new BadRequestException({ code: E.CONVERSATION_ARCHIVED, message: 'Conversation is archived; start a new one to continue.' }),
  messageNotFound: (id: string) => new NotFoundException({ code: E.MESSAGE_NOT_FOUND, message: `Message not found: ${id}` }),
  questionNotFound: (id: string) => new NotFoundException({ code: E.QUESTION_NOT_FOUND, message: `Question not found: ${id}` }),
  questionNotAvailable: (id: string) => new BadRequestException({ code: E.QUESTION_NOT_AVAILABLE, message: `Question '${id}' is not available (must be published).` }),
  emptyMessage: () => new BadRequestException({ code: E.EMPTY_MESSAGE, message: 'Message cannot be empty.' }),
  messageTooLong: (max: number) => new BadRequestException({ code: E.MESSAGE_TOO_LONG, message: `Message exceeds ${max} characters.` }),
  hintLimitReached: (max: number) => new BadRequestException({ code: E.HINT_LIMIT_REACHED, message: `No more hints — ${max} hints already given. Try the full solution.` }),
  noCoachingAvailable: () => new NotFoundException({ code: E.NO_COACHING_AVAILABLE, message: 'No coaching available yet — practice more first.' }),
  coachingNotFound: (id: string) => new NotFoundException({ code: E.COACHING_NOT_FOUND, message: `Coaching note not found: ${id}` }),
  ownershipViolation: () => new ForbiddenException({ code: E.OWNERSHIP_VIOLATION, message: 'You do not have access to this resource.' }),
} as const;
