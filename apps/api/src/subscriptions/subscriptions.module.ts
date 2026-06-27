/**
 * @file subscriptions.module.ts
 * @module Subscriptions
 *
 * SubscriptionModule — subscription lifecycle + plan management (Sprint 2.5).
 *
 * Depends on PaymentModule (subscribing/upgrading creates payments). The
 * circular dependency with PaymentModule is resolved with forwardRef on both
 * sides; the services already use forwardRef(() => …) injection.
 *
 * Exports SubscriptionService + PlanService for PaymentModule (activation) and
 * future modules (DashboardModule, entitlement checks).
 */
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { PaymentModule } from '../payments/payments.module';
import {
  SubscriptionController,
  PlanController,
} from './controllers/subscription.controller';
import { SubscriptionService } from './services/subscription.service';
import { PlanService } from './services/plan.service';

@Module({
  imports: [
    AuthModule,
    RbacModule,
    forwardRef(() => PaymentModule),
  ],
  controllers: [SubscriptionController, PlanController],
  providers: [SubscriptionService, PlanService],
  exports: [SubscriptionService, PlanService],
})
export class SubscriptionModule {}
