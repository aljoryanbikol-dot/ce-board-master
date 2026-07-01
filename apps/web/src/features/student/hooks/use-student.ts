'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { studentApi } from '../api/student-api';

export const useDashboard = () => useQuery({ queryKey: queryKeys.student.dashboard, queryFn: studentApi.dashboard });
export const useProgress = (period: 'daily' | 'weekly' | 'monthly' = 'daily', days = 30) =>
  useQuery({ queryKey: [...queryKeys.student.progress, period, days], queryFn: () => studentApi.progressStatistics(period, days) });
export const useAccuracySpeed = () => useQuery({ queryKey: [...queryKeys.student.progress, 'accuracy-speed'], queryFn: studentApi.accuracySpeed });
export const useDistribution = () => useQuery({ queryKey: [...queryKeys.student.progress, 'distribution'], queryFn: studentApi.distribution });
export const useMastery = () => useQuery({ queryKey: [...queryKeys.student.progress, 'mastery'], queryFn: studentApi.mastery });
export const useWeakTopics = () => useQuery({ queryKey: queryKeys.student.weakTopics, queryFn: studentApi.weakTopics });
export const useStrongTopics = () => useQuery({ queryKey: [...queryKeys.student.weakTopics, 'strong'], queryFn: studentApi.strongTopics });
export const useAchievements = () => useQuery({ queryKey: queryKeys.student.achievements, queryFn: studentApi.achievements });
export const useLeaderboard = () => useQuery({ queryKey: [...queryKeys.student.achievements, 'leaderboard'], queryFn: studentApi.leaderboard });
export const usePlanner = (from: string, to: string) =>
  useQuery({ queryKey: [...queryKeys.student.planner, from, to], queryFn: () => studentApi.plannerCalendar(from, to) });
export const useBookmarks = () => useQuery({ queryKey: queryKeys.student.bookmarks, queryFn: studentApi.bookmarks });
export const useHistory = () => useQuery({ queryKey: queryKeys.student.history, queryFn: studentApi.history });
export const useRecommendations = (subjectId?: string) =>
  useQuery({ queryKey: queryKeys.practice.recommendations(subjectId), queryFn: () => studentApi.recommendations(subjectId) });
