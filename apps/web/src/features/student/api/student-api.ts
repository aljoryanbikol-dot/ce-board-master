/**
 * @file student-api.ts — typed wrappers over the backend /student/* endpoints
 * (Sprint 3.1). Returns domain data via the shared api client (envelope unwrapped).
 */
import { api } from '@/lib/api/client';

export interface DashboardSummary {
  streak?: { current: number; longest: number; activeToday: boolean };
  xp?: { totalXp: number; level: number; xpIntoLevel: number; xpForNextLevel: number };
  progress?: { totalAnswered: number; overallAccuracy: number; topicsMastered: number };
  weakTopics?: Array<{ topicId: string; accuracy?: number }>;
  strongTopics?: Array<{ topicId: string; accuracy?: number }>;
  recentAchievements?: Array<{ code: string; name: string; earnedAt: string }>;
  continueLearning?: { sessionId?: string; mode?: string; answeredCount?: number; targetCount?: number } | null;
  dailyGoal?: unknown;
  [k: string]: unknown;
}

export interface TopicSnapshot { topicId: string; subjectId: string; accuracy: number; tier: string; attempts?: number; }
export interface ProgressBucket { date: string; answered: number; correct: number; accuracy: number; minutes: number; }
export interface ProgressAnalytics { period: string; buckets: ProgressBucket[]; totals: { answered: number; correct: number; minutes: number; accuracy: number }; }
export interface AccuracySpeed { allTime: { answered: number; accuracy: number; avgTimeSec: number }; last7Days: { answered: number; accuracy: number; avgTimeSec: number }; }
export interface Distribution { bySubject: Array<{ subjectId: string; count: number }>; byOutcome: Array<{ outcome: string; count: number }>; }
export interface KnowledgeGap { topicId: string; subjectId: string; severity: string; accuracy: number; attempts: number; recommendation: string | null; }
export interface AchievementsSummary {
  xp: { totalXp: number; level: number; xpIntoLevel: number; xpForNextLevel: number; currentStreak: number; longestStreak: number };
  earned: Array<{ code: string; name: string; description: string; kind: string; icon: string | null; xpReward: number; earnedAt: string }>;
  earnedCount: number;
  totalCount: number;
}
export interface LeaderboardEntry { rank: number; userId: string; totalXp: number; level: number; }

export const studentApi = {
  dashboard: () => api.data<DashboardSummary>(api.get('/student/dashboard')),
  progressStatistics: (period: 'daily' | 'weekly' | 'monthly' = 'daily', days = 30) =>
    api.data<ProgressAnalytics>(api.get('/student/progress/statistics', { query: { period, days } })),
  accuracySpeed: () => api.data<AccuracySpeed>(api.get('/student/progress/statistics/accuracy-speed')),
  distribution: () => api.data<Distribution>(api.get('/student/progress/statistics/distribution')),
  mastery: () => api.data<TopicSnapshot[]>(api.get('/student/progress/mastery')),
  weakTopics: () => api.data<TopicSnapshot[]>(api.get('/student/progress/weak-topics')),
  strongTopics: () => api.data<TopicSnapshot[]>(api.get('/student/progress/strong-topics')),
  knowledgeGaps: () => api.data<KnowledgeGap[]>(api.get('/student/progress/knowledge-gaps')),
  learningPath: () => api.data(api.get('/student/progress/learning-path')),
  heatmap: () => api.data(api.get('/student/progress/statistics/heatmap')),
  achievements: () => api.data<AchievementsSummary>(api.get('/student/achievements')),
  leaderboard: () => api.data<LeaderboardEntry[]>(api.get('/student/achievements/leaderboard')),
  // Planner
  plannerGoals: () => api.data(api.get('/student/planner/goals')),
  plannerCalendar: (from: string, to: string) => api.data(api.get('/student/planner/calendar', { query: { from, to } })),
  // Engagement
  bookmarks: () => api.data(api.get('/student/bookmarks')),
  favorites: () => api.data(api.get('/student/favorites')),
  recentlyViewed: () => api.data(api.get('/student/recently-viewed')),
  history: () => api.data(api.get('/student/history')),
  // Practice
  recommendations: (subjectId?: string) => api.data(api.get('/student/practice/recommendations', { query: { subjectId } })),
  practiceSubjects: () => api.data<Array<{ id: string; code: string; name: string }>>(api.get('/student/practice/subjects')),
  startPractice: (body: { mode: string; subjectId?: string; topicId?: string; count?: number }) => api.data(api.post('/student/practice/sessions', body)),
  answerPractice: (sessionId: string, body: { questionId: string; selectedChoice: string; timeSpentSec?: number }) =>
    api.data(api.post(`/student/practice/sessions/${sessionId}/answers`, body)),
};
