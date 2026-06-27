/**
 * @file questions.module.ts
 * @module Questions
 *
 * QuestionsModule — the Question Bank core (Sprint 2.6).
 *
 * Services are split by responsibility:
 *  - QuestionService          : CRUD + clone
 *  - QuestionWorkflowService  : status machine + multi-stage review
 *  - QuestionSearchService    : search + version history + bulk import/export
 *  - QuestionMapperService    : pure row→DTO mapping (shared)
 *
 * Reuses AuthModule (RolesGuard) and RbacModule (PermissionGuard,
 * UserRoleService). DatabaseModule + CacheModule are @Global. EventEmitter2 is
 * registered globally in AppModule.
 *
 * Exports the read/CRUD services so future modules (AI Generator, Practice,
 * Mock Exams, Analytics) can compose on top without duplicating logic.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { QuestionController } from './controllers/question.controller';
import { QuestionWorkflowController } from './controllers/question-workflow.controller';
import { QuestionService } from './services/question.service';
import { QuestionWorkflowService } from './services/question-workflow.service';
import { QuestionSearchService } from './services/question-search.service';
import { QuestionMapperService } from './services/question-mapper.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [QuestionController, QuestionWorkflowController],
  providers: [
    QuestionService,
    QuestionWorkflowService,
    QuestionSearchService,
    QuestionMapperService,
  ],
  exports: [QuestionService, QuestionSearchService, QuestionWorkflowService],
})
export class QuestionsModule {}
