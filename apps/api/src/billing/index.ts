/**
 * @file index.ts
 * @module Billing
 * Barrel export for the Billing module (Sprint 2.5).
 */
export { BillingModule } from './billing.module';
export { BillingService } from './services/billing.service';
export { ListInvoicesQuerySchema, type ListInvoicesQueryDto, InvoiceDto } from './dto/billing.dto';
