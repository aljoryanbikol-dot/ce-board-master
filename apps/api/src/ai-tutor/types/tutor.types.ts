/**
 * @file tutor.types.ts
 * @module AITutor/Types
 */

export interface Citation {
  kind: 'learning_objective' | 'formula' | 'misconception' | 'blueprint' | 'knowledge_document' | 'question';
  refId: string;
  label: string;
  snippet?: string;
}

/** The grounding context the tutor assembles before answering (from the KB). */
export interface TutorContext {
  subjectId: string | null;
  topicId: string | null;
  learningObjectives: { publicId: string; statement: string }[];
  formulas: { id: string; name: string; expression: string }[];
  misconceptions: { publicId: string; title: string; description: string }[];
  memorySummary: string | null;
  recentTurns: { role: string; content: string }[];
}

/** A produced tutor answer (provider output + grounding). */
export interface TutorAnswer {
  content: string;
  intent: string;
  citations: Citation[];
  groundedInKb: boolean;
  validatedOk: boolean;
  followUps: string[];
  providerName: string;
  tokensIn: number;
  tokensOut: number;
}

export interface HintResult {
  level: number;
  hint: string;
  nextLevelAvailable: boolean;
  citations: Citation[];
}

export interface SolutionStep {
  order: number;
  text: string;
  formulaRef?: string;
}

export interface SolutionResult {
  questionId: string;
  steps: SolutionStep[];
  finalAnswer: string;
  citations: Citation[];
  groundedInKb: boolean;
}

export interface ExplanationResult {
  content: string;
  citations: Citation[];
  groundedInKb: boolean;
  followUps: string[];
}

export interface FormulaAnswer {
  query: string;
  formulas: { id: string; name: string; expression: string; latex?: string; subjectId: string }[];
  guidance: string;
}

export interface CoachingNoteView {
  id: string;
  trigger: string;
  title: string;
  message: string;
  subjectId: string | null;
  topicId: string | null;
  priority: number;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationView {
  id: string;
  title: string;
  status: string;
  subjectId: string | null;
  topicId: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}
