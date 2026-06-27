'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { studentApi } from '../api/student-api';

export const useDashboard = () => useQuery({ queryKey: queryKeys.student.dashboard, queryFn: studentApi.dashboard });
export const useProgress = () => useQuery({ queryKey: queryKeys.student.progress, queryFn: studentApi.progressStatistics });
export const useMastery = () => useQuery({ queryKey: [...queryKeys.student.progress, 'mastery'], queryFn: studentApi.mastery });
export const useWeakTopics = () => useQuery({ queryKey: queryKeys.student.weakTopics, queryFn: studentApi.weakTopics });
export const useAchievements = () => useQuery({ queryKey: queryKeys.student.achievements, queryFn: studentApi.achievements });
export const usePlanner = () => useQuery({ queryKey: queryKeys.student.planner, queryFn: studentApi.plannerCalendar });
export const useBookmarks = () => useQuery({ queryKey: queryKeys.student.bookmarks, queryFn: studentApi.bookmarks });
export const useHistory = () => useQuery({ queryKey: queryKeys.student.history, queryFn: studentApi.history });
export const useRecommendations = (subjectId?: string) =>
  useQuery({ queryKey: queryKeys.practice.recommendations(subjectId), queryFn: () => studentApi.recommendations(subjectId) });
