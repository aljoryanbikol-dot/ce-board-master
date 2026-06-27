'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { examsApi } from '../api/exams-api';

export const useExamTemplates = () => useQuery({ queryKey: queryKeys.exams.templates, queryFn: examsApi.templates });
export const useExamHistory = () => useQuery({ queryKey: queryKeys.exams.history, queryFn: examsApi.history });
export const useExam = (id: string) => useQuery({ queryKey: queryKeys.exams.exam(id), queryFn: () => examsApi.get(id), enabled: !!id });
export const useExamResult = (id: string) => useQuery({ queryKey: queryKeys.exams.result(id), queryFn: () => examsApi.result(id), enabled: !!id });
export const useLeaderboard = (templateId?: string) => useQuery({ queryKey: queryKeys.exams.leaderboard(templateId), queryFn: () => examsApi.leaderboard(templateId) });
