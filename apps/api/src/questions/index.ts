/**
 * @file index.ts
 * @module Questions
 * Barrel export for the Question Bank module (Sprint 2.6).
 */
export { QuestionsModule } from './questions.module';
export { QuestionService } from './services/question.service';
export { QuestionWorkflowService } from './services/question-workflow.service';
export { QuestionSearchService } from './services/question-search.service';
export { QuestionMapperService } from './services/question-mapper.service';
export { QUESTION_ERROR_CODES, REVIEW_STAGES, REVIEW_STAGE_ORDER, type ReviewStage, type QuestionErrorCode } from './constants/questions.constants';
export { TRANSITIONS, findTransition, type QStatus, type TransitionRule } from './constants/status-machine';
export { QuestionErrors } from './questions.errors';
export type {
  QuestionSummary, QuestionDetail, QuestionListResult,
  ChoiceView, WorkflowEntry, VersionEntry, VersionSnapshot,
} from './types/questions.types';
export {
  CreateQuestionSchema, type CreateQuestionDto,
  UpdateQuestionSchema, type UpdateQuestionDto,
} from './dto/question.dto';
export { SearchQuestionsSchema, type SearchQuestionsDto } from './dto/search.dto';
export { BulkImportSchema, type BulkImportDto, BulkExportSchema, type BulkExportDto } from './dto/bulk.dto';
