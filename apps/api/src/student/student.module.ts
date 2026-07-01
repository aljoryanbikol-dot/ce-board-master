/**
 * @file student.module.ts
 * @module Student
 *
 * StudentModule — the Enterprise Student Learning Platform (Sprint 3.1). It wires
 * the six logical sub-modules from the brief into one cohesive module:
 *
 *   • StudentModule        → cross-cutting student platform root
 *   • DashboardModule      → StudentDashboardController + StudentDashboardService
 *   • PracticeModule       → PracticeController + PracticeSessionService + QuestionRecommendationService
 *   • StudyPlannerModule   → StudyPlannerController + StudyPlannerService
 *   • ProgressModule       → ProgressController + ProgressTrackingService + StudentStatisticsService + LearningPathService
 *   • AchievementModule    → AchievementController + AchievementService
 *
 * Plus EngagementService (bookmarks/favorites/recently-viewed/history) behind the
 * EngagementController. Integrates with frozen Auth (JwtAuthGuard), RBAC
 * (PermissionGuard + student.* permissions), the Question Bank, Knowledge Base,
 * AI engine (recommendation/path are AI-ready seams), and the cache.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { QuestionsModule } from '../questions/questions.module';
// Controllers
import { StudentDashboardController } from './controllers/student-dashboard.controller';
import { PracticeController } from './controllers/practice.controller';
import { ProgressController } from './controllers/progress.controller';
import { AchievementController } from './controllers/achievement.controller';
import { StudyPlannerController } from './controllers/study-planner.controller';
import { EngagementController } from './controllers/engagement.controller';
// Services
import { StudentDashboardService } from './services/student-dashboard.service';
import { PracticeSessionService } from './services/practice-session.service';
import { StudyPlannerService } from './services/study-planner.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { AchievementService } from './services/achievement.service';
import { LearningPathService } from './services/learning-path.service';
import { QuestionRecommendationService } from './services/question-recommendation.service';
import { StudentStatisticsService } from './services/student-statistics.service';
import { EngagementService } from './services/engagement.service';

@Module({
  imports: [AuthModule, RbacModule, QuestionsModule],
  controllers: [
    StudentDashboardController,
    PracticeController,
    ProgressController,
    AchievementController,
    StudyPlannerController,
    EngagementController,
  ],
  providers: [
    StudentDashboardService,
    PracticeSessionService,
    StudyPlannerService,
    ProgressTrackingService,
    AchievementService,
    LearningPathService,
    QuestionRecommendationService,
    StudentStatisticsService,
    EngagementService,
  ],
  exports: [
    StudentDashboardService,
    ProgressTrackingService,
    AchievementService,
    QuestionRecommendationService,
  ],
})
export class StudentModule {}
