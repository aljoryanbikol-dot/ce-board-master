/**
 * @file tutor-api.ts — wrappers over /tutor/* (Sprint 3.3).
 */
import { api } from '@/lib/api/client';

export interface TutorCitation { kind: string; refId: string; label: string; snippet?: string; }
export interface TutorAnswer { content: string; intent: string; citations: TutorCitation[]; groundedInKb: boolean; followUps: string[]; }
export interface Conversation { id: string; title: string; status: string; messageCount: number; lastMessageAt: string | null; createdAt: string; }

export const tutorApi = {
  startConversation: (body: { title?: string; subjectId?: string; topicId?: string; firstMessage?: string }) =>
    api.data(api.post('/tutor/conversations', body)),
  sendMessage: (conversationId: string, body: { message: string; intent?: string; questionId?: string }) =>
    api.data<TutorAnswer>(api.post(`/tutor/conversations/${conversationId}/messages`, body)),
  ask: (body: { question: string; subjectId?: string; topicId?: string }) => api.data(api.post('/tutor/ask', body)),
  conversations: () => api.data<{ data: Conversation[]; pagination: { cursor: string | null; hasMore: boolean } }>(api.get('/tutor/conversations')),
  messages: (conversationId: string) => api.data(api.get(`/tutor/conversations/${conversationId}/messages`)),
  archive: (conversationId: string) => api.data(api.delete(`/tutor/conversations/${conversationId}`)),
  explainConcept: (body: { concept: string; subjectId?: string; topicId?: string }) => api.data(api.post('/tutor/explain/concept', body)),
  explainQuestion: (questionId: string) => api.data(api.post('/tutor/explain/question', { questionId })),
  hint: (body: { questionId: string; level?: number }) => api.data(api.post('/tutor/hint', body)),
  solution: (questionId: string) => api.data(api.post('/tutor/solution', { questionId })),
  formula: (body: { query: string; subjectId?: string; topicId?: string }) => api.data(api.post('/tutor/formula', body)),
  recommendations: () => api.data(api.get('/tutor/recommendations')),
  coaching: (unreadOnly?: boolean) => api.data(api.get('/tutor/coaching', { query: { unreadOnly } })),
  generateCoaching: () => api.data(api.post('/tutor/coaching/generate')),
  coachFromExam: (examId: string) => api.data(api.post(`/tutor/coaching/from-exam/${examId}`)),
  markRead: (id: string) => api.data(api.post(`/tutor/coaching/${id}/read`)),
  dismiss: (id: string) => api.data(api.post(`/tutor/coaching/${id}/dismiss`)),
};
