/**
 * @file billing.module.ts
 * @module Billing
 *
 * BillingModule — invoice + receipt generation and invoice queries (Sprint 2.5).
 *
 * No circular dependencies: BillingService is consumed by PaymentModule but does
 * not depend on it. Exports BillingService for the payment webhook pipeline.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { BillingController } from './controllers/billing.controller';
import { BillingService } from './services/billing.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
