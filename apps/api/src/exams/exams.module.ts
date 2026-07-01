/**
 * @file exams.module.ts
 * @module Exams
 *
 * ExamsModule — the Enterprise Mock Examination Engine (Sprint 3.2). Wires the
 * five logical sub-modules from the brief into one cohesive module:
 *
 *   • MockExamModule       → MockExamController + MockExamService
 *   • ExamSessionModule    → ExamSessionController + ExamSessionService + ExamTimerService
 *   • ExamScoringModule    → ExamResultController + ExamScoringService + ExamResultService
 *   • ExamReviewModule     → ExamReviewController + ExamReviewService + ExamRecommendationService
 *   • ExamAnalyticsModule  → ExamAnalyticsController + ExamAnalyticsService
 *
 * Integrates with frozen Auth (JwtAuthGuard), RBAC (PermissionGuard + exam.*
 * permissions), the Question Bank (read-only question source), and the Student
 * Learning Platform (imports StudentModule to reuse ProgressTrackingService and
 * QuestionRecommendationService — exams advance the same progress system and the
 * AI-ready recommender, with zero duplicated business logic).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { StudentModule } from '../student/student.module';
import { QuestionsModule } from '../questions/questions.module';
// Controllers
import { MockExamController } from './controllers/mock-exam.controller';
import { ExamSessionController } from './controllers/exam-session.controller';
import { ExamResultController } from './controllers/exam-result.controller';
import { ExamReviewController } from './controllers/exam-review.controller';
import { ExamAnalyticsController } from './controllers/exam-analytics.controller';
// Services
import { MockExamService } from './services/mock-exam.service';
import { ExamSessionService } from './services/exam-session.service';
import { ExamTimerService } from './services/exam-timer.service';
import { ExamScoringService } from './services/exam-scoring.service';
import { ExamResultService } from './services/exam-result.service';
import { ExamReviewService } from './services/exam-review.service';
import { ExamAnalyticsService } from './services/exam-analytics.service';
import { ExamRecommendationService } from './services/exam-recommendation.service';

@Module({
  imports: [AuthModule, RbacModule, StudentModule, QuestionsModule],
  controllers: [
    MockExamController,
    ExamSessionController,
    ExamResultController,
    ExamReviewController,
    ExamAnalyticsController,
  ],
  providers: [
    MockExamService,
    ExamSessionService,
    ExamTimerService,
    ExamScoringService,
    ExamResultService,
    ExamReviewService,
    ExamAnalyticsService,
    ExamRecommendationService,
  ],
  exports: [
    MockExamService,
    ExamSessionService,
    ExamScoringService,
    ExamResultService,
    ExamAnalyticsService,
  ],
})
export class ExamsModule {}
