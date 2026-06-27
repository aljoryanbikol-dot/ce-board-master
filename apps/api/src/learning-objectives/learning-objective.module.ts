/**
 * @file learning-objective.module.ts
 * @module LearningObjectives
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LearningObjectiveController } from './controllers/learning-objective.controller';
import { LearningObjectiveService } from './services/learning-objective.service';

@Module({
  imports: [AuthModule, RbacModule, KnowledgeModule],
  controllers: [LearningObjectiveController],
  providers: [LearningObjectiveService],
  exports: [LearningObjectiveService],
})
export class LearningObjectiveModule {}
