# CE Board Master — Complete Folder Tree

**Version:** 1.0.0 (production)
**Generated:** 2026-06-27

This document is the canonical structural map of the consolidated production monorepo.
Generated artifacts (`node_modules/`, `.next/`, `dist/`, `coverage/`, `.turbo/`) are
omitted — they are produced by `pnpm install` / `pnpm build`.

```
ce-board-master/
├── .husky/
│   ├── commit-msg
│   └── pre-commit
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   │   ├── 20260626000001_add_user_roles_and_rbac/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260627000001_add_user_profile_fields/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260627000002_add_subscription_billing/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260627000003_add_admin_cms/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260627000004_add_knowledge_base/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260627000005_add_ai_generation/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260627000006_add_student_platform/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260627000007_add_mock_exam_engine/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── 20260627000008_add_ai_tutor/
│   │   │   │   │   └── migration.sql
│   │   │   │   ├── .gitkeep
│   │   │   │   └── migration_lock.toml
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── adaptive/
│   │   │   ├── admin/
│   │   │   ├── ai/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── ai-capability.controller.spec.ts
│   │   │   │   │   ├── ai-content.controller.spec.ts
│   │   │   │   │   ├── ai-content.service.spec.ts
│   │   │   │   │   ├── blueprint-execution.service.spec.ts
│   │   │   │   │   ├── context-builder.service.spec.ts
│   │   │   │   │   ├── deterministic.provider.spec.ts
│   │   │   │   │   ├── difficulty-scaling.service.spec.ts
│   │   │   │   │   ├── distractor.service.spec.ts
│   │   │   │   │   ├── explanation.service.spec.ts
│   │   │   │   │   ├── prompt-builder.service.spec.ts
│   │   │   │   │   ├── question-variation.service.spec.ts
│   │   │   │   │   └── validation.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   │   └── ai.constants.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── ai-capability.controller.ts
│   │   │   │   │   └── ai-content.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── ai.dto.ts
│   │   │   │   ├── errors/
│   │   │   │   │   └── ai.errors.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── deterministic.provider.ts
│   │   │   │   │   └── generation-provider.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── ai-content.service.ts
│   │   │   │   │   ├── blueprint-execution.service.ts
│   │   │   │   │   ├── context-builder.service.ts
│   │   │   │   │   ├── difficulty-scaling.service.ts
│   │   │   │   │   ├── distractor.service.ts
│   │   │   │   │   ├── explanation.service.ts
│   │   │   │   │   ├── prompt-builder.service.ts
│   │   │   │   │   ├── question-variation.service.ts
│   │   │   │   │   └── validation.service.ts
│   │   │   │   ├── types/
│   │   │   │   │   └── ai.types.ts
│   │   │   │   ├── ai.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── ai-tutor/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── ai-tutor.service.spec.ts
│   │   │   │   │   ├── controllers.spec.ts
│   │   │   │   │   ├── conversation.service.spec.ts
│   │   │   │   │   ├── deterministic-tutor.provider.spec.ts
│   │   │   │   │   ├── explanation.service.spec.ts
│   │   │   │   │   ├── formula-assistant.service.spec.ts
│   │   │   │   │   ├── grounding-validation.service.spec.ts
│   │   │   │   │   ├── hint.service.spec.ts
│   │   │   │   │   ├── learning-coach.service.spec.ts
│   │   │   │   │   ├── recommendation.service.spec.ts
│   │   │   │   │   ├── solution.service.spec.ts
│   │   │   │   │   └── tutor-context.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   │   └── tutor.constants.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── ai-tutor.controller.ts
│   │   │   │   │   ├── coaching.controller.ts
│   │   │   │   │   ├── conversation.controller.ts
│   │   │   │   │   ├── explanation.controller.ts
│   │   │   │   │   ├── formula-assistant.controller.ts
│   │   │   │   │   ├── hint.controller.ts
│   │   │   │   │   ├── recommendation.controller.ts
│   │   │   │   │   └── solution.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── tutor.dto.ts
│   │   │   │   ├── errors/
│   │   │   │   │   └── tutor.errors.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── deterministic-tutor.provider.ts
│   │   │   │   │   └── tutor-provider.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── ai-tutor.service.ts
│   │   │   │   │   ├── conversation.service.ts
│   │   │   │   │   ├── explanation.service.ts
│   │   │   │   │   ├── formula-assistant.service.ts
│   │   │   │   │   ├── grounding-validation.service.ts
│   │   │   │   │   ├── hint.service.ts
│   │   │   │   │   ├── learning-coach.service.ts
│   │   │   │   │   ├── recommendation.service.ts
│   │   │   │   │   ├── solution.service.ts
│   │   │   │   │   └── tutor-context.service.ts
│   │   │   │   ├── types/
│   │   │   │   │   └── tutor.types.ts
│   │   │   │   ├── ai-tutor.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── analytics/
│   │   │   ├── auth/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── auth.controller.spec.ts
│   │   │   │   │   ├── auth.dto.spec.ts
│   │   │   │   │   ├── auth.service.spec.ts
│   │   │   │   │   ├── current-user.service.spec.ts
│   │   │   │   │   ├── email-verification.service.spec.ts
│   │   │   │   │   ├── email.service.spec.ts
│   │   │   │   │   ├── jwt-auth.guard.spec.ts
│   │   │   │   │   ├── lockout.service.spec.ts
│   │   │   │   │   ├── login.service.spec.ts
│   │   │   │   │   ├── logout.service.spec.ts
│   │   │   │   │   ├── mfa.service.spec.ts
│   │   │   │   │   ├── password-reset.service.spec.ts
│   │   │   │   │   ├── password.service.spec.ts
│   │   │   │   │   ├── register.service.spec.ts
│   │   │   │   │   ├── token.service.spec.ts
│   │   │   │   │   └── token.utils.spec.ts
│   │   │   │   ├── config/
│   │   │   │   │   ├── auth.config.ts
│   │   │   │   │   ├── cookie.config.ts
│   │   │   │   │   └── jwt.config.ts
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── current-user.decorator.ts
│   │   │   │   │   ├── public.decorator.ts
│   │   │   │   │   ├── requires-tier.decorator.ts
│   │   │   │   │   └── roles.decorator.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── google-auth.guard.ts
│   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   ├── local-auth.guard.ts
│   │   │   │   │   ├── refresh-token.guard.ts
│   │   │   │   │   └── roles.guard.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── current-user.service.ts
│   │   │   │   │   ├── email-verification.service.ts
│   │   │   │   │   ├── email.service.ts
│   │   │   │   │   ├── lockout.service.ts
│   │   │   │   │   ├── login.service.ts
│   │   │   │   │   ├── logout.service.ts
│   │   │   │   │   ├── mfa.service.ts
│   │   │   │   │   ├── password-reset.service.ts
│   │   │   │   │   ├── password.service.ts
│   │   │   │   │   ├── register.service.ts
│   │   │   │   │   └── token.service.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── google.strategy.ts
│   │   │   │   │   ├── jwt-refresh.strategy.ts
│   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   └── local.strategy.ts
│   │   │   │   ├── utils/
│   │   │   │   │   ├── cookie.utils.ts
│   │   │   │   │   ├── password.utils.ts
│   │   │   │   │   └── token.utils.ts
│   │   │   │   ├── auth.constants.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.dto.ts
│   │   │   │   ├── auth.interface.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── billing/
│   │   │   │   ├── __tests__/
│   │   │   │   │   └── billing.service.spec.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   └── billing.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── billing.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── billing.service.ts
│   │   │   │   ├── billing.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── blueprints/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── blueprint.controller.spec.ts
│   │   │   │   │   └── blueprint.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── blueprint.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── blueprint.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── blueprint.service.ts
│   │   │   │   ├── types/
│   │   │   │   ├── blueprint.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── cache/
│   │   │   │   ├── cache.module.ts
│   │   │   │   └── cache.service.ts
│   │   │   ├── cms/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── cms-analytics.service.spec.ts
│   │   │   │   │   ├── cms-question.controller.spec.ts
│   │   │   │   │   ├── cms-question.service.spec.ts
│   │   │   │   │   ├── cms-workflow.controller.spec.ts
│   │   │   │   │   └── cms-workflow.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   │   └── cms.constants.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── cms-question.controller.ts
│   │   │   │   │   └── cms-workflow.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── cms-search.dto.ts
│   │   │   │   │   └── cms.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── cms-analytics.service.ts
│   │   │   │   │   ├── cms-question.service.ts
│   │   │   │   │   └── cms-workflow.service.ts
│   │   │   │   ├── types/
│   │   │   │   │   └── cms.types.ts
│   │   │   │   ├── cms.errors.ts
│   │   │   │   ├── cms.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── common/
│   │   │   │   ├── constants/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── decorators/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── global-exception.filter.ts
│   │   │   │   ├── guards/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── logging.interceptor.ts
│   │   │   │   │   └── transform.interceptor.ts
│   │   │   │   ├── middleware/
│   │   │   │   │   └── request-id.middleware.ts
│   │   │   │   ├── pipes/
│   │   │   │   │   └── zod-validation.pipe.ts
│   │   │   │   └── types/
│   │   │   │       └── index.ts
│   │   │   ├── config/
│   │   │   │   ├── app-config.module.ts
│   │   │   │   ├── configuration.ts
│   │   │   │   └── index.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── dashboard.controller.spec.ts
│   │   │   │   │   └── dashboard.service.spec.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   └── dashboard.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   ├── services/
│   │   │   │   │   └── dashboard.service.ts
│   │   │   │   ├── types/
│   │   │   │   ├── dashboard.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── database/
│   │   │   │   ├── analytics-prisma.service.ts
│   │   │   │   ├── database.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── editorial/
│   │   │   │   ├── __tests__/
│   │   │   │   │   └── editorial.controller.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── editorial.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   ├── services/
│   │   │   │   │   └── editorial.service.ts
│   │   │   │   ├── types/
│   │   │   │   ├── editorial.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── exams/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── controllers.spec.ts
│   │   │   │   │   ├── exam-analytics.service.spec.ts
│   │   │   │   │   ├── exam-recommendation.service.spec.ts
│   │   │   │   │   ├── exam-result.service.spec.ts
│   │   │   │   │   ├── exam-review.service.spec.ts
│   │   │   │   │   ├── exam-scoring.service.spec.ts
│   │   │   │   │   ├── exam-session.service.spec.ts
│   │   │   │   │   ├── exam-timer.service.spec.ts
│   │   │   │   │   └── mock-exam.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   │   └── exam.constants.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── exam-analytics.controller.ts
│   │   │   │   │   ├── exam-result.controller.ts
│   │   │   │   │   ├── exam-review.controller.ts
│   │   │   │   │   ├── exam-session.controller.ts
│   │   │   │   │   └── mock-exam.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── exam.dto.ts
│   │   │   │   ├── errors/
│   │   │   │   │   └── exam.errors.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── exam-analytics.service.ts
│   │   │   │   │   ├── exam-recommendation.service.ts
│   │   │   │   │   ├── exam-result.service.ts
│   │   │   │   │   ├── exam-review.service.ts
│   │   │   │   │   ├── exam-scoring.service.ts
│   │   │   │   │   ├── exam-session.service.ts
│   │   │   │   │   ├── exam-timer.service.ts
│   │   │   │   │   └── mock-exam.service.ts
│   │   │   │   ├── types/
│   │   │   │   │   └── exam.types.ts
│   │   │   │   ├── exams.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── formulas/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── formula.controller.spec.ts
│   │   │   │   │   └── formula.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── formula.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── formula.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── formula.service.ts
│   │   │   │   ├── types/
│   │   │   │   ├── formula.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── health/
│   │   │   │   ├── health.controller.ts
│   │   │   │   └── health.module.ts
│   │   │   ├── knowledge/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── cross-reference.service.spec.ts
│   │   │   │   │   ├── document-parser.service.spec.ts
│   │   │   │   │   ├── knowledge-ingestion.service.spec.ts
│   │   │   │   │   ├── knowledge-integration.service.spec.ts
│   │   │   │   │   ├── knowledge-search.service.spec.ts
│   │   │   │   │   ├── knowledge.controller.spec.ts
│   │   │   │   │   ├── public-id.service.spec.ts
│   │   │   │   │   └── validation-engine.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   │   └── knowledge.constants.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   └── knowledge.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── knowledge.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── cross-reference.service.ts
│   │   │   │   │   ├── document-parser.service.ts
│   │   │   │   │   ├── knowledge-ingestion.service.ts
│   │   │   │   │   ├── knowledge-integration.service.ts
│   │   │   │   │   ├── knowledge-search.service.ts
│   │   │   │   │   ├── public-id.service.ts
│   │   │   │   │   └── validation-engine.service.ts
│   │   │   │   ├── types/
│   │   │   │   │   └── knowledge.types.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── knowledge.errors.ts
│   │   │   │   └── knowledge.module.ts
│   │   │   ├── learning-objectives/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── learning-objective.controller.spec.ts
│   │   │   │   │   └── learning-objective.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── learning-objective.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── learning-objective.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── learning-objective.service.ts
│   │   │   │   ├── types/
│   │   │   │   ├── index.ts
│   │   │   │   └── learning-objective.module.ts
│   │   │   ├── misconceptions/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── misconception.controller.spec.ts
│   │   │   │   │   └── misconception.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── misconception.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── misconception.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── misconception.service.ts
│   │   │   │   ├── types/
│   │   │   │   ├── index.ts
│   │   │   │   └── misconception.module.ts
│   │   │   ├── notifications/
│   │   │   ├── payments/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── mock-payment.provider.spec.ts
│   │   │   │   │   ├── payment-provider.factory.spec.ts
│   │   │   │   │   ├── payment.controller.spec.ts
│   │   │   │   │   ├── payment.service.spec.ts
│   │   │   │   │   └── raw-body.plugin.spec.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   └── payment.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── payment.dto.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── mock-payment.provider.ts
│   │   │   │   │   ├── paymongo.provider.ts
│   │   │   │   │   └── xendit.provider.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── payment-provider.factory.ts
│   │   │   │   │   └── payment.service.ts
│   │   │   │   ├── types/
│   │   │   │   │   └── payment-provider.interface.ts
│   │   │   │   ├── webhooks/
│   │   │   │   │   └── raw-body.plugin.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── payments.constants.ts
│   │   │   │   ├── payments.errors.ts
│   │   │   │   └── payments.module.ts
│   │   │   ├── profiles/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── profiles.controller.spec.ts
│   │   │   │   │   └── profiles.service.spec.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   └── profiles.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── profile.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── profiles.service.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── profiles.constants.ts
│   │   │   │   ├── profiles.errors.ts
│   │   │   │   ├── profiles.module.ts
│   │   │   │   └── profiles.types.ts
│   │   │   ├── questions/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── question-mapper.service.spec.ts
│   │   │   │   │   ├── question-search.service.spec.ts
│   │   │   │   │   ├── question-workflow.controller.spec.ts
│   │   │   │   │   ├── question-workflow.service.spec.ts
│   │   │   │   │   ├── question.controller.spec.ts
│   │   │   │   │   ├── question.service.spec.ts
│   │   │   │   │   └── status-machine.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   │   ├── questions.constants.ts
│   │   │   │   │   └── status-machine.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── question-workflow.controller.ts
│   │   │   │   │   └── question.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── bulk.dto.ts
│   │   │   │   │   ├── question.dto.ts
│   │   │   │   │   ├── review.dto.ts
│   │   │   │   │   └── search.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── question-mapper.service.ts
│   │   │   │   │   ├── question-search.service.ts
│   │   │   │   │   ├── question-workflow.service.ts
│   │   │   │   │   └── question.service.ts
│   │   │   │   ├── types/
│   │   │   │   │   └── questions.types.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── questions.errors.ts
│   │   │   │   └── questions.module.ts
│   │   │   ├── queue/
│   │   │   │   └── queue.module.ts
│   │   │   ├── rbac/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── permission.guard.spec.ts
│   │   │   │   │   ├── permissions.service.spec.ts
│   │   │   │   │   ├── roles.controller.spec.ts
│   │   │   │   │   ├── roles.service.spec.ts
│   │   │   │   │   └── user-role.service.spec.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── permissions.controller.ts
│   │   │   │   │   └── roles.controller.ts
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── permissions.decorator.ts
│   │   │   │   │   └── resource-owner.decorator.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── permission.dto.ts
│   │   │   │   │   └── role.dto.ts
│   │   │   │   ├── guards/
│   │   │   │   │   └── permission.guard.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── permissions.service.ts
│   │   │   │   │   ├── roles.service.ts
│   │   │   │   │   └── user-role.service.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── rbac.constants.ts
│   │   │   │   ├── rbac.errors.ts
│   │   │   │   ├── rbac.module.ts
│   │   │   │   └── rbac.types.ts
│   │   │   ├── search/
│   │   │   ├── student/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── achievement.service.spec.ts
│   │   │   │   │   ├── controllers.spec.ts
│   │   │   │   │   ├── engagement.service.spec.ts
│   │   │   │   │   ├── learning-path.service.spec.ts
│   │   │   │   │   ├── practice-session.service.spec.ts
│   │   │   │   │   ├── progress-tracking.service.spec.ts
│   │   │   │   │   ├── question-recommendation.service.spec.ts
│   │   │   │   │   ├── student-dashboard.service.spec.ts
│   │   │   │   │   ├── student-statistics.service.spec.ts
│   │   │   │   │   └── study-planner.service.spec.ts
│   │   │   │   ├── constants/
│   │   │   │   │   └── student.constants.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── achievement.controller.ts
│   │   │   │   │   ├── engagement.controller.ts
│   │   │   │   │   ├── practice.controller.ts
│   │   │   │   │   ├── progress.controller.ts
│   │   │   │   │   ├── student-dashboard.controller.ts
│   │   │   │   │   └── study-planner.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── student.dto.ts
│   │   │   │   ├── errors/
│   │   │   │   │   └── student.errors.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── achievement.service.ts
│   │   │   │   │   ├── engagement.service.ts
│   │   │   │   │   ├── learning-path.service.ts
│   │   │   │   │   ├── practice-session.service.ts
│   │   │   │   │   ├── progress-tracking.service.ts
│   │   │   │   │   ├── question-recommendation.service.ts
│   │   │   │   │   ├── student-dashboard.service.ts
│   │   │   │   │   ├── student-statistics.service.ts
│   │   │   │   │   └── study-planner.service.ts
│   │   │   │   ├── types/
│   │   │   │   │   └── student.types.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── student.module.ts
│   │   │   ├── study/
│   │   │   ├── subjects/
│   │   │   ├── subscriptions/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── plan.service.spec.ts
│   │   │   │   │   ├── subscription.controller.spec.ts
│   │   │   │   │   └── subscription.service.spec.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   └── subscription.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── plan.dto.ts
│   │   │   │   │   └── subscription.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── plan.service.ts
│   │   │   │   │   └── subscription.service.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── subscriptions.constants.ts
│   │   │   │   ├── subscriptions.errors.ts
│   │   │   │   └── subscriptions.module.ts
│   │   │   ├── subtopics/
│   │   │   ├── topics/
│   │   │   ├── uploads/
│   │   │   ├── users/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── users.controller.spec.ts
│   │   │   │   │   └── users.service.spec.ts
│   │   │   │   ├── controllers/
│   │   │   │   │   └── users.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── user.dto.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── users.service.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── users.constants.ts
│   │   │   │   ├── users.errors.ts
│   │   │   │   ├── users.module.ts
│   │   │   │   └── users.types.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/
│   │   │   ├── e2e/
│   │   │   │   ├── ai-generation.e2e-spec.ts
│   │   │   │   ├── ai-tutor.e2e-spec.ts
│   │   │   │   ├── auth.e2e-spec.ts
│   │   │   │   ├── cms.e2e-spec.ts
│   │   │   │   ├── global-setup.ts
│   │   │   │   ├── health.e2e-spec.ts
│   │   │   │   ├── knowledge.e2e-spec.ts
│   │   │   │   ├── mock-exam.e2e-spec.ts
│   │   │   │   ├── questions.e2e-spec.ts
│   │   │   │   ├── rbac.e2e-spec.ts
│   │   │   │   ├── setup.ts
│   │   │   │   ├── student-learning.e2e-spec.ts
│   │   │   │   ├── subscription-billing.e2e-spec.ts
│   │   │   │   └── users-profiles.e2e-spec.ts
│   │   │   ├── integration/
│   │   │   │   ├── .gitkeep
│   │   │   │   ├── ai-generation.integration.spec.ts
│   │   │   │   ├── ai-tutor.integration.spec.ts
│   │   │   │   ├── billing.integration.spec.ts
│   │   │   │   ├── cms-workflow.integration.spec.ts
│   │   │   │   ├── knowledge.integration.spec.ts
│   │   │   │   ├── mock-exam.integration.spec.ts
│   │   │   │   ├── question-workflow.integration.spec.ts
│   │   │   │   ├── rbac.integration.spec.ts
│   │   │   │   ├── student-learning.integration.spec.ts
│   │   │   │   └── users-profiles.integration.spec.ts
│   │   │   └── unit/
│   │   │       └── .gitkeep
│   │   ├── .env.example
│   │   ├── .env.test.example
│   │   ├── .eslintrc.js
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   ├── tsconfig.build.json
│   │   ├── tsconfig.build.tsbuildinfo
│   │   ├── tsconfig.json
│   │   ├── tsconfig.tsbuildinfo
│   │   ├── vitest.config.ts
│   │   └── vitest.e2e.config.ts
│   └── web/
│       ├── public/
│       │   ├── icons/
│       │   │   └── README.md
│       │   └── manifest.webmanifest
│       ├── src/
│       │   ├── app/
│       │   │   ├── (admin)/
│       │   │   │   ├── admin/
│       │   │   │   │   ├── ai-generation/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── analytics/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── audit-logs/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── billing/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── blueprints/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── cms/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── editorial/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── formulas/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── knowledge/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── learning-objectives/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── permissions/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── questions/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── roles/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── settings/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── users/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   └── page.tsx
│       │   │   │   └── layout.tsx
│       │   │   ├── (auth)/
│       │   │   │   ├── forgot-password/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── login/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── register/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── reset-password/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── verify-email/
│       │   │   │   │   └── page.tsx
│       │   │   │   └── layout.tsx
│       │   │   ├── (student)/
│       │   │   │   ├── analytics/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── billing/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── bookmarks/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── dashboard/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── exams/
│       │   │   │   │   ├── [id]/
│       │   │   │   │   │   ├── result/
│       │   │   │   │   │   │   └── page.tsx
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── history/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── learn/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── planner/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── practice/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── profile/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── progress/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── settings/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── subscription/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── tutor/
│       │   │   │   │   └── page.tsx
│       │   │   │   └── layout.tsx
│       │   │   ├── globals.css
│       │   │   ├── layout.tsx
│       │   │   ├── not-found.tsx
│       │   │   └── page.tsx
│       │   ├── components/
│       │   │   ├── auth/
│       │   │   │   └── protected-route.tsx
│       │   │   ├── common/
│       │   │   │   ├── __tests__/
│       │   │   │   │   └── query-boundary.spec.tsx
│       │   │   │   ├── page-header.tsx
│       │   │   │   ├── query-boundary.tsx
│       │   │   │   └── stat-card.tsx
│       │   │   ├── form/
│       │   │   │   └── form-field.tsx
│       │   │   ├── shell/
│       │   │   │   ├── app-shell.tsx
│       │   │   │   ├── command-palette.tsx
│       │   │   │   ├── mobile-nav.tsx
│       │   │   │   ├── sidebar.tsx
│       │   │   │   └── topbar.tsx
│       │   │   ├── theme/
│       │   │   │   ├── theme-provider.tsx
│       │   │   │   └── theme-toggle.tsx
│       │   │   └── ui/
│       │   │       ├── __tests__/
│       │   │       │   ├── badge.spec.tsx
│       │   │       │   ├── button.spec.tsx
│       │   │       │   └── empty-state.spec.tsx
│       │   │       ├── avatar.tsx
│       │   │       ├── badge.tsx
│       │   │       ├── button.tsx
│       │   │       ├── card.tsx
│       │   │       ├── command.tsx
│       │   │       ├── dialog.tsx
│       │   │       ├── dropdown-menu.tsx
│       │   │       ├── empty-state.tsx
│       │   │       ├── error-boundary.tsx
│       │   │       ├── input.tsx
│       │   │       ├── label.tsx
│       │   │       ├── progress.tsx
│       │   │       ├── select.tsx
│       │   │       ├── separator.tsx
│       │   │       ├── skeleton.tsx
│       │   │       ├── spinner.tsx
│       │   │       ├── switch.tsx
│       │   │       ├── table.tsx
│       │   │       ├── tabs.tsx
│       │   │       ├── toast.tsx
│       │   │       └── tooltip.tsx
│       │   ├── config/
│       │   │   └── navigation.ts
│       │   ├── features/
│       │   │   ├── admin/
│       │   │   │   ├── api/
│       │   │   │   │   └── admin-api.ts
│       │   │   │   ├── components/
│       │   │   │   │   └── resource-table.tsx
│       │   │   │   └── hooks/
│       │   │   │       └── use-admin.ts
│       │   │   ├── auth/
│       │   │   │   ├── __tests__/
│       │   │   │   │   └── schemas.spec.ts
│       │   │   │   ├── components/
│       │   │   │   │   ├── auth-shell.tsx
│       │   │   │   │   ├── forgot-password-form.tsx
│       │   │   │   │   ├── login-form.tsx
│       │   │   │   │   ├── register-form.tsx
│       │   │   │   │   ├── reset-password-form.tsx
│       │   │   │   │   └── verify-email-view.tsx
│       │   │   │   └── schemas.ts
│       │   │   ├── billing/
│       │   │   │   ├── api/
│       │   │   │   │   └── billing-api.ts
│       │   │   │   └── hooks/
│       │   │   │       └── use-billing.ts
│       │   │   ├── exams/
│       │   │   │   ├── api/
│       │   │   │   │   └── exams-api.ts
│       │   │   │   ├── components/
│       │   │   │   │   ├── exam-result.tsx
│       │   │   │   │   ├── exam-runner.tsx
│       │   │   │   │   └── exams-list.tsx
│       │   │   │   └── hooks/
│       │   │   │       └── use-exams.ts
│       │   │   ├── practice/
│       │   │   │   └── components/
│       │   │   │       └── practice-view.tsx
│       │   │   ├── student/
│       │   │   │   ├── api/
│       │   │   │   │   └── student-api.ts
│       │   │   │   ├── components/
│       │   │   │   │   ├── dashboard-view.tsx
│       │   │   │   │   └── progress-view.tsx
│       │   │   │   └── hooks/
│       │   │   │       └── use-student.ts
│       │   │   └── tutor/
│       │   │       ├── api/
│       │   │       │   └── tutor-api.ts
│       │   │       ├── components/
│       │   │       │   └── tutor-chat.tsx
│       │   │       └── hooks/
│       │   │           └── use-tutor.ts
│       │   ├── hooks/
│       │   │   ├── use-auth.ts
│       │   │   └── use-debounce.ts
│       │   ├── lib/
│       │   │   ├── __tests__/
│       │   │   │   └── utils.spec.ts
│       │   │   ├── api/
│       │   │   │   ├── __tests__/
│       │   │   │   │   ├── client.spec.ts
│       │   │   │   │   └── token-store.spec.ts
│       │   │   │   ├── client.ts
│       │   │   │   ├── token-store.ts
│       │   │   │   └── types.ts
│       │   │   ├── auth/
│       │   │   │   ├── __tests__/
│       │   │   │   │   └── types.spec.ts
│       │   │   │   ├── auth-api.ts
│       │   │   │   └── types.ts
│       │   │   ├── query/
│       │   │   │   └── keys.ts
│       │   │   ├── config.ts
│       │   │   └── utils.ts
│       │   ├── providers/
│       │   │   ├── app-providers.tsx
│       │   │   ├── auth-provider.tsx
│       │   │   └── query-provider.tsx
│       │   ├── stores/
│       │   │   ├── __tests__/
│       │   │   │   └── auth-store.spec.ts
│       │   │   ├── auth-store.ts
│       │   │   └── ui-store.ts
│       │   ├── styles/
│       │   └── test/
│       │       └── setup.ts
│       ├── .env.example
│       ├── next-env.d.ts
│       ├── next.config.mjs
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── tsconfig.tsbuildinfo
│       ├── vercel.json
│       └── vitest.config.ts
├── docs/
│   ├── adr/
│   │   ├── ADR-001-monorepo-structure.md
│   │   └── ADR-002-nestjs-fastify.md
│   ├── api/
│   ├── runbooks/
│   ├── DEPLOYMENT_GUIDE.md
│   ├── DISASTER_RECOVERY.md
│   ├── FOLDER_TREE.md
│   ├── INSTALLATION.md
│   ├── LAUNCH_CHECKLIST.md
│   ├── LOCAL_DEVELOPMENT.md
│   ├── OPERATIONS_MANUAL.md
│   ├── PRODUCTION.md
│   ├── SPRINT_4_1_COMPLETION_REPORT.md
│   └── SPRINT_4_1_VERIFICATION.md
├── infrastructure/
│   ├── docker/
│   │   ├── api/
│   │   │   ├── Dockerfile
│   │   │   └── entrypoint.sh
│   │   ├── nginx/
│   │   │   ├── certs/
│   │   │   │   └── README.md
│   │   │   ├── nginx.conf
│   │   │   └── proxy_params.conf
│   │   ├── pgadmin/
│   │   │   └── servers.json
│   │   ├── postgres/
│   │   │   └── init/
│   │   │       └── 01-init.sql
│   │   ├── redis/
│   │   │   └── redis.conf
│   │   ├── web/
│   │   │   └── Dockerfile
│   │   └── Dockerfile.api
│   ├── monitoring/
│   │   ├── alerts.yml
│   │   └── uptime-checks.yml
│   ├── production/
│   │   └── .env.production.example
│   ├── scripts/
│   │   └── backup/
│   │       ├── db-backup.sh
│   │       ├── db-restore.sh
│   │       └── files-backup.sh
│   └── terraform/
├── packages/
│   ├── config/
│   │   ├── package.json
│   │   └── tsconfig.base.json
│   ├── types/
│   │   ├── src/
│   │   │   ├── api-responses.ts
│   │   │   ├── domain.ts
│   │   │   ├── enums.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── utils/
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc
├── README.md
├── commitlint.config.js
├── docker-compose.prod.yml
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
└── vercel.json
```
