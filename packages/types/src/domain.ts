/**
 * Domain entity types — match API response shapes from API Contract (Phase 4).
 * Used to type-check API client calls in frontend apps.
 */
import type { BloomLevel, DifficultyCode, QuestionStatus, SubscriptionTier } from './enums';

export interface SubjectDto {
  id: string;
  name: string;
  code: string;
  examDay: 1 | 2;
  prcWeightPercent: string;
  colorHex?: string;
  sortOrder: number;
  questionCount?: number;
}

export interface TopicDto {
  id: string;
  subjectId: string;
  name: string;
  code: string;
  prcLearningOutcome?: string;
  prcWeightPercent?: string;
  sortOrder: number;
}

export interface SubtopicDto {
  id: string;
  topicId: string;
  name: string;
  code: string;
  description?: string;
  keywords?: string[];
  sortOrder: number;
}

export interface DifficultyLevelDto {
  id: string;
  name: string;
  code: DifficultyCode;
  passingThreshold: string;
  colorHex?: string;
}

export interface QuestionListItemDto {
  id: string;
  questionCode: string;
  stemText: string;
  stemHtml?: string;
  questionType: string;
  bloomLevel: BloomLevel;
  difficultyLevel: DifficultyLevelDto;
  subject: Pick<SubjectDto, 'id' | 'name' | 'code'>;
  topic: Pick<TopicDto, 'id' | 'name'>;
  subtopic: Pick<SubtopicDto, 'id' | 'name'>;
  estSolvingTimeSec: number;
  isPrcVerified: boolean;
  hasImages: boolean;
  publishedAt?: string;
  questionStatus?: QuestionStatus;
}

export interface UserDto {
  id: string;
  email: string;
  role: string;
  subscriptionTier: SubscriptionTier;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface UserProfileDto {
  userId: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  school?: string;
  graduationYear?: number;
  examTargetDate?: string;
  preferredLanguage: string;
  timezone: string;
  studyGoalHours?: number;
  notificationsEmail: boolean;
  notificationsPush: boolean;
}
