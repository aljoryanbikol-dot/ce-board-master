/**
 * @file index.ts
 * @module Subscriptions
 * Barrel export for the Subscriptions module (Sprint 2.5).
 */
export { SubscriptionModule } from './subscriptions.module';
export { SubscriptionService } from './services/subscription.service';
export { PlanService } from './services/plan.service';
export { SUBSCRIPTION_ERROR_CODES, type SubscriptionErrorCode } from './subscriptions.constants';
export { SubscriptionErrors } from './subscriptions.errors';
export {
  SubscribeSchema, type SubscribeDto,
  ChangePlanSchema, type ChangePlanDto,
  CancelSubscriptionSchema, type CancelSubscriptionDto,
  SubscriptionDto,
} from './dto/subscription.dto';
export {
  CreatePlanSchema, type CreatePlanDto,
  UpdatePlanSchema, type UpdatePlanDto,
  PlanDto,
} from './dto/plan.dto';
