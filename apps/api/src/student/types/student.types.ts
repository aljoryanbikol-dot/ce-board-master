/**
 * @file student.types.ts
 * @module Student/Types
 */

export interface DashboardSummary {
  continueLearning: { sessionId: string; mode: string; answeredCount: number; targetCount: number } | null;
  dailyGoal: { target: number; completed: number; percent: number; met: boolean } | null;
  streak: { current: number; longest: number; activeToday: boolean };
  xp: { totalXp: number; level: number; xpIntoLevel: number; xpForNextLevel: number };
  progress: { totalAnswered: number; overallAccuracy: number; topicsMastered: number };
  weakTopics: TopicSnapshot[];
  strongTopics: TopicSnapshot[];
  recentAchievements: { code: string; name: string; earnedAt: string }[];
}

export interface TopicSnapshot {
  topicId: string;
  subjectId: string;
  accuracy: number;
  attempts: number;
  masteryScore: number;
  tier: string;
}

export interface MasteryUpdate {
  topicId: string;
  attempts: number;
  correct: number;
  accuracy: number;
  masteryScore: number;
  tier: string;
  tierChanged: boolean;
}

export interface XpAward {
  awardedXp: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  breakdown: Record<string, number>;
}

export interface AnswerResult {
  attemptId: string;
  isCorrect: boolean;
  correctChoice: string;
  outcome: string;
  xp: XpAward;
  mastery: MasteryUpdate | null;
  newAchievements: { code: string; name: string; xpReward: number }[];
  sessionProgress?: { answeredCount: number; correctCount: number; targetCount: number; completed: boolean };
}

export interface RecommendedQuestion {
  questionId: string;
  subjectId: string;
  topicId: string | null;
  difficultyLevelId: string | null;
  reason: string;
  priority: number;
}

export interface LearningPathStep {
  order: number;
  topicId: string;
  subjectId: string;
  reason: string;
  targetAccuracy: number;
  currentAccuracy: number;
}

export interface ProgressAnalytics {
  period: 'daily' | 'weekly' | 'monthly';
  buckets: { date: string; answered: number; correct: number; accuracy: number; minutes: number }[];
  totals: { answered: number; correct: number; accuracy: number; minutes: number };
}

export interface MasteryHeatmapCell {
  subjectId: string;
  topicId: string;
  masteryScore: number;
  tier: string;
  attempts: number;
}
