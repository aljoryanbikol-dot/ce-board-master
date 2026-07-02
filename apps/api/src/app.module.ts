/**
 * AppModule — Root module for CE Board Master API.
 *
 * Architecture (Phase 3B, Section 3):
 * - Modular monolith: each domain is a separate NestJS module with clear
 *   boundaries. Modules communicate only through their exported services.
 * - Global modules (DatabaseModule, CacheModule, QueueModule) are @Global()
 *   and only imported once here.
 * - Feature modules are registered by domain.
 *
 * Security (Sprint 2.1):
 * JwtAuthGuard is registered as a global APP_GUARD. This means ALL routes
 * require authentication by default. Use @Public() to opt out.
 * This is safer than opt-in authentication.
 *
 * Module load order matters for dependency resolution. Infrastructure modules
 * (Config, Database, Cache, Queue) must load before feature modules.
 */
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

// Infrastructure Modules
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';

// Feature Modules
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule }  from './rbac/rbac.module';
import { UsersModule }    from './users/users.module';
import { ProfileModule }  from './profiles/profiles.module';
import { BillingModule } from './billing/billing.module';
import { SubscriptionModule } from './subscriptions/subscriptions.module';
import { PaymentModule } from './payments/payments.module';
import { QuestionsModule } from './questions/questions.module';
import { CmsModule } from './cms/cms.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LearningObjectiveModule } from './learning-objectives/learning-objective.module';
import { FormulaModule } from './formulas/formula.module';
import { BlueprintModule } from './blueprints/blueprint.module';
import { MisconceptionModule } from './misconceptions/misconception.module';
import { EditorialModule } from './editorial/editorial.module';
import { AiModule } from './ai/ai.module';
import { StudentModule } from './student/student.module';
import { ExamsModule } from './exams/exams.module';
import { AITutorModule } from './ai-tutor/ai-tutor.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { ContentSyncModule } from './content-sync/content-sync.module';
import { PlatformAnalyticsModule } from './platform-analytics/platform-analytics.module';

// Global Guards
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

// Middleware
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import type { AppEnvironment } from './config/configuration';

@Module({
  imports: [
    // ── Infrastructure ─────────────────────────────────────────────────────
    AppConfigModule,     // Typed env config (global)
    DatabaseModule,      // Prisma + PostgreSQL (global)
    CacheModule,         // Redis cache (global)
    QueueModule,         // BullMQ queues (global)

    // ── Event Bus ──────────────────────────────────────────────────────────
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),

    // ── Rate Limiting ───────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnvironment>) => ({
        throttlers: [
          {
            name: 'global',
            ttl: 60_000,
            limit: config.get('RATE_LIMIT_GLOBAL', { infer: true })!,
          },
          // Tighter window for brute-force-sensitive auth endpoints
          // (login, register, password reset, MFA) — opt in per-route via
          // @Throttle({ auth: { limit, ttl } }), falls back to 'global' above
          // for every other route.
          {
            name: 'auth',
            ttl: 60_000,
            limit: 10,
          },
        ],
      }),
    }),

    // ── Feature Modules ────────────────────────────────────────────────────
    HealthModule,   // GET /health, GET /health/detailed
    AuthModule,     // JWT + Passport authentication infrastructure (Sprint 2.1)
    RbacModule,     // Enterprise RBAC — roles, permissions, permission guard (Sprint 2.3)
    UsersModule,    // Admin user management (Sprint 2.4)
    ProfileModule,  // Self-service profile management (Sprint 2.4)
    BillingModule,       // Invoice & receipt generation (Sprint 2.5)
    SubscriptionModule,  // Subscription lifecycle & plans (Sprint 2.5)
    PaymentModule,       // Payment orchestration & provider abstraction (Sprint 2.5)
    QuestionsModule,     // Question Bank core — CRUD, workflow, search (Sprint 2.6)
    CmsModule,           // Admin CMS — locking, assignment, comments, bulk (Sprint 2.7)
    DashboardModule,     // Admin CMS dashboard — stats, queues, activity (Sprint 2.7)
    KnowledgeModule,     // Content Knowledge Base core — ingestion, validation, graph, search (Sprint 2.8)
    LearningObjectiveModule, // Learning Objective spine (Sprint 2.8)
    FormulaModule,       // Formula Library (Sprint 2.8)
    BlueprintModule,     // Question Blueprints (Sprint 2.8)
    MisconceptionModule, // Misconception Library (Sprint 2.8)
    EditorialModule,     // Editorial & standards documents (Sprint 2.8)
    AiModule,            // AI Content Generation Engine (Sprint 2.9)
    StudentModule,       // Student Learning Platform (Sprint 3.1)
    ExamsModule,         // Mock Examination Engine (Sprint 3.2)
    AITutorModule,       // AI Tutor & Intelligent Learning Assistant (Sprint 3.3)
    TaxonomyModule,      // Admin taxonomy CRUD — subjects/topics/subtopics (Phase 1 CMS)
    ContentSyncModule,   // Generic Knowledge Library sync engine (type-aware models)
    PlatformAnalyticsModule, // Admin platform-wide analytics — users, revenue, usage (Sprint 3.5)

    // Sprint 2.2+ modules registered here as implemented:
    // UsersModule,
    // ProfilesModule,
    // SubjectsModule,
    // ...
  ],

  providers: [
    // ── Global Rate-Limit Guard ─────────────────────────────────────────────
    // ThrottlerModule only registers the throttler *storage/config* — without
    // this guard bound, @Throttle()/the default 'global' limit are never
    // actually enforced on any route. Registered first so unauthenticated
    // floods are rejected before JwtAuthGuard does any work.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // ── Global JWT Authentication Guard ────────────────────────────────────
    // Registered here (not in AuthModule) so it applies to ALL modules globally.
    // Routes use @Public() to opt out of authentication.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Apply middleware in order. Middleware executes before guards,
   * interceptors, and pipes.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
