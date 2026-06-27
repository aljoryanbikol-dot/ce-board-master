/**
 * @file distractor.service.ts
 * @module AI/Services
 *
 * DistractorService — produces distractors (wrong answers) for a question
 * grounded in a Learning Objective. Every distractor is derived from the
 * published Misconception Library so each wrong answer maps to a real,
 * catalogued error — the enterprise requirement that distractors are pedagogical,
 * not arbitrary. Composes the context builder + provider.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ContextBuilderService } from './context-builder.service';
import { DeterministicGenerationProvider } from '../providers/deterministic.provider';
import { AI_LIMITS } from '../constants/ai.constants';
import type { GeneratedChoice } from '../types/ai.types';
import type { GenerateDistractorsDto } from '../dto/ai.dto';

@Injectable()
export class DistractorService {
  private readonly logger = new Logger(DistractorService.name);

  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly provider: DeterministicGenerationProvider,
  ) {}

  async generate(dto: GenerateDistractorsDto): Promise<{ learningObjectiveId: string; distractors: GeneratedChoice[] }> {
    const context = await this.contextBuilder.fromLearningObjective(dto.learningObjectiveId, 'moderate');
    if (context.misconceptions.length === 0) {
      this.logger.warn({ message: 'No published misconceptions for LO; distractors will be generic', lo: dto.learningObjectiveId });
    }
    const seed = dto.seed ?? `distractors:${dto.learningObjectiveId}:${dto.count}`;
    const draft = await this.provider.generateQuestion({ context, variantType: 'conceptual', seed });
    const distractors = draft.choices.filter((c) => !c.isCorrect).slice(0, Math.min(dto.count, AI_LIMITS.MAX_DISTRACTORS));
    return { learningObjectiveId: dto.learningObjectiveId, distractors };
  }
}
