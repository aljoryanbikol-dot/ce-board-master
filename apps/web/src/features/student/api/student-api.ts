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

export const studentApi = {
  dashboard: () => api.data<DashboardSummary>(api.get('/student/dashboard')),
  progressStatistics: () => api.data(api.get('/student/progress/statistics')),
  mastery: () => api.data<TopicSnapshot[]>(api.get('/student/progress/mastery')),
  weakTopics: () => api.data<TopicSnapshot[]>(api.get('/student/progress/weak-topics')),
  strongTopics: () => api.data<TopicSnapshot[]>(api.get('/student/progress/strong-topics')),
  knowledgeGaps: () => api.data(api.get('/student/progress/knowledge-gaps')),
  learningPath: () => api.data(api.get('/student/progress/learning-path')),
  heatmap: () => api.data(api.get('/student/progress/heatmap')),
  achievements: () => api.data(api.get('/student/achievements')),
  leaderboard: () => api.data(api.get('/student/leaderboard')),
  // Planner
  plannerGoals: () => api.data(api.get('/student/planner/goals')),
  plannerTasks: () => api.data(api.get('/student/planner/tasks')),
  plannerCalendar: () => api.data(api.get('/student/planner/calendar')),
  // Engagement
  bookmarks: () => api.data(api.get('/student/engagement/bookmarks')),
  favorites: () => api.data(api.get('/student/engagement/favorites')),
  recentlyViewed: () => api.data(api.get('/student/engagement/recently-viewed')),
  history: () => api.data(api.get('/student/engagement/history')),
  // Practice
  recommendations: (subjectId?: string) => api.data(api.get('/student/practice/recommendations', { query: { subjectId } })),
  startPractice: (body: { mode: string; subjectId?: string; topicId?: string; count?: number }) => api.data(api.post('/student/practice/sessions', body)),
  answerPractice: (sessionId: string, body: { questionId: string; selectedChoice: string; timeSpentSec?: number }) =>
    api.data(api.post(`/student/practice/sessions/${sessionId}/answers`, body)),
};
