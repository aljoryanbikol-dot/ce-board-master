/**
 * @file cms.module.ts
 * @module Cms
 *
 * CmsModule — Admin CMS Foundation (Sprint 2.7).
 *
 * Composes the frozen Question Bank (Sprint 2.6): imports QuestionsModule to
 * inject QuestionService / QuestionSearchService / QuestionWorkflowService, so
 * all question content/workflow logic stays in one place. Owns the new
 * collaboration entities (locks, assignments, comments, editorial notes) and
 * the CMS aggregation/search engine.
 *
 * Exports CmsAnalyticsService so the DashboardModule composes on it.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { QuestionsModule } from '../questions/questions.module';
import { CmsQuestionController } from './controllers/cms-question.controller';
import { CmsWorkflowController } from './controllers/cms-workflow.controller';
import { CmsQuestionService } from './services/cms-question.service';
import { CmsWorkflowService } from './services/cms-workflow.service';
import { CmsAnalyticsService } from './services/cms-analytics.service';

@Module({
  imports: [AuthModule, RbacModule, QuestionsModule],
  controllers: [CmsQuestionController, CmsWorkflowController],
  providers: [CmsQuestionService, CmsWorkflowService, CmsAnalyticsService],
  exports: [CmsQuestionService, CmsWorkflowService, CmsAnalyticsService],
})
export class CmsModule {}
