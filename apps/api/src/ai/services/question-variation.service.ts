/**
 * @file question-variation.service.ts
 * @module AI/Services
 *
 * QuestionVariationService — produces numerical and conceptual variants of a
 * base generation. Numerical variants re-seed the operands; conceptual variants
 * re-pose the principle. All variants stay grounded in the SAME Knowledge Base
 * context as the source, and are deduplicated by content hash so a request never
 * returns two identical items.
 */
import { Injectable, Logger } from '@nestjs/common';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import { ExplanationService } from './explanation.service';
import { AiErrors } from '../errors/ai.errors';
import { AI_LIMITS } from '../constants/ai.constants';
import type { GeneratedQuestionDraft, GenerationContext } from '../types/ai.types';

@Injectable()
export class QuestionVariationService {
  private readonly logger = new Logger(QuestionVariationService.name);

  constructor(
    private readonly provider: DeterministicGenerationProvider,
    private readonly explanation: ExplanationService,
  ) {}

  async generateVariants(
    context: GenerationContext,
    variantType: 'numerical' | 'conceptual',
    count: number,
    seedBase: string,
  ): Promise<GeneratedQuestionDraft[]> {
    if (count < 1 || count > AI_LIMITS.MAX_VARIANTS_PER_REQUEST) {
      throw AiErrors.invalidVariantRequest(`count must be between 1 and ${AI_LIMITS.MAX_VARIANTS_PER_REQUEST}.`);
    }
    const drafts: GeneratedQuestionDraft[] = [];
    const seen = new Set<string>();
    let attempts = 0;
    const maxAttempts = count * 4;

    while (drafts.length < count && attempts < maxAttempts) {
      const seed = `${seedBase}:${variantType}:${attempts}`;
      let draft = await this.provider.generateQuestion({ context, variantType, seed });
      draft = await this.explanation.enrich(draft);
      attempts++;
      if (seen.has(draft.contentHash)) continue;
      seen.add(draft.contentHash);
      drafts.push(draft);
    }
    this.logger.log({ message: 'Variants generated', variantType, requested: count, produced: drafts.length });
    return drafts;
  }
}
