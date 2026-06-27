/**
 * @file explanation.service.ts
 * @module AI/Services
 *
 * ExplanationService — generates the explanation + ordered solution steps for a
 * question draft, grounded in the Knowledge Base (cites the governing principle
 * and authoritative formula). Delegates wording to the provider so an LLM can
 * replace the deterministic text without changing the contract.
 */
import { Injectable, Logger } from '@nestjs/common';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import type { GeneratedQuestionDraft } from '../types/ai.types';

@Injectable()
export class ExplanationService {
  private readonly logger = new Logger(ExplanationService.name);

  constructor(private readonly provider: DeterministicGenerationProvider) {}

  async generate(draft: GeneratedQuestionDraft): Promise<{ explanationText: string; solutionSteps: string[] }> {
    const result = await this.provider.generateExplanation(draft);
    this.logger.debug({ message: 'Explanation generated', steps: result.solutionSteps.length });
    return result;
  }

  /** Attach a freshly generated explanation to a draft (immutably). */
  async enrich(draft: GeneratedQuestionDraft): Promise<GeneratedQuestionDraft> {
    const { explanationText, solutionSteps } = await this.generate(draft);
    return { ...draft, explanationText, solutionSteps };
  }
}
