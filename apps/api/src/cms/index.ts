/**
 * @file index.ts
 * @module Cms
 * Barrel export for the Admin CMS module (Sprint 2.7).
 */
export { CmsModule } from './cms.module';
export { CmsQuestionService } from './services/cms-question.service';
export { CmsWorkflowService } from './services/cms-workflow.service';
export { CmsAnalyticsService } from './services/cms-analytics.service';
export { CMS_ERROR_CODES, CMS_QUEUES, BULK_OPERATIONS, type CmsQueue, type BulkOperation } from './constants/cms.constants';
export { CmsErrors } from './cms.errors';
export type { LockView, AssignmentView, CommentView, EditorialNoteView, ActivityEntry, BulkOperationResult } from './types/cms.types';
