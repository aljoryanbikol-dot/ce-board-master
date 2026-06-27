/**
 * @file ai.module.ts
 * @module AI
 *
 * AiModule — the Enterprise AI Content Generation Engine (Sprint 2.9). It wires
 * the seven logical sub-engines specified in the brief into one cohesive module:
 *
 *   • AIContentModule          → AIContentService (orchestrator)
 *   • PromptEngineModule       → PromptBuilderService
 *   • GenerationPipelineModule → ContextBuilderService + GenerationProvider
 *   • ValidationModule         → ValidationService (the pipeline gate)
 *   • ExplanationModule        → ExplanationService
 *   • DistractorEngineModule   → DistractorService
 *   • BlueprintExecutionModule → BlueprintExecutionService
 *
 * Plus DifficultyScalingService and QuestionVariationService. The engine is
 * grounded EXCLUSIVELY in the Sprint 2.8 Knowledge Base (KnowledgeModule), and
 * every output passes ValidationService before it can be promoted to the CMS.
 *
 * The GenerationProvider is bound to the deterministic implementation; an
 * LLM-backed provider can replace it via this single binding without touching
 * any service (Dependency Inversion).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AIContentController } from './controllers/ai-content.controller';
import { AICapabilityController } from './controllers/ai-capability.controller';
import { AIContentService } from './services/ai-content.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { ContextBuilderService } from './services/context-builder.service';
import { ValidationService } from './services/validation.service';
import { ExplanationService } from './services/explanation.service';
import { DistractorService } from './services/distractor.service';
import { BlueprintExecutionService } from './services/blueprint-execution.service';
import { QuestionVariationService } from './services/question-variation.service';
import { DifficultyScalingService } from './services/difficulty-scaling.service';
import { DeterministicGenerationProvider } from './providers/deterministic.provider';
import { GENERATION_PROVIDER } from './providers/generation-provider.interface';

@Module({
  imports: [AuthModule, RbacModule, KnowledgeModule],
  controllers: [AIContentController, AICapabilityController],
  providers: [
    AIContentService,
    PromptBuilderService,
    ContextBuilderService,
    ValidationService,
    ExplanationService,
    DistractorService,
    BlueprintExecutionService,
    QuestionVariationService,
    DifficultyScalingService,
    DeterministicGenerationProvider,
    { provide: GENERATION_PROVIDER, useExisting: DeterministicGenerationProvider },
  ],
  exports: [
    AIContentService,
    ValidationService,
    BlueprintExecutionService,
    QuestionVariationService,
    DifficultyScalingService,
  ],
})
export class AiModule {}
