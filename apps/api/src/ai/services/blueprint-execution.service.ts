/**
 * @file blueprint-execution.service.ts
 * @module AI/Services
 *
 * BlueprintExecutionService — executes a published Question Blueprint into one or
 * more grounded question drafts. The blueprint's declared type and structure
 * shape the generation (e.g. computational → numerical variant), and its primary
 * Learning Objective + the subject's misconceptions ground the content. Composes
 * the context builder, provider, and explanation enrichment; produces drafts that
 * the pipeline then validates.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ContextBuilderService } from './context-builder.service';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import { ExplanationService } from './explanation.service';
import type { GeneratedQuestionDraft } from '../types/ai.types';
import type { GenerationContext } from '../types/ai.types';

@Injectable()
export class BlueprintExecutionService {
  private readonly logger = new Logger(BlueprintExecutionService.name);

  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly provider: DeterministicGenerationProvider,
    private readonly explanation: ExplanationService,
  ) {}

  /** Resolve a blueprint into a grounded context. */
  async buildContext(blueprintId: string, band: string): Promise<GenerationContext> {
    return this.contextBuilder.fromBlueprint(blueprintId, band);
  }

  /** Execute a blueprint context into N drafts (seeded, deduplicated by hash). */
  async execute(context: GenerationContext, count: number, seedBase: string): Promise<GeneratedQuestionDraft[]> {
    const variantType = this.variantTypeForBlueprint(context.blueprint?.blueprintType);
    const drafts: GeneratedQuestionDraft[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < count; i++) {
      const seed = `${seedBase}:${i}`;
      let draft = await this.provider.generateQuestion({ context, variantType, seed });
      draft = await this.explanation.enrich(draft);
      if (seen.has(draft.contentHash)) {
        this.logger.debug({ message: 'Skipped duplicate blueprint variant', index: i });
        continue;
      }
      seen.add(draft.contentHash);
      drafts.push(draft);
    }
    return drafts;
  }

  private variantTypeForBlueprint(blueprintType?: string): 'base' | 'numerical' | 'conceptual' {
    switch (blueprintType) {
      case 'CMP': case 'MUL': case 'DSG': return 'numerical';
      case 'CON': case 'SCN': case 'CAS': return 'conceptual';
      default: return 'base';
    }
  }
}
