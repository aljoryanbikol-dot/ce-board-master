/**
 * @file generation-provider.interface.ts
 * @module AI/Providers
 *
 * The GenerationProvider abstraction. The pipeline depends on this interface,
 * never on a concrete model — so a real LLM provider can be slotted in later
 * (behind the same contract) without changing the engine, the validation
 * pipeline, or the controllers (Dependency Inversion).
 */
import type { GeneratedQuestionDraft, ProviderGenerateInput } from '../types/ai.types';

export const GENERATION_PROVIDER = Symbol('GENERATION_PROVIDER');

export interface GenerationProvider {
  readonly name: string;
  /** Produce a single grounded question draft from a Knowledge Base context. */
  generateQuestion(input: ProviderGenerateInput): Promise<GeneratedQuestionDraft>;
  /** Produce an explanation for an existing draft (used by ExplanationService). */
  generateExplanation(draft: GeneratedQuestionDraft): Promise<{ explanationText: string; solutionSteps: string[] }>;
}
