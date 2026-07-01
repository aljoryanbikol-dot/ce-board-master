/**
 * @file platform-analytics.module.ts
 * @module PlatformAnalytics
 *
 * PlatformAnalyticsModule — admin-facing, platform-wide analytics (Sprint 3.5).
 * Read-only aggregations over existing tables (User, Subscription, Payment,
 * QuestionAttempt, MockExam, TutorConversation/Message) — no schema changes,
 * no writes.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { PlatformAnalyticsController } from './controllers/platform-analytics.controller';
import { PlatformAnalyticsService } from './services/platform-analytics.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [PlatformAnalyticsController],
  providers: [PlatformAnalyticsService],
})
export class PlatformAnalyticsModule {}
