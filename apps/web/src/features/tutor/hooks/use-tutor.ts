'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { tutorApi } from '../api/tutor-api';

export const useConversations = () => useQuery({ queryKey: queryKeys.tutor.conversations, queryFn: tutorApi.conversations });
export const useCoaching = (unreadOnly?: boolean) => useQuery({ queryKey: [...queryKeys.tutor.coaching, unreadOnly ?? false], queryFn: () => tutorApi.coaching(unreadOnly) });
export const useTutorRecommendations = () => useQuery({ queryKey: queryKeys.tutor.recommendations, queryFn: tutorApi.recommendations });

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { message: string; intent?: string; questionId?: string }) => tutorApi.sendMessage(conversationId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tutor.conversation(conversationId) }),
  });
}

export function useGenerateCoaching() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: tutorApi.generateCoaching, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tutor.coaching }) });
}
