/**
 * @file tutor-provider.interface.ts
 * @module AITutor/Providers
 *
 * The TutorProvider seam: the single boundary between the tutor's orchestration
 * and the text-generation backend. Today a deterministic, dependency-free
 * implementation grounds answers in the Knowledge Base context. An LLM-backed
 * provider can be dropped in behind this interface with zero changes to the
 * services that depend on it (DI token below).
 */
import type { TutorContext } from '../types/tutor.types';

export const TUTOR_PROVIDER = Symbol('TUTOR_PROVIDER');

export interface TutorProviderInput {
  intent: string;
  prompt: string;
  context: TutorContext;
  questionContext?: { stemText: string; correctChoice: string; explanationText: string | null } | null;
  hintLevel?: number;
}

export interface TutorProviderOutput {
  content: string;
  followUps: string[];
  tokensIn: number;
  tokensOut: number;
}

export interface TutorProvider {
  readonly name: string;
  /** Produce a grounded tutor answer for the given intent + context. */
  respond(input: TutorProviderInput): Promise<TutorProviderOutput>;
  /** Produce ordered solution steps for a question. */
  solve(input: { stemText: string; correctChoice: string; explanationText: string | null; context: TutorContext }): Promise<{ steps: string[]; finalAnswer: string; tokensIn: number; tokensOut: number }>;
}
