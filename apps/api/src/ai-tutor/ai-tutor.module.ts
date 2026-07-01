/**
 * @file ai-tutor.module.ts
 * @module AITutor
 *
 * AITutorModule — the Enterprise AI Tutor & Intelligent Learning Assistant
 * (Sprint 3.3). Wires the seven logical sub-modules from the brief into one
 * cohesive module:
 *
 *   • AITutorModule        → AITutorController + AITutorService (chat hub)
 *   • ConversationModule   → ConversationController + ConversationService (memory)
 *   • ExplanationModule    → ExplanationController + ExplanationService
 *   • HintModule           → HintController + HintService
 *   • FormulaAssistantModule → FormulaAssistantController + FormulaAssistantService
 *   • SolutionEngineModule → SolutionController + SolutionService
 *   • RecommendationModule → RecommendationController + RecommendationService
 *
 * Plus the LearningCoachService (AI Learning Coach) behind CoachingController,
 * the TutorContextService (KB grounding chokepoint), and GroundingValidationService.
 *
 * The tutor is powered by the TUTOR_PROVIDER seam (deterministic now, LLM-ready)
 * and integrates with frozen Auth (JwtAuthGuard), RBAC (PermissionGuard + tutor.*),
 * the Question Bank, the Knowledge Base, the AI Generation Engine, the Student
 * Learning Platform (StudentModule) and the Mock Examination Engine (ExamsModule).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { StudentModule } from '../student/student.module';
import { ExamsModule } from '../exams/exams.module';
import { AiModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { QuestionsModule } from '../questions/questions.module';
// Controllers
import { AITutorController } from './controllers/ai-tutor.controller';
import { ConversationController } from './controllers/conversation.controller';
import { ExplanationController } from './controllers/explanation.controller';
import { HintController } from './controllers/hint.controller';
import { SolutionController } from './controllers/solution.controller';
import { FormulaAssistantController } from './controllers/formula-assistant.controller';
import { RecommendationController } from './controllers/recommendation.controller';
import { CoachingController } from './controllers/coaching.controller';
// Services
import { AITutorService } from './services/ai-tutor.service';
import { ConversationService } from './services/conversation.service';
import { ExplanationService } from './services/explanation.service';
import { HintService } from './services/hint.service';
import { SolutionService } from './services/solution.service';
import { FormulaAssistantService } from './services/formula-assistant.service';
import { RecommendationService } from './services/recommendation.service';
import { LearningCoachService } from './services/learning-coach.service';
import { TutorContextService } from './services/tutor-context.service';
import { GroundingValidationService } from './services/grounding-validation.service';
// Provider seam
import { TUTOR_PROVIDER } from './providers/tutor-provider.interface';
import { DeterministicTutorProvider } from './providers/deterministic-tutor.provider';

@Module({
  imports: [AuthModule, RbacModule, StudentModule, ExamsModule, AiModule, KnowledgeModule, QuestionsModule],
  controllers: [
    AITutorController,
    ConversationController,
    ExplanationController,
    HintController,
    SolutionController,
    FormulaAssistantController,
    RecommendationController,
    CoachingController,
  ],
  providers: [
    AITutorService,
    ConversationService,
    ExplanationService,
    HintService,
    SolutionService,
    FormulaAssistantService,
    RecommendationService,
    LearningCoachService,
    TutorContextService,
    GroundingValidationService,
    { provide: TUTOR_PROVIDER, useClass: DeterministicTutorProvider },
  ],
  exports: [
    AITutorService,
    ConversationService,
    LearningCoachService,
    RecommendationService,
  ],
})
export class AITutorModule {}
