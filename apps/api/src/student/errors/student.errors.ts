/**
 * @file student.errors.ts
 * @module Student/Errors
 */
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { STUDENT_ERROR_CODES as E } from '../constants/student.constants';

export const StudentErrors = {
  sessionNotFound: (id: string) => new NotFoundException({ code: E.SESSION_NOT_FOUND, message: `Practice session not found: ${id}` }),
  sessionNotActive: (status: string) => new BadRequestException({ code: E.SESSION_NOT_ACTIVE, message: `Session is '${status}', not active.` }),
  sessionForbidden: () => new ForbiddenException({ code: E.SESSION_FORBIDDEN, message: 'You do not own this practice session.' }),
  questionNotFound: (id: string) => new NotFoundException({ code: E.QUESTION_NOT_FOUND, message: `Question not found: ${id}` }),
  questionNotAvailable: (id: string) => new BadRequestException({ code: E.QUESTION_NOT_AVAILABLE, message: `Question '${id}' is not available for practice (must be published).` }),
  alreadyBookmarked: () => new ConflictException({ code: E.ALREADY_BOOKMARKED, message: 'Question is already bookmarked.' }),
  bookmarkNotFound: () => new NotFoundException({ code: E.BOOKMARK_NOT_FOUND, message: 'Bookmark not found.' }),
  alreadyFavorited: () => new ConflictException({ code: E.ALREADY_FAVORITED, message: 'Question is already favorited.' }),
  favoriteNotFound: () => new NotFoundException({ code: E.FAVORITE_NOT_FOUND, message: 'Favorite not found.' }),
  goalNotFound: () => new NotFoundException({ code: E.GOAL_NOT_FOUND, message: 'Study goal not found.' }),
  planNotFound: (id: string) => new NotFoundException({ code: E.PLAN_NOT_FOUND, message: `Study plan not found: ${id}` }),
  planForbidden: () => new ForbiddenException({ code: E.PLAN_FORBIDDEN, message: 'You do not own this study plan.' }),
  taskNotFound: (id: string) => new NotFoundException({ code: E.TASK_NOT_FOUND, message: `Study task not found: ${id}` }),
  noRecommendations: () => new NotFoundException({ code: E.NO_RECOMMENDATIONS, message: 'No recommendations available yet — answer more questions first.' }),
  ownershipViolation: () => new ForbiddenException({ code: E.OWNERSHIP_VIOLATION, message: 'You do not have access to this resource.' }),
  invalidPracticeTarget: (detail: string) => new BadRequestException({ code: E.INVALID_PRACTICE_TARGET, message: detail }),
} as const;
